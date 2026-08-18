import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(request, context) {
  try {
    const { eventId } = await context.params;

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    const eventRef = adminDb.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Photo count
    let photoCount = 0;
    const statsDoc = await eventRef.collection('system').doc('stats').get();
    if (statsDoc.exists) {
      photoCount = statsDoc.data().photoCount || 0;
    } else {
      const photosSnap = await eventRef.collection('photos').count().get();
      photoCount = photosSnap.data().count;
    }

    return NextResponse.json({ 
      eventId,
      photoCount,
      status: eventDoc.data().status || 'active'
    });

  } catch (err) {
    console.error('Mobile status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
