import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';
import { getResumableUploadSessionUrl, finalizeDriveUpload } from '@/lib/drive';
import crypto from 'crypto';

export const runtime = 'nodejs';

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

    // 4. Handle Actions
    const body = await request.json();
    const { action, filename, mimeType } = body;

    if (action === 'init') {
      const sessionUrl = await getResumableUploadSessionUrl({
        filename: filename || `mobile_upload_${Date.now()}.jpg`,
        mimeType: mimeType || 'application/octet-stream',
        folderId: event.driveFolderId
      });
      return NextResponse.json({ sessionUrl });
    } 
    
    if (action === 'complete') {
      const { fileId, size } = body;
      if (!fileId) {
        return NextResponse.json({ error: 'fileId is required to complete upload' }, { status: 400 });
      }

      const { viewUrl, downloadUrl } = await finalizeDriveUpload(fileId);

      const status = event.moderationMode === 'approval' ? 'pending' : 'approved';
      const uploadDoc = {
        filename: filename || `mobile_upload_${Date.now()}.jpg`,
        size: size || 0,
        mimeType: mimeType || null,
        uploaderType: 'guest',
        guestId,
        status,
        driveFileId: fileId,
        viewUrl,
        downloadUrl,
        thumbnail: null,
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

      // Increment guest upload stats for the host dashboard
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        await guestRef.update({
          photoCount: FieldValue.increment(1),
          lastUploadAt: Date.now(),
        });
      } catch {
        // Non-critical — guest doc may not have these fields yet
      }

      return NextResponse.json({ 
        success: true, 
        id: uploadRef.id, 
        ...uploadDoc, 
        deleteToken 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err) {
    console.error('Mobile upload failed:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

