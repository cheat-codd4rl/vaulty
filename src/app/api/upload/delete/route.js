/*
  API Route: POST /api/upload/delete

  Deletes an upload's Drive file and Firestore record. Checks ownership
  server-side before doing anything.

  Request body (JSON):
    { eventId, uploadId, deviceToken }

  Response:
    { ok: true }
*/

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { deleteFromDrive } from '@/lib/drive';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const { eventId, uploadId, deleteToken } = await request.json();
    if (!eventId || !uploadId || !deleteToken) {
      return NextResponse.json({ error: 'Missing required fields or token' }, { status: 400 });
    }

    const uploadRef = adminDb.collection('events').doc(eventId).collection('uploads').doc(uploadId);
    const uploadSnap = await uploadRef.get();
    if (!uploadSnap.exists) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    const upload = uploadSnap.data();

    const deleteSecurityRef = uploadRef.collection('security').doc('deletion');
    
    const eventSnap = await adminDb.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const eventData = eventSnap.data();

    if (eventData.status === 'deleting') {
      return NextResponse.json({ error: 'Event is being deleted' }, { status: 403 });
    }

    // Verify token and mark consumed atomically
    const authorized = await adminDb.runTransaction(async (transaction) => {
      const securityDoc = await transaction.get(deleteSecurityRef);
      if (!securityDoc.exists) return false;
      const data = securityDoc.data();
      
      if (data.consumed) return false;
      if (Date.now() > data.expiresAt) return false;
      
      const hash = crypto.createHash('sha256').update(deleteToken).digest('hex');
      if (hash !== data.deleteTokenHash) return false;
      
      transaction.update(deleteSecurityRef, { consumed: true });
      return true;
    });

    // Host deletions must go through the authenticated /api/events/[id]/uploads/moderate route instead
    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized to delete this upload or link expired' }, { status: 403 });
    }

    if (upload.driveFileId) {
      try {
        await deleteFromDrive(upload.driveFileId);
      } catch (e) {
        if (e.code === 'DRIVE_AUTH_REVOKED' || e.message === 'DRIVE_AUTH_REVOKED') throw e;
        console.error(`Drive delete failed for file ${upload.driveFileId}:`, e.message);
      }
    }
    await uploadRef.delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('delete failed', err);
    if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') {
      return NextResponse.json({ error: 'Service Configuration Error: The underlying Google Drive integration needs to be reconnected by the administrator.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
