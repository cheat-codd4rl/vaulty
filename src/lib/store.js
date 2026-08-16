/*
  Data store — Firestore-backed with localStorage fallback.

  Uses the Firebase client SDK for real-time reads from Firestore,
  and falls back to localStorage when Firebase isn't configured
  (so local dev without credentials still works).
*/

import { genId } from './helpers';
import { isFirebaseConfigured, getFirestore as getFs } from './firebase';

/* ═══════════════════════════════════════════════
   localStorage fallback (same as before)
   ═══════════════════════════════════════════════ */

function storeGet(key) {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(key);
    return v !== null ? v : null;
  } catch {
    return null;
  }
}

function storeSet(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota exceeded — silently fail */
  }
}

function storeDelete(key) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function storeList(prefix) {
  if (typeof window === 'undefined') return [];
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

/* ═══════════════════════════════════════════════
   Firestore helpers (lazy-loaded)
   ═══════════════════════════════════════════════ */

let _firestoreModules = null;

async function firestoreModules() {
  if (_firestoreModules) return _firestoreModules;
  const mod = await import('firebase/firestore');
  _firestoreModules = mod;
  return mod;
}

async function getDb() {
  return await getFs();
}

/* ═══════════════════════════════════════════════
   Event model
   ═══════════════════════════════════════════════ */

export async function createEvent(data) {
  const creatorToken = await getDeviceToken();

  const db = await getDb();
  if (db) {
    // Cloud mode: create event + Drive folder atomically via server route
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        date: data.date || '',
        accessMode: data.accessMode || 'open',
        moderationMode: data.moderationMode || 'auto',
        photographerName: data.photographerName || '',
        deviceToken: creatorToken,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Failed to create event');
    }
    return await res.json();
  }

  // Fallback: localStorage (local dev without cloud)
  const id = genId('evt_');
  const collaboratorCode = genId('').slice(-8);
  const pin = data.accessMode === 'pin' ? String(Math.floor(1000 + Math.random() * 9000)) : null;
  const event = {
    id,
    name: data.name,
    date: data.date || '',
    cover: data.cover || null,
    accessMode: data.accessMode,
    pin,
    moderationMode: data.moderationMode,
    collaboratorCode,
    photographerName: data.photographerName || '',
    creatorToken,
    createdAt: Date.now(),
  };
  storeSet('event:' + id, JSON.stringify(event));
  const list = JSON.parse(storeGet('hostEvents') || '[]');
  list.unshift(id);
  storeSet('hostEvents', JSON.stringify(list));
  return event;
}

export async function getEvent(id) {
  const db = await getDb();
  if (db) {
    const { doc, getDoc } = await firestoreModules();
    const snap = await getDoc(doc(db, 'events', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  // Fallback
  const v = storeGet('event:' + id);
  return v ? JSON.parse(v) : null;
}

export async function updateEvent(event) {
  const db = await getDb();
  if (db) {
    const { doc, updateDoc } = await firestoreModules();
    const { id, ...data } = event;
    await updateDoc(doc(db, 'events', id), data);
  } else {
    storeSet('event:' + event.id, JSON.stringify(event));
  }
}

export async function listHostEvents() {
  const db = await getDb();
  if (db) {
    const creatorToken = await getDeviceToken();
    const { collection, query, where, getDocs } = await firestoreModules();
    const q = query(
      collection(db, 'events'),
      where('creatorToken', '==', creatorToken)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sort in-memory so we don't require a Firebase composite index for where() + orderBy()
    return results.sort((a, b) => b.createdAt - a.createdAt);
  }
  // Fallback
  const ids = JSON.parse(storeGet('hostEvents') || '[]');
  const arr = [];
  for (const id of ids) {
    const e = await getEvent(id);
    if (e) arr.push(e);
  }
  return arr;
}

/* ═══════════════════════════════════════════════
   Uploads model
   ═══════════════════════════════════════════════ */

export async function addUploadRecord(u) {
  const db = await getDb();
  if (db) {
    const { doc, setDoc } = await firestoreModules();
    await setDoc(doc(db, 'events', u.eventId, 'uploads', u.id), u);
  } else {
    storeSet(`upload:${u.eventId}:${u.id}`, JSON.stringify(u));
    const mine = JSON.parse(storeGet('myUploads:' + u.eventId) || '[]');
    mine.push(u.id);
    storeSet('myUploads:' + u.eventId, JSON.stringify(mine));
  }
}

export async function listUploads(eventId) {
  const db = await getDb();
  if (db) {
    const { collection, getDocs, orderBy, query } = await firestoreModules();
    const q = query(
      collection(db, 'events', eventId, 'uploads'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  // Fallback
  const keys = storeList(`upload:${eventId}:`);
  const arr = [];
  for (const k of keys) {
    const v = storeGet(k);
    if (v) arr.push(JSON.parse(v));
  }
  arr.sort((a, b) => b.createdAt - a.createdAt);
  return arr;
}

export async function updateUploadRecord(u) {
  const db = await getDb();
  if (db) {
    const { doc, updateDoc } = await firestoreModules();
    const { id, eventId, ...data } = u;
    await updateDoc(doc(db, 'events', eventId, 'uploads', id), data);
  } else {
    storeSet(`upload:${u.eventId}:${u.id}`, JSON.stringify(u));
  }
}

export async function deleteUploadRecord(eventId, id) {
  const db = await getDb();
  if (db) {
    // Delete via server route — handles Drive file deletion + ownership check
    const deviceToken = await getDeviceToken();
    const res = await fetch('/api/upload/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, uploadId: id, deviceToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Delete failed');
    }
  } else {
    storeDelete(`upload:${eventId}:${id}`);
  }
}

export async function getMyUploadIds(eventId) {
  const db = await getDb();
  if (db) {
    // In Firestore mode, filter by deviceToken
    const deviceToken = await getDeviceToken();
    const { collection, query, where, getDocs } = await firestoreModules();
    const q = query(
      collection(db, 'events', eventId, 'uploads'),
      where('deviceToken', '==', deviceToken)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  }
  return JSON.parse(storeGet('myUploads:' + eventId) || '[]');
}

/* ═══════════════════════════════════════════════
   Device identity
   ═══════════════════════════════════════════════ */

export async function getDeviceToken() {
  let t = storeGet('deviceToken');
  if (!t) {
    t = genId('dev_');
    storeSet('deviceToken', t);
  }
  return t;
}

/* ═══════════════════════════════════════════════
   In-memory blob cache (still used for localStorage mode)
   ═══════════════════════════════════════════════ */

const sessionFiles = {};

export function getSessionFile(id) {
  return sessionFiles[id] || null;
}

export function setSessionFile(id, data) {
  sessionFiles[id] = data;
}

export function deleteSessionFile(id) {
  delete sessionFiles[id];
}

export function getAllSessionFiles() {
  return sessionFiles;
}
