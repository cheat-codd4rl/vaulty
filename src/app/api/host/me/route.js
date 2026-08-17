import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    
    if (!match) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    let decoded;
    try {
      decoded = jwt.verify(match[1], JWT_SECRET);
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
