import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { deleteFromDrive } from '@/lib/drive';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request, { params }) {
  try {
    const { id } = params;
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
    
    if (!eventDoc.exists || eventDoc.data().hostId !== hostId) {
      // Also allow legacy creator fallback, but since bulk moderation is a pro feature 
      // of Host Profiles, we will just restrict to Host Profiles for security.
      // We will allow if they are the authenticated host.
      if (eventDoc.data().hostId !== hostId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // 3. Process the batch (max 500 per transaction, but we will chunk just in case)
    let successCount = 0;
    
    // We process sequentially or in chunks of 100 for safety, especially with Drive API limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < uploadIds.length; i += CHUNK_SIZE) {
      const chunk = uploadIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      
      for (const uploadId of chunk) {
        const uploadRef = eventRef.collection('uploads').doc(uploadId);
        
        if (action === 'approve') {
          batch.update(uploadRef, { status: 'approved' });
        } else if (action === 'reject' || action === 'delete') {
          // If deleting, we also need to get the fileId to delete from Drive
          const uDoc = await uploadRef.get();
          if (uDoc.exists) {
            const data = uDoc.data();
            if (data.fileId) {
              try {
                await deleteFromDrive(data.fileId);
              } catch (e) {
                console.error(`Failed to delete fileId ${data.fileId} from Drive:`, e);
              }
            }
            batch.delete(uploadRef);
          }
        }
      }
      
      await batch.commit();
      successCount += chunk.length;
    }

    return NextResponse.json({ success: true, processed: successCount });
  } catch (err) {
    console.error('Bulk moderation failed:', err);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
