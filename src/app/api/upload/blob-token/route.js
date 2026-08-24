/*
  API Route: POST /api/upload/blob-token

  Step 1 of 2 for every upload. Issues a short-lived, scoped token that
  lets the browser upload directly to Vercel Blob. The file's bytes never
  pass through this route, or any Vercel Function — that's what makes this
  immune to the 4.5MB body limit regardless of file size.

  This does lightweight checks so obviously-bad requests are rejected
  before any storage is used — but this is NOT the authoritative check.
  /api/upload (step 2) re-verifies the event and collaborator code itself
  and computes status independently, rather than trusting anything
  decided here.
*/

import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
];
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB — abuse guard, not a platform limit

export async function POST(request) {
  const body = await request.json();
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || '{}');
        const { eventId, uploaderType, collaboratorCode } = payload;

        if (!eventId) throw new Error('Missing eventId');
        const eventSnap = await adminDb.collection('events').doc(eventId).get();
        if (!eventSnap.exists) throw new Error('Event not found');
        const event = eventSnap.data();
        if (event.status === 'deleting') throw new Error('Event is being deleted');

        if (uploaderType === 'photographer') {
          if (!collaboratorCode || collaboratorCode !== event.collaboratorCode) {
            throw new Error('Invalid collaborator code');
          }
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Deliberately NOT doing the Drive relay here. This callback is
        // a fire-and-forget webhook from Vercel — the client calls
        // /api/upload directly once upload() resolves instead.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
