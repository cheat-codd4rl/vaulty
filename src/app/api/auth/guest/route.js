import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { signJwt } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { token, name, pin, claimCode, eventId: returningEventId, targetGuestId } = await request.json();

    let eventId = null;
    let eventRef = null;
    let privateData = null;
    let eventData = null;

    if (token) {
      // 1. Resolve Token
      const securityGroup = adminDb.collectionGroup('security');
      const snapshot = await securityGroup.where('inviteToken', '==', token).limit(1).get();

      if (snapshot.empty) {
        return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
      }

      const privateDoc = snapshot.docs[0];
      eventRef = privateDoc.ref.parent.parent;
      if (!eventRef) {
        return NextResponse.json({ error: 'Event reference not found' }, { status: 500 });
      }
      eventId = eventRef.id;

      const eventDoc = await eventRef.get();
      if (!eventDoc.exists) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      eventData = eventDoc.data();
      privateData = privateDoc.data();

      // 2. Validate PIN if required
      if (eventData.hasPin || eventData.accessMode === 'pin') {
        if (!pin) {
          return NextResponse.json({ error: 'PIN required' }, { status: 400 });
        }
        if (!privateData.pinHash) {
          return NextResponse.json({ error: 'PIN is not set up on this event' }, { status: 400 });
        }
        
        const pinMatch = await bcrypt.compare(pin, privateData.pinHash);
        if (!pinMatch) {
          return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
        }
      }
    } else if (returningEventId && (pin || name)) {
      // Guest flow: Validate PIN for the event (if required)
      eventRef = adminDb.collection('events').doc(returningEventId);
      const eventDoc = await eventRef.get();
      if (!eventDoc.exists) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      
      eventData = eventDoc.data();
      eventId = eventRef.id;
      
      const privateDoc = await eventRef.collection('security').doc('private').get();
      privateData = privateDoc.exists ? privateDoc.data() : null;

      // Rate Limiting Check (only if PIN is provided/checked)
      const ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
      const ipKey = ip.replace(/[.#$/[\]]/g, '_');
      const rateLimitRef = eventRef.collection('security').doc(`ratelimit_${ipKey}`);
      const rateLimitDoc = await rateLimitRef.get();
      
      if (rateLimitDoc.exists && pin) {
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
        if (!pin) {
          return NextResponse.json({ error: 'PIN required' }, { status: 401 });
        }
        if (!privateData || !privateData.pinHash) {
          return NextResponse.json({ error: 'PIN is not set up' }, { status: 400 });
        }
        const pinMatch = await bcrypt.compare(pin, privateData.pinHash);
        if (!pinMatch) {
          await recordFailedAttempt();
          return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
        }
      }

      // If a claimCode and targetGuestId are provided, we are attempting to bind an existing record
      if (claimCode && targetGuestId) {
        const guestDoc = await eventRef.collection('guests').doc(targetGuestId).get();
        if (!guestDoc.exists) {
          return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
        }
        if (guestDoc.data().claimCode !== claimCode.toUpperCase()) {
          await recordFailedAttempt();
          return NextResponse.json({ error: 'Incorrect claim code' }, { status: 401 });
        }
        
        // Reset rate limit on success
        if (rateLimitDoc.exists) await rateLimitRef.delete();

        // Calculate dynamic JWT expiry
        const eventDateMs = eventData.date ? new Date(eventData.date).getTime() : Date.now();
        const expiryTime = Math.max(Date.now() + 7 * 24 * 60 * 60 * 1000, eventDateMs + 30 * 24 * 60 * 60 * 1000);
        const maxExpiry = Date.now() + 180 * 24 * 60 * 60 * 1000; // 6 months ceiling
        const finalExpiry = Math.min(expiryTime, maxExpiry);
        const maxAgeSeconds = Math.floor((finalExpiry - Date.now()) / 1000);

        // Issue JWT for existing guest
        const guestToken = signJwt({ eventId, guestId: targetGuestId, role: 'guest' }, { expiresIn: maxAgeSeconds });
        const res = NextResponse.json({ success: true, eventId, guestId: targetGuestId, recovered: true });
        res.cookies.set(`vaulty_guest_${eventId}`, guestToken, {
          httpOnly: true, secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax', path: '/', maxAge: maxAgeSeconds
        });
        return res;
      }

      // Reset rate limit on success (if no claim code was required to be checked here)
      if (rateLimitDoc.exists && pin) await rateLimitRef.delete();

      // If name is NOT provided, return the guest list for the "Who are you?" screen
      if (!name) {
        const guestsSnap = await eventRef.collection('guests').get();
        const guestList = guestsSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name
        }));
        
        return NextResponse.json({ 
          success: true, 
          requireClaim: true, 
          guests: guestList 
        });
      }

      // If name IS provided, execution continues past the if/else block to create the guest doc!
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // 3. Create or Link Guest Identity
    let guestId = null;
    let returnedClaimCode = null;
    
    // We expect the user to provide a name for a new guest session
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Creating a brand new guest record
    guestId = 'gst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    returnedClaimCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    
    const guestData = {
      guestId,
      name: name.trim(),
      claimCode: returnedClaimCode, // used to claim this profile on another device
      joinedAt: Date.now(),
      photoCount: 0,
      lastUploadAt: null,
      createdAt: Date.now()
    };
    
    await eventRef.collection('guests').doc(guestId).set(guestData);

    // 4. Issue JWT
    const eventDateMs = eventData.date ? new Date(eventData.date).getTime() : Date.now();
    const expiryTime = Math.max(Date.now() + 7 * 24 * 60 * 60 * 1000, eventDateMs + 30 * 24 * 60 * 60 * 1000);
    const maxExpiry = Date.now() + 180 * 24 * 60 * 60 * 1000; 
    const finalExpiry = Math.min(expiryTime, maxExpiry);
    const maxAgeSeconds = Math.floor((finalExpiry - Date.now()) / 1000);

    const guestToken = signJwt({ eventId, guestId, role: 'guest' }, { expiresIn: maxAgeSeconds });

    const res = NextResponse.json({ success: true, eventId, guestId, claimCode: returnedClaimCode });
    
    res.cookies.set(`vaulty_guest_${eventId}`, guestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds
    });

    return res;

  } catch (err) {
    console.error('Guest auth error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
