import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const guestCookie = request.cookies.get(`vaulty_guest_${id}`)?.value;
    if (!guestCookie) {
      return NextResponse.json({ error: 'Unauthorized. No guest session.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyJwt(guestCookie);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    if (decoded.role !== 'guest' || decoded.eventId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const guestRef = adminDb.collection('events').doc(id).collection('guests').doc(decoded.guestId);
    const guestDoc = await guestRef.get();

    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest profile not found' }, { status: 404 });
    }

    await guestRef.update({ name: name.trim() });

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (err) {
    console.error('Update guest name error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
