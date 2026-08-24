import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Query events collection directly for the matching inviteToken
    const snapshot = await adminDb.collection('events').where('inviteToken', '==', token).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    const eventDoc = snapshot.docs[0];
    const eventData = eventDoc.data();

    // Return only the public details needed for the landing page
    return NextResponse.json({
      id: eventDoc.id,
      name: eventData.name,
      date: eventData.date,
      cover: eventData.cover,
      hasPin: eventData.hasPin || eventData.accessMode === 'pin',
      accessMode: eventData.accessMode,
      hostId: eventData.hostId
    });

  } catch (err) {
    console.error('Invite resolution failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
