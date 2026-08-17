import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { deleteFromDrive } from '@/lib/drive';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request, { params }) {
  try {
    const { id } = params;

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
    if (!hostId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 2. Fetch Event and Verify Ownership
    const eventRef = adminDb.collection('events').doc(id);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventDoc.data();
    if (event.hostId !== hostId) {
      return NextResponse.json({ error: 'Unauthorized to delete this event' }, { status: 403 });
    }

    // 3. Clean up Firestore (uploads subcollection)
    const uploadsSnapshot = await eventRef.collection('uploads').get();
    
    // Batch deletes for uploads (500 limit per batch in Firestore)
    let batch = adminDb.batch();
    let count = 0;
    
    for (const doc of uploadsSnapshot.docs) {
      batch.delete(doc.ref);
      count++;
      
      if (count === 490) { // Keep under 500
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
    
    if (count > 0) {
      await batch.commit();
    }

    // 4. Clean up Drive folder
    if (event.driveFolderId) {
      try {
        await deleteFromDrive(event.driveFolderId);
      } catch (err) {
        console.error('Failed to delete Drive folder, skipping:', err);
      }
    }

    // 5. Delete Event document
    await eventRef.delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete event failed:', err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
