/**
 * GET /api/events/[id]/guests
 *
 * Host-only endpoint returning the guest roster for an event.
 * Each guest doc already contains name, joinedAt, photoCount,
 * and lastUploadAt (incrementally updated at upload time).
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getHostFromCookie } from '@/lib/resolveHost';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Authenticate host
    const session = getHostFromCookie(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify this host owns the event
    const eventDoc = await adminDb.collection('events').doc(id).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data();
    if (eventData.hostId !== session.hostId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch guest roster
    const guestsSnap = await adminDb
      .collection('events')
      .doc(id)
      .collection('guests')
      .orderBy('joinedAt', 'desc')
      .get();

    const guests = guestsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Anonymous',
        joinedAt: data.joinedAt || data.createdAt || null,
        photoCount: data.photoCount || 0,
        lastUploadAt: data.lastUploadAt || null,
      };
    });

    return NextResponse.json({ guests });
  } catch (err) {
    console.error('Guests list error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
