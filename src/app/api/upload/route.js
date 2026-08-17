/*
  API Route: POST /api/upload

  Step 2 of 2: called by the client once its direct upload to Vercel Blob
  (via /api/upload/blob-token) has finished. Receives a small JSON
  payload — never the file itself — so this route is unaffected by the
  4.5MB Function body limit no matter how large the actual file was.

  Re-verifies everything independently rather than trusting the token
  step: status and role are computed here, from data this server looks
  up itself, never from client input.

  Request body (JSON):
    { blobUrl, filename, mimeType, eventId, uploaderType, deviceToken,
      collaboratorCode, thumbnail }

  Response:
    { id, filename, status, viewUrl, downloadUrl, ... }
*/

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { uploadToDrive } from '@/lib/drive';
import { del } from '@vercel/blob';
import { Readable } from 'stream';
import crypto from 'crypto';

export const runtime = 'nodejs'; // needed for streaming + the Drive client
export const maxDuration = 60;   // raise if your host allows and video uploads need longer

export async function POST(request) {
  let blobUrl = null;
  try {
    const {
      blobUrl: url, filename, mimeType,
      eventId, uploaderType: uploaderTypeInput, deviceToken, collaboratorCode,
      thumbnail,
    } = await request.json();
    blobUrl = url;

    if (!blobUrl || !eventId || !deviceToken || !filename) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const eventSnap = await adminDb.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventSnap.data();
    
    if (event.status === 'deleting') {
      return NextResponse.json({ error: 'Event is being deleted' }, { status: 403 });
    }

    const privateSnap = await adminDb.collection('events').doc(eventId).collection('security').doc('private').get();
    const eventPrivate = privateSnap.exists ? privateSnap.data() : {};
    const actualCollaboratorCode = eventPrivate.collaboratorCode || event.collaboratorCode;

    // --- Server decides role and status. Never trust these from the client. ---
    let uploaderType = 'guest';
    if (uploaderTypeInput === 'photographer') {
      if (!collaboratorCode || collaboratorCode !== actualCollaboratorCode) {
        return NextResponse.json({ error: 'Invalid collaborator code' }, { status: 403 });
      }
      uploaderType = 'photographer';
    }
    const status = uploaderType === 'photographer'
      ? 'approved'
      : (event.moderationMode === 'approval' ? 'pending' : 'approved');
    // --- end server-side trust boundary ---

    // Check that the event has a Drive folder (created at event-creation time)
    if (!event.driveFolderId) {
      return NextResponse.json(
        { error: 'Event has no storage folder — it may have been created before Drive was configured' },
        { status: 500 }
      );
    }

    // Pull the staged file from Blob and stream it straight into Drive —
    // never buffered fully in memory, so this scales to large photos and
    // video instead of just the ones that happened to fit under 4.5MB.
    const blobRes = await fetch(blobUrl);
    if (!blobRes.ok || !blobRes.body) {
      return NextResponse.json({ error: 'Could not read staged upload' }, { status: 502 });
    }
    const size = Number(blobRes.headers.get('content-length')) || null;
    const nodeStream = Readable.fromWeb(blobRes.body);

    const { fileId, viewUrl, downloadUrl } = await uploadToDrive({
      stream: nodeStream,
      filename,
      mimeType: mimeType || 'application/octet-stream',
      folderId: event.driveFolderId,
    });

    const uploadDoc = {
      filename,
      size,
      mimeType: mimeType || null,
      uploaderType,
      status,
      driveFileId: fileId,
      viewUrl,
      downloadUrl,
      thumbnail: thumbnail || null,
      createdAt: Date.now(),
    };

    const batch = adminDb.batch();
    const uploadRef = adminDb.collection('events').doc(eventId).collection('uploads').doc();
    batch.set(uploadRef, uploadDoc);

    const deleteToken = crypto.randomBytes(32).toString('hex');
    const deleteTokenHash = crypto.createHash('sha256').update(deleteToken).digest('hex');
    const deleteSecurityRef = uploadRef.collection('security').doc('deletion');
    
    batch.set(deleteSecurityRef, {
      deleteTokenHash,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      consumed: false
    });

    await batch.commit();

    // Blob was only ever transient staging — Drive is the real
    // destination. Clean it up; don't fail the request if this fails.
    del(blobUrl).catch((e) => console.error('Blob cleanup failed:', e.message));

    return NextResponse.json({ id: uploadRef.id, ...uploadDoc, deleteToken });
  } catch (err) {
    console.error('upload relay failed', err);
    // Best-effort cleanup even on failure, so a broken relay doesn't leave
    // orphaned files sitting in Blob storage indefinitely.
    if (blobUrl) del(blobUrl).catch(() => {});
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
