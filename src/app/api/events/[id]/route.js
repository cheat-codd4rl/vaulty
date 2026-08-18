import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
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
    let rawPin = null;
    const batch = adminDb.batch();
    
    if (body.accessMode !== undefined) {
      allowedUpdates.accessMode = body.accessMode;
      allowedUpdates.hasPin = body.accessMode === 'pin';
      
      // If toggling to pin mode, ensure there's a pin
      if (body.accessMode === 'pin') {
        const privateRef = eventRef.collection('security').doc('private');
        const privateDoc = await privateRef.get();
        if (!privateDoc.exists || !privateDoc.data().pinHash) {
          const bcrypt = await import('bcryptjs');
          rawPin = String(Math.floor(100000 + Math.random() * 900000));
          const pinHash = await bcrypt.hash(rawPin, 10);
          batch.set(privateRef, { pinHash }, { merge: true });
        }
      }
    }
    
    if (body.moderationMode !== undefined) {
      allowedUpdates.moderationMode = body.moderationMode;
    }
    
    if (body.resetPin === true) {
      const bcrypt = await import('bcryptjs');
      rawPin = String(Math.floor(100000 + Math.random() * 900000));
      const pinHash = await bcrypt.hash(rawPin, 10);
      const privateRef = eventRef.collection('security').doc('private');
      batch.set(privateRef, { pinHash }, { merge: true });
      allowedUpdates.accessMode = 'pin';
      allowedUpdates.hasPin = true;
    }

    if (Object.keys(allowedUpdates).length > 0) {
      batch.update(eventRef, allowedUpdates);
    }
    
    await batch.commit();

    return NextResponse.json({ success: true, updated: allowedUpdates, rawPin });
  } catch (err) {
    console.error('Event update failed:', err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}
