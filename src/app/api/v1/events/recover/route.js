import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { signJwt } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventId, name, claimCode } = body;

    if (!eventId || !name || !claimCode) {
      return NextResponse.json({ error: 'Missing required fields: eventId, name, and claimCode are required' }, { status: 400 });
    }

    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const eventData = eventDoc.data();

    // Rate Limiting Check
    const ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
    const ipKey = ip.replace(/[.#$/[\]]/g, '_');
    const rateLimitRef = eventRef.collection('security').doc(`ratelimit_recover_${ipKey}`);
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

    // Find the guest by name
    const guestsSnap = await eventRef.collection('guests').where('name', '==', name.trim()).get();
    
    if (guestsSnap.empty) {
      await recordFailedAttempt();
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // Check if any matching guest has the correct claim code
    const targetClaimCode = claimCode.toUpperCase().trim();
    let matchedGuest = null;

    for (const doc of guestsSnap.docs) {
      if (doc.data().claimCode === targetClaimCode) {
        matchedGuest = { id: doc.id, ...doc.data() };
        break;
      }
    }

    if (!matchedGuest) {
      await recordFailedAttempt();
      return NextResponse.json({ error: 'Incorrect claim code' }, { status: 401 });
    }

    // Reset rate limit on success
    if (rateLimitDoc.exists) await rateLimitRef.delete();

    // Increment tokenVersion to invalidate previous tokens (logout from other devices)
    // Wait, the user didn't explicitly ask for recovery to invalidate other devices, 
    // but bumping tokenVersion on recovery is a good security practice.
    // Let's just issue a new token with the current version so both devices work, 
    // OR we bump it if they want exclusive sessions. Let's not bump it on recovery, 
    // only on explicit leave.
    const currentVersion = matchedGuest.tokenVersion || 1;

    // Calculate dynamic JWT expiry (tied to event date)
    const eventDateMs = eventData.date ? new Date(eventData.date).getTime() : Date.now();
    const expiryTime = Math.max(Date.now() + 7 * 24 * 60 * 60 * 1000, eventDateMs + 30 * 24 * 60 * 60 * 1000);
    const maxExpiry = Date.now() + 180 * 24 * 60 * 60 * 1000; 
    const finalExpiry = Math.min(expiryTime, maxExpiry);
    const maxAgeSeconds = Math.floor((finalExpiry - Date.now()) / 1000);

    // Issue mobile upload token with version
    const uploadToken = signJwt(
      { eventId, guestId: matchedGuest.id, role: 'mobile_guest', v: currentVersion }, 
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
      guestId: matchedGuest.id, 
      uploadToken
    });

  } catch (err) {
    console.error('Mobile recover error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
