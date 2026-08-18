import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { signJwt } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { code, pin, name } = body;

    if (!code || !pin || !name || name.trim() === '') {
      return NextResponse.json({ error: 'Missing required fields: code, pin, and name are required' }, { status: 400 });
    }

    const eventId = code.trim();
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    const privateDoc = await eventRef.collection('security').doc('private').get();
    const privateData = privateDoc.exists ? privateDoc.data() : null;

    // Rate Limiting Check
    const ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
    const ipKey = ip.replace(/[.#$/[\]]/g, '_');
    const rateLimitRef = eventRef.collection('security').doc(`ratelimit_${ipKey}`);
    const rateLimitDoc = await rateLimitRef.get();
    
    if (rateLimitDoc.exists) {
      const rlData = rateLimitDoc.data();
      if (rlData.attempts >= 5 && rlData.expiresAt > Date.now()) {
        return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 });
      }
    }

    const recordFailedAttempt = async () => {
      if (rateLimitDoc.exists) {
        await rateLimitRef.update({
          attempts: (rateLimitDoc.data().attempts || 0) + 1,
          expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins lockout
        });
      } else {
        await rateLimitRef.set({ attempts: 1, expiresAt: Date.now() + 15 * 60 * 1000 });
      }
    };

    if (eventData.hasPin || eventData.accessMode === 'pin') {
      if (!privateData || !privateData.pinHash) {
        return NextResponse.json({ error: 'PIN is not set up on this event' }, { status: 400 });
      }
      const pinMatch = await bcrypt.compare(pin, privateData.pinHash);
      if (!pinMatch) {
        await recordFailedAttempt();
        return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
      }
    }

    // Reset rate limit on success
    if (rateLimitDoc.exists) await rateLimitRef.delete();

    // Check for duplicate names (trigger recovery flow on mobile)
    const normalizedName = name.trim().toLowerCase();
    const allGuestsSnap = await eventRef.collection('guests').get();
    const nameTaken = allGuestsSnap.docs.some(doc => 
      doc.data().name && doc.data().name.trim().toLowerCase() === normalizedName
    );

    if (nameTaken) {
      return NextResponse.json({ 
        error: 'NAME_TAKEN', 
        message: 'This name is already in use at this event. Please recover your session.',
        requireClaim: true 
      }, { status: 409 });
    }

    // Create Guest Identity
    const guestId = 'gst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const claimCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    
    const guestData = {
      guestId,
      name: name.trim(),
      claimCode,
      tokenVersion: 1, // Start with version 1
      createdAt: Date.now()
    };
    
    await eventRef.collection('guests').doc(guestId).set(guestData);

    // Calculate dynamic JWT expiry (tied to event date)
    const eventDateMs = eventData.date ? new Date(eventData.date).getTime() : Date.now();
    const expiryTime = Math.max(Date.now() + 7 * 24 * 60 * 60 * 1000, eventDateMs + 30 * 24 * 60 * 60 * 1000);
    const maxExpiry = Date.now() + 180 * 24 * 60 * 60 * 1000; 
    const finalExpiry = Math.min(expiryTime, maxExpiry);
    const maxAgeSeconds = Math.floor((finalExpiry - Date.now()) / 1000);

    // Issue mobile upload token with version
    const uploadToken = signJwt(
      { eventId, guestId, role: 'mobile_guest', v: 1 }, 
      { expiresIn: maxAgeSeconds }
    );

    // Photo count
    let photoCount = 0;
    const statsDoc = await eventRef.collection('system').doc('stats').get();
    if (statsDoc.exists) {
      photoCount = statsDoc.data().photoCount || 0;
    } else {
      const photosSnap = await eventRef.collection('photos').count().get();
      photoCount = photosSnap.data().count;
    }

    return NextResponse.json({ 
      eventId, 
      eventName: eventData.name, 
      photoCount, 
      guestId, 
      uploadToken,
      claimCode // Return it so the mobile app can cache it for recovery
    });

  } catch (err) {
    console.error('Mobile join code error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
