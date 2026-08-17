import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { processEventDeletion } from '@/lib/deleteEvent';

export const maxDuration = 60; // Allow 60s for cleanup batching
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  
  // Verify Vercel Cron Secret
  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // If not configured, reject completely in production
    if (process.env.NODE_ENV === 'production') {
       return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
    }
  }

  try {
    const eventsRef = adminDb.collection('events');
    
    // Find events that are stuck in 'deleting'
    const snapshot = await eventsRef
      .where('status', '==', 'deleting')
      .limit(20)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No stuck deletions found' });
    }

    const results = {
      recovered: 0,
      failed: 0,
      details: []
    };

    const now = Date.now();

    for (const doc of snapshot.docs) {
      const eventId = doc.id;
      const event = doc.data();

      // Only attempt recovery if the lease has expired
      const lease = event.deletionLease || 0;
      if (now >= lease) {
        try {
          await processEventDeletion(eventId);
          results.recovered++;
          results.details.push({ id: eventId, status: 'recovered' });
        } catch (err) {
          results.failed++;
          results.details.push({ id: eventId, status: 'failed', error: err.message });
        }
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error('Cron deletion recovery failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
