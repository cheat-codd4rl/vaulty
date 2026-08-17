import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request) {
  try {
    const { deviceToken } = await request.json();
    if (!deviceToken) {
      return NextResponse.json({ error: 'Device token required' }, { status: 400 });
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
    if (!hostId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 2. Fetch all legacy events created by this device that do not have a hostId
    const eventsSnap = await adminDb.collection('events')
      .where('creatorToken', '==', deviceToken)
      .get();
      
    const batch = adminDb.batch();
    let count = 0;
    
    eventsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.hostId) {
        batch.update(doc.ref, { hostId });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error('Migration failed:', err);
    return NextResponse.json({ error: 'Failed to migrate events' }, { status: 500 });
  }
}
