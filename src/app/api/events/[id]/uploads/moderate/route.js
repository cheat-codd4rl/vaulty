import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { deleteFromDrive } from '@/lib/drive';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { uploadIds, action } = await request.json();

    if (!Array.isArray(uploadIds) || uploadIds.length === 0) {
      return NextResponse.json({ error: 'No uploads selected' }, { status: 400 });
    }
    if (!['approve', 'reject', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 1. Authenticate host session
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    if (!match) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(match[1], JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { hostId } = decoded;

    // 2. Verify Event Ownership
    const eventRef = adminDb.collection('events').doc(id);
    const eventDoc = await eventRef.get();
    
    const eventData = eventDoc.data();
    
    if (!eventDoc.exists || eventData.hostId !== hostId) {
      // Also allow legacy creator fallback, but since bulk moderation is a pro feature 
      // of Host Profiles, we will just restrict to Host Profiles for security.
      // We will allow if they are the authenticated host.
      if (!eventData || eventData.hostId !== hostId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    if (eventData.status === 'deleting') {
      return NextResponse.json({ error: 'Event is being deleted' }, { status: 403 });
    }

    // 3. Process the batch
    const successful = [];
    const failed = [];
    
    // We process sequentially or in chunks of 100 for safety, especially with Drive API limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < uploadIds.length; i += CHUNK_SIZE) {
      const chunk = uploadIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      const operations = []; // To track what we added to the batch

      for (const uploadId of chunk) {
        const uploadRef = eventRef.collection('uploads').doc(uploadId);
        
        if (action === 'approve') {
          batch.update(uploadRef, { status: 'approved' });
          operations.push(uploadId);
        } else if (action === 'reject' || action === 'delete') {
          try {
            const uDoc = await uploadRef.get();
            if (uDoc.exists) {
              const data = uDoc.data();
              if (data.fileId) {
                await deleteFromDrive(data.fileId);
              }
              batch.delete(uploadRef);
              operations.push(uploadId);
            } else {
              failed.push({ id: uploadId, error: 'Not found' });
            }
          } catch (e) {
            if (e.code === 'DRIVE_AUTH_REVOKED' || e.message === 'DRIVE_AUTH_REVOKED') throw e;
            console.error(`Failed processing ${uploadId}:`, e);
            failed.push({ id: uploadId, error: e.message || 'Operation failed' });
          }
        }
      }
      
      if (operations.length > 0) {
        try {
          await batch.commit();
          successful.push(...operations);
        } catch (e) {
          console.error('Batch commit failed:', e);
          failed.push(...operations.map(id => ({ id, error: 'Batch commit failed' })));
        }
      }
    }

    if (failed.length > 0) {
      return NextResponse.json({ success: successful.length > 0, successful, failed }, { status: 207 });
    }

    return NextResponse.json({ success: true, processed: successful.length, successful });
  } catch (err) {
    console.error('Bulk moderation failed:', err);
    if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') {
      return NextResponse.json({ error: 'Service Configuration Error: The underlying Google Drive integration needs to be reconnected by the administrator.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
