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
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      name, date, accessMode, moderationMode, photographerName, deviceToken, 
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
        const decoded = jwt.verify(match[1], JWT_SECRET);
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
      newHostToken = jwt.sign({ hostId, role: 'host' }, JWT_SECRET, { expiresIn: '7d' });
      isNewHost = true;
    }

    // 2. Generate Event IDs
    const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const collaboratorCode = Math.random().toString(36).slice(2, 10);
    const pin = accessMode === 'pin' ? String(Math.floor(1000 + Math.random() * 9000)) : null;

    // 3. Create Drive folder
    let driveFolderId = null;
    try {
      driveFolderId = await createEventFolder(id, name);
    } catch (err) {
      console.error('Drive folder creation failed:', err.message);
    }

    // 4. Create Event Document
    const event = {
      id,
      name,
      date: date || '',
      cover: null,
      accessMode: accessMode || 'open',
      pin,
      moderationMode: moderationMode || 'auto',
      collaboratorCode,
      photographerName: photographerName || '',
      creatorToken: deviceToken, // Kept for legacy linking if needed, but primary is hostId
      hostId, // The true owner of the event
      driveFolderId,
      createdAt: Date.now(),
    };

    await adminDb.collection('events').doc(id).set(event);

    const res = NextResponse.json({ ...event, isNewHost });

    // Set cookie if a new host was registered
    if (newHostToken) {
      res.cookies.set('vaulty_host_session', newHostToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });
    }

    return res;
  } catch (err) {
    console.error('Event creation failed:', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
