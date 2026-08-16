/*
  Firebase Admin SDK — server-side only.

  Used by API routes to write directly to Firestore with full privileges.

  Supports credentials via:
  1. Inline JSON in GOOGLE_APPLICATION_CREDENTIALS env var (for hosting platforms)
  2. File path in GOOGLE_APPLICATION_CREDENTIALS (for local dev with service account)
  3. Application Default Credentials (when running on GCP)

  Exports both `getAdminFirestore()` (lazy getter) and `adminDb` (pre-initialized
  getter) for convenience — API routes can use either.
*/

import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let _db = null;

export function getAdminFirestore() {
  if (_db) return _db;

  if (!getApps().length) {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (credentials) {
      const creds = credentials.trim();
      if (creds.startsWith('{')) {
        // Inline JSON (e.g. Vercel, Cloud Run)
        initializeApp({
          credential: cert(JSON.parse(creds)),
          projectId,
        });
      } else {
        // File path (local dev with service account)
        const fs = require('fs');
        const serviceAccount = JSON.parse(fs.readFileSync(creds, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      // Application Default Credentials (running on GCP)
      initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    }
  }

  _db = getFirestore();
  return _db;
}

// Convenience alias — matches the import name the API routes use.
// Calls getAdminFirestore() on first access, so the app initializes lazily.
export const adminDb = new Proxy({}, {
  get(_, prop) {
    const db = getAdminFirestore();
    const val = db[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  },
});
