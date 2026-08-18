import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function POST(request, context) {
  try {
    const { eventId } = await context.params;

    // 1. Authenticate Request
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyJwt(token);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (decoded.role !== 'mobile_guest' || decoded.eventId !== eventId) {
      return NextResponse.json({ error: 'Invalid token scope' }, { status: 403 });
    }

    const guestId = decoded.guestId;
    const guestRef = adminDb.collection('events').doc(eventId).collection('guests').doc(guestId);
    
    // 2. Invalidate the current and all previous tokens by bumping the required tokenVersion
    const guestDoc = await guestRef.get();
    if (guestDoc.exists) {
      const currentVersion = guestDoc.data().tokenVersion || 1;
      await guestRef.update({
        tokenVersion: currentVersion + 1
      });
    }

    return NextResponse.json({ success: true, message: 'Successfully left event and revoked token' });

  } catch (err) {
    console.error('Mobile leave error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
