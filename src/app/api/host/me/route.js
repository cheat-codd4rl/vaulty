import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    
    if (!match) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    let decoded;
    try {
      decoded = verifyJwt(match[1]);
    } catch (err) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const { hostId } = decoded;
    if (!hostId) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const hostDoc = await adminDb.collection('hosts').doc(hostId).get();
    if (!hostDoc.exists) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const hostData = hostDoc.data();
    return NextResponse.json({ 
      authenticated: true, 
      hostId, 
      name: hostData.name, 
      email: hostData.email 
    });
  } catch (err) {
    console.error('Failed to fetch host me:', err);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
