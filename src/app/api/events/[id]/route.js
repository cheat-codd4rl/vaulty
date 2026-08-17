import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // 1. Authenticate host session
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    if (!match) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyJwt(match[1]);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { hostId } = decoded;

    // 2. Verify Event Ownership
    const eventRef = adminDb.collection('events').doc(id);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    if (eventData.hostId !== hostId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (eventData.status === 'deleting') {
      return NextResponse.json({ error: 'Event is being deleted' }, { status: 403 });
    }

    // 3. Explicit allowlist for editable fields
    const allowedUpdates = {};
    if (body.accessMode !== undefined) allowedUpdates.accessMode = body.accessMode;
    if (body.moderationMode !== undefined) allowedUpdates.moderationMode = body.moderationMode;
    
    // NOTE: In the future, pin could be updated in the security/private doc if moved there.
    // Since it's still on the main doc (we left it public for client-side checks), we update it here.
    if (body.pin !== undefined) allowedUpdates.pin = body.pin;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    await eventRef.update(allowedUpdates);

    return NextResponse.json({ success: true, updated: allowedUpdates });
  } catch (err) {
    console.error('Event update failed:', err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}
