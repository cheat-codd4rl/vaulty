/*
  API Route: POST /api/events

  Creates a new event in Firestore AND its Drive folder atomically.
  The folder is created here (once) rather than at upload time, which
  eliminates the race condition where concurrent uploads to a new event
  each create their own folder.

  Request body (JSON):
    { name, date, accessMode, moderationMode, photographerName, deviceToken }

  Response:
    { id, name, date, ..., driveFolderId }
*/

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { createEventFolder } from '@/lib/drive';
import bcrypt from 'bcryptjs';
import { signJwt, verifyJwt } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      name, date, cover, accessMode, moderationMode, photographerName, deviceToken, 
      hostEmail, hostName, hostPassword 
    } = body;

    if (!name || !deviceToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Resolve Host Session
    let hostId = null;
    let newHostToken = null;
    let isNewHost = false;

    // Check for existing session
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    if (match) {
      try {
        const decoded = verifyJwt(match[1]);
        hostId = decoded.hostId;
      } catch (err) {
        // invalid token
      }
    }

    if (!hostId) {
      // Must create a new Host Profile
      if (!hostEmail || !hostName || !hostPassword || hostPassword.length < 6) {
        return NextResponse.json({ error: 'Host email, name, and a secure password (min 6 chars) are required for new hosts.' }, { status: 400 });
      }

      const emailLower = hostEmail.toLowerCase().trim();
      
      // Check if email already exists
      const existingHost = await adminDb.collection('hosts').where('email', '==', emailLower).limit(1).get();
      if (!existingHost.empty) {
        return NextResponse.json({ error: 'An account with this email already exists. Please log in.' }, { status: 409 });
      }

      // Create new host
      hostId = 'host_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const passwordHash = await bcrypt.hash(hostPassword, 12);
      
      await adminDb.collection('hosts').doc(hostId).set({
        email: emailLower,
        name: hostName.trim(),
        passwordHash,
        createdAt: Date.now()
      });

      // Generate JWT for the new host
      newHostToken = signJwt({ hostId, role: 'host' }, { expiresIn: '30d' });
      isNewHost = true;

      // Persist session for multi-account switching
      await adminDb.collection('host_sessions').doc(hostId).set({
        hostId,
        token: newHostToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
    }

    // 2. Generate Event IDs and Credentials
    const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const collaboratorCode = Math.random().toString(36).slice(2, 10);
    
    // Generate unique 6-8 char join code
    let code = '';
    let isCodeUnique = false;
    let attempts = 0;
    while (!isCodeUnique && attempts < 5) {
      code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const existing = await adminDb.collection('events').where('code', '==', code).limit(1).get();
      if (existing.empty) {
        isCodeUnique = true;
      }
      attempts++;
    }
    if (!isCodeUnique) {
      code = Math.random().toString(36).slice(2, 10).toUpperCase(); // fallback to longer if collision heavy
    }
    
    // Generate 128-bit opaque invite token (32 hex chars)
    const crypto = await import('crypto');
    const inviteToken = crypto.randomBytes(16).toString('hex');
    
    // Generate 6-digit PIN if required
    let rawPin = null;
    let pinHash = null;
    if (accessMode === 'pin') {
      rawPin = String(Math.floor(100000 + Math.random() * 900000));
      pinHash = await bcrypt.hash(rawPin, 10);
    }

    // 3. Create Drive folder
    let driveFolderId = null;
    try {
      driveFolderId = await createEventFolder(id, name);
    } catch (err) {
      if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') {
        throw err; // Bubble up to outer catch block to fail event creation
      }
      console.error('Drive folder creation failed:', err.message);
    }

    // 4. Create Event Document
    const event = {
      id,
      code,
      inviteToken,
      name,
      date: date || '',
      cover: cover || null,
      accessMode: accessMode || 'open',
      hasPin: accessMode === 'pin',
      moderationMode: moderationMode || 'auto',
      collaboratorCode,
      photographerName: photographerName || '',
      hostId, // The true owner of the event
      driveFolderId,
      createdAt: Date.now(),
    };

    const batch = adminDb.batch();
    const eventRef = adminDb.collection('events').doc(id);
    batch.set(eventRef, event);

    const privateRef = eventRef.collection('security').doc('private');
    batch.set(privateRef, {
      creatorToken: deviceToken,
      collaboratorCode,
      inviteToken,
      pinHash
    });

    await batch.commit();

    const res = NextResponse.json({ ...event, isNewHost, rawPin });

    // Set cookie if a new host was registered
    if (newHostToken) {
      res.cookies.set('vaulty_host_session', newHostToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      });
    }

    return res;
  } catch (err) {
    console.error('Event creation failed:', err);
    if (err.code === 'DRIVE_AUTH_REVOKED' || err.message === 'DRIVE_AUTH_REVOKED') {
      return NextResponse.json({ error: 'Service Configuration Error: The underlying Google Drive integration needs to be reconnected by the administrator.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
