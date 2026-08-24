import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { deleteFromDrive } from '@/lib/drive';
import { processEventDeletion } from '@/lib/deleteEvent';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request, { params }) {
  try {
    const { id } = await params;

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
    try {
      await processEventDeletion(id);
      return NextResponse.json({ success: true });
    } catch (err) {
      if (err.message === 'Deletion is already in progress') {
        return NextResponse.json({ error: 'Deletion is already in progress' }, { status: 429 });
      }
      if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') {
        return NextResponse.json({ error: 'Service Configuration Error: The underlying Google Drive integration needs to be reconnected by the administrator.' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Failed to completely delete event. Please retry.' }, { status: 500 });
    }
  } catch (err) {
    console.error('Delete event request failed:', err);
    if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') {
      return NextResponse.json({ error: 'Service Configuration Error: The underlying Google Drive integration needs to be reconnected by the administrator.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to process deletion' }, { status: 500 });
  }
}
