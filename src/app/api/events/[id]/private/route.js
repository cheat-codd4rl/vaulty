import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    if (!match) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyJwt(match[1]);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { hostId } = decoded;

    const eventRef = adminDb.collection('events').doc(id);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (eventDoc.data().hostId !== hostId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const privateDoc = await eventRef.collection('security').doc('private').get();
    if (!privateDoc.exists) {
      return NextResponse.json({ error: 'Private details not found' }, { status: 404 });
    }

    const privateData = privateDoc.data();
    
    return NextResponse.json({ 
      inviteToken: privateData.inviteToken,
      collaboratorCode: privateData.collaboratorCode,
      // Do not return pinHash! Only opaque tokens.
    });
  } catch (err) {
    console.error('Private fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch private details' }, { status: 500 });
  }
}
