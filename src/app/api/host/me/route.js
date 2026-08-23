import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt, signJwt } from '@/lib/auth';

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

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
    const responseData = { 
      authenticated: true, 
      hostId, 
      name: hostData.name, 
      email: hostData.email 
    };

    // --- Sliding expiration ---
    // If less than 7 days remain on the token, re-sign a fresh 30-day token.
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = decoded.exp - now;

    if (timeRemaining < SEVEN_DAYS_S) {
      const freshToken = signJwt(
        { hostId, role: 'host' },
        { expiresIn: '30d' }
      );

      const res = NextResponse.json(responseData);

      res.cookies.set('vaulty_host_session', freshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: THIRTY_DAYS_S,
      });

      // Sync refreshed token to host_sessions so multi-account switch
      // never finds a stale/expired token for this host.
      await adminDb.collection('host_sessions').doc(hostId).set({
        hostId,
        token: freshToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + THIRTY_DAYS_S * 1000,
      });

      return res;
    }

    return NextResponse.json(responseData);
  } catch (err) {
    console.error('Failed to fetch host me:', err);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
