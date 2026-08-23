/**
 * resolveHost.js
 *
 * Shared helper for extracting and verifying the host identity
 * from the vaulty_host_session cookie. Used by /api/host/me,
 * /api/host/switch, event creation, and anywhere else that
 * needs to know "who is the current host?".
 */

import { verifyJwt } from '@/lib/auth';

/**
 * Extract and verify the host session from the request cookie.
 *
 * @param {Request} request — the incoming Next.js request
 * @returns {{ hostId: string, decoded: object } | null}
 */
export function getHostFromCookie(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
  if (!match) return null;

  try {
    const decoded = verifyJwt(match[1]);
    if (!decoded.hostId) return null;
    return { hostId: decoded.hostId, decoded };
  } catch {
    return null;
  }
}
