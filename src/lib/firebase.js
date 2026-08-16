/*
  Firebase configuration — Firestore only.
  
  Replace these values with your real Firebase project config
  from https://console.firebase.google.com → Project Settings → Your apps → Web app.
  
  File storage is handled by Google Cloud Storage directly (see lib/gcs.js),
  not Firebase Storage.
  
  Until you add real credentials, the app will fall back to
  localStorage so you can still develop and test locally.
*/

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
};

/* We only initialize Firebase if real credentials are provided */
export function isFirebaseConfigured() {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app = null;
let db = null;

export async function getFirebaseApp() {
  if (app) return app;
  if (!isFirebaseConfigured()) return null;
  const { initializeApp } = await import('firebase/app');
  app = initializeApp(firebaseConfig);
  return app;
}

export async function getFirestore() {
  if (db) return db;
  const fbApp = await getFirebaseApp();
  if (!fbApp) return null;
  const { getFirestore: getFs } = await import('firebase/firestore');
  db = getFs(fbApp);
  return db;
}

export default firebaseConfig;
