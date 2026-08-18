import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';
import { uploadToDrive } from '@/lib/drive';
import { Readable } from 'stream';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allows up to 60s for the upload to complete

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

    if (decoded.role !== 'mobile_guest') {
      return NextResponse.json({ error: 'Token is not scoped for mobile uploads' }, { status: 403 });
    }

    if (decoded.eventId !== eventId) {
      return NextResponse.json({ error: 'Token is for a different event' }, { status: 403 });
    }

    // 2. Validate Token Version (Check for revocation)
    const guestId = decoded.guestId;
    const tokenVersion = decoded.v || 1;

    const guestRef = adminDb.collection('events').doc(eventId).collection('guests').doc(guestId);
    const guestDoc = await guestRef.get();

    if (!guestDoc.exists) {
      return NextResponse.json({ error: 'Guest session no longer exists' }, { status: 401 });
    }

    const currentVersion = guestDoc.data().tokenVersion || 1;
    if (tokenVersion < currentVersion) {
      return NextResponse.json({ error: 'Token has been revoked' }, { status: 401 });
    }

    // 3. Resolve Event
    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDocSnap = await eventRef.get();
    
    if (!eventDocSnap.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventDocSnap.data();
    if (event.status === 'deleting') {
      return NextResponse.json({ error: 'Event is being deleted' }, { status: 403 });
    }
    if (!event.driveFolderId) {
      return NextResponse.json({ error: 'Event has no storage folder configured' }, { status: 500 });
    }

    // 4. Parse Multipart Form
    const formData = await request.formData();
    const file = formData.get('photo') || formData.get('file'); // common field names
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file found in request under "photo" or "file" key' }, { status: 400 });
    }

    // 5. Upload to Google Drive directly (streaming)
    // Note: If hosted on Vercel, this is bound by Vercel's 4.5MB request limit.
    // For large mobile uploads in production, a client-side direct upload (like Vercel Blob) is required.
    const nodeStream = Readable.fromWeb(file.stream());
    
    const { fileId, viewUrl, downloadUrl } = await uploadToDrive({
      stream: nodeStream,
      filename: file.name || `mobile_upload_${Date.now()}.jpg`,
      mimeType: file.type || 'application/octet-stream',
      folderId: event.driveFolderId,
    });

    // 6. Record Upload in Firestore
    const status = event.moderationMode === 'approval' ? 'pending' : 'approved';
    const uploadDoc = {
      filename: file.name || `mobile_upload_${Date.now()}.jpg`,
      size: file.size,
      mimeType: file.type || null,
      uploaderType: 'guest',
      guestId, // Keep attribution!
      status,
      driveFileId: fileId,
      viewUrl,
      downloadUrl,
      thumbnail: null, // the mobile app doesn't send thumbnails in this endpoint currently
      createdAt: Date.now(),
    };

    const batch = adminDb.batch();
    const uploadRef = eventRef.collection('uploads').doc();
    batch.set(uploadRef, uploadDoc);

    const deleteToken = crypto.randomBytes(32).toString('hex');
    const deleteTokenHash = crypto.createHash('sha256').update(deleteToken).digest('hex');
    const deleteSecurityRef = uploadRef.collection('security').doc('deletion');
    
    batch.set(deleteSecurityRef, {
      deleteTokenHash,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      consumed: false
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      id: uploadRef.id, 
      ...uploadDoc, 
      deleteToken 
    });

  } catch (err) {
    console.error('Mobile upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
