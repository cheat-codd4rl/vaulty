import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Query across all 'security' subcollections for the matching inviteToken
    const securityGroup = adminDb.collectionGroup('security');
    const snapshot = await securityGroup.where('inviteToken', '==', token).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invite not found or expired' }, { status: 404 });
    }

    // The document found is events/{eventId}/security/private
    // So the parent's parent is the event document
    const privateDoc = snapshot.docs[0];
    const eventRef = privateDoc.ref.parent.parent;
    
    if (!eventRef) {
      return NextResponse.json({ error: 'Event reference not found' }, { status: 500 });
    }

    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

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
