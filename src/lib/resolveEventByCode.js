/**
 * resolveEventByCode(code, ip)
 *
 * Shared server utility that resolves a short alphanumeric event code
 * to its Firestore event document. Includes IP-based rate limiting.
 *
 * Returns:
 *   { eventId, eventName, eventRef, eventData, privateData }   on success
 *   { rateLimited: true }                                       if IP exceeded threshold
 *   null                                                        if code not found
 */

import { adminDb } from '@/lib/firebaseAdmin';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

/**
 * @param {string} code  — the short event code (e.g. "A3BX9F")
 * @param {string} [ip]  — caller's IP for rate limiting; omit to skip rate check
 */
export async function resolveEventByCode(code, ip) {
  // --- Rate limiting ---
  if (ip) {
    const ipKey = ip.replace(/[.:#$/[\]]/g, '_');
    const rlRef = adminDb.collection('code_resolve_ratelimits').doc(ipKey);
    const rlDoc = await rlRef.get();

    if (rlDoc.exists) {
      const rl = rlDoc.data();
      if (rl.windowStart && Date.now() - rl.windowStart < WINDOW_MS) {
        if (rl.attempts >= MAX_ATTEMPTS) {
          return { rateLimited: true };
        }
        // Increment within window
        await rlRef.update({ attempts: (rl.attempts || 0) + 1 });
      } else {
        // Window expired — reset
        await rlRef.set({ attempts: 1, windowStart: Date.now() });
      }
    } else {
      await rlRef.set({ attempts: 1, windowStart: Date.now() });
    }
  }

  // --- Resolve code ---
  const inputCode = code.trim().toUpperCase();
  const eventQuery = await adminDb
    .collection('events')
    .where('code', '==', inputCode)
    .limit(1)
    .get();

  if (eventQuery.empty) {
    return null;
  }

  const eventDoc = eventQuery.docs[0];
  const eventRef = eventDoc.ref;
  const eventData = eventDoc.data();
  const eventId = eventRef.id;

  // Fetch security/private sub-doc (needed by the join flow)
  const privateDoc = await eventRef.collection('security').doc('private').get();
  const privateData = privateDoc.exists ? privateDoc.data() : null;

  return {
    eventId,
    eventName: eventData.name,
    eventRef,
    eventData,
    privateData,
  };
}
