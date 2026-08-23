/**
 * POST /api/host/switch
 *
 * Switches the active host session cookie to a different account.
 * Looks up the stored token in host_sessions/{hostId}, verifies
 * it's still valid, and sets it as the new cookie.
 *
 * Request body: { hostId }
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyJwt } from '@/lib/auth';

export async function POST(request) {
  try {
    const { hostId } = await request.json();

    if (!hostId) {
      return NextResponse.json({ error: 'hostId is required' }, { status: 400 });
    }

    // Look up stored session
    const sessionDoc = await adminDb.collection('host_sessions').doc(hostId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'No saved session for this account. Please log in again.' },
        { status: 401 }
      );
    }

    const { token, expiresAt } = sessionDoc.data();

    // Check expiry (belt-and-suspenders: check both the Firestore field and the JWT itself)
    if (expiresAt && Date.now() > expiresAt) {
      // Clean up stale session
      await adminDb.collection('host_sessions').doc(hostId).delete();
      return NextResponse.json(
        { error: 'Session has expired. Please log in again.' },
        { status: 401 }
      );
    }

    // Verify the JWT is still cryptographically valid
    try {
      verifyJwt(token);
    } catch {
      await adminDb.collection('host_sessions').doc(hostId).delete();
      return NextResponse.json(
        { error: 'Session is no longer valid. Please log in again.' },
        { status: 401 }
      );
    }

    // Set the stored token as the active session cookie
    const res = NextResponse.json({ success: true, hostId });

    res.cookies.set('vaulty_host_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return res;
  } catch (err) {
    console.error('Host switch failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
