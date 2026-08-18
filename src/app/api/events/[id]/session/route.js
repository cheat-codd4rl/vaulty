import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // Check for host session first
    const hostCookie = request.cookies.get('vaulty_host_session')?.value;
    if (hostCookie) {
      try {
        const decoded = verifyJwt(hostCookie);
        if (decoded.role === 'host') {
          // Verify they actually own this event
          const eventDoc = await adminDb.collection('events').doc(id).get();
          if (eventDoc.exists && eventDoc.data().hostId === decoded.hostId) {
            return NextResponse.json({ valid: true, role: 'host' });
          }
        }
      } catch (err) {}
    }

    // Check for guest session
    const guestCookie = request.cookies.get(`vaulty_guest_${id}`)?.value;
    if (guestCookie) {
      try {
        const decoded = verifyJwt(guestCookie);
        if (decoded.role === 'guest' && decoded.eventId === id) {
          const guestDoc = await adminDb.collection('events').doc(id).collection('guests').doc(decoded.guestId).get();
          if (guestDoc.exists) {
            return NextResponse.json({ 
              valid: true, 
              role: 'guest', 
              guestId: decoded.guestId,
              claimCode: guestDoc.data().claimCode 
            });
          }
        }
      } catch (err) {}
    }

    return NextResponse.json({ valid: false }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
