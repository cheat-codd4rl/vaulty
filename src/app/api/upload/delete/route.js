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

export async function POST(request) {
  try {
    const { eventId, uploadId, deviceToken } = await request.json();
    if (!eventId || !uploadId || !deviceToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const uploadRef = adminDb.collection('events').doc(eventId).collection('uploads').doc(uploadId);
    const uploadSnap = await uploadRef.get();
    if (!uploadSnap.exists) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    const upload = uploadSnap.data();

    // SECURITY TODO: same caveat as route.js — deviceToken should come from
    // a verified Firebase ID token (request.auth after admin.auth()
    // .verifyIdToken(...)), not a client-supplied field, once Anonymous
    // Auth is wired in. Until then this matches the prototype's model.
    let authorized = upload.deviceToken === deviceToken;

    if (!authorized) {
      // Not the uploader — check whether this is the event's host instead.
      const eventSnap = await adminDb.collection('events').doc(eventId).get();
      authorized = eventSnap.exists && eventSnap.data().creatorToken === deviceToken;
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Not authorized to delete this upload' }, { status: 403 });
    }

    if (upload.driveFileId) {
      // Don't fail the whole delete if Drive cleanup fails — an orphaned
      // Drive file is recoverable manually; a photo that won't delete from
      // the gallery is a worse user experience. Log it so you can clean up.
      await deleteFromDrive(upload.driveFileId).catch((e) => {
        console.error(`Drive delete failed for file ${upload.driveFileId}:`, e.message);
      });
    }
    await uploadRef.delete();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('delete failed', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
