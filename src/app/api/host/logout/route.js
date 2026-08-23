/**
 * POST /api/host/logout
 *
 * Logs out the current host (or a specific host by ID).
 * Clears the session cookie and deletes the host_sessions doc
 * so the account can't be switched back to without re-authenticating.
 *
 * Optional body: { hostId } — to log out a specific account.
 * If omitted, logs out whoever is currently in the cookie.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getHostFromCookie } from '@/lib/resolveHost';

export async function POST(request) {
  try {
    let targetHostId = null;

    // Try to read hostId from body (for logging out a specific account)
    try {
      const body = await request.json();
      targetHostId = body.hostId || null;
    } catch {
      // No body or invalid JSON — that's fine, fall through
    }

    // If no explicit hostId, use the one in the cookie
    if (!targetHostId) {
      const session = getHostFromCookie(request);
      if (session) {
        targetHostId = session.hostId;
      }
    }

    // Delete the server-side session so it can't be switched back to
    if (targetHostId) {
      try {
        await adminDb.collection('host_sessions').doc(targetHostId).delete();
      } catch {
        // Non-critical — cookie clear is what matters
      }
    }

    const res = NextResponse.json({ success: true });
    res.cookies.delete('vaulty_host_session');
    return res;
  } catch (err) {
    console.error('Logout error:', err);
    // Even on error, try to clear the cookie
    const res = NextResponse.json({ success: true });
    res.cookies.delete('vaulty_host_session');
    return res;
  }
}
