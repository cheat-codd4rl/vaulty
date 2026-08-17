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
    const { name, date, accessMode, moderationMode, photographerName, deviceToken, host_password } = body;

    if (!name || !deviceToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!host_password || host_password.length < 6) {
      return NextResponse.json({ error: 'Host password must be at least 6 characters long' }, { status: 400 });
    }

    // Generate IDs
    const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const collaboratorCode = Math.random().toString(36).slice(2, 10);
    const pin = accessMode === 'pin' ? String(Math.floor(1000 + Math.random() * 9000)) : null;

    // Create the Drive folder for this event
    let driveFolderId = null;
    try {
      driveFolderId = await createEventFolder(id, name);
    } catch (err) {
      console.error('Drive folder creation failed:', err.message);
    }

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
      creatorToken: deviceToken,
      driveFolderId,
      createdAt: Date.now(),
    };

    let hostToken = null;
    let hostPasswordSet = false;

    // Handle password
    if (host_password) {
      event.hostPasswordHash = await bcrypt.hash(host_password, 12);
      hostPasswordSet = true;
      
      // Issue JWT
      hostToken = jwt.sign(
        { event_id: id, role: 'host' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
    }

    await adminDb.collection('events').doc(id).set(event);

    const responsePayload = { ...event };
    if (hostPasswordSet) {
      responsePayload.host_token = hostToken;
      responsePayload.host_password_set = true;
    } else {
      responsePayload.host_password_set = false;
    }

    const res = NextResponse.json(responsePayload);

    // Set cookie if token was generated
    if (hostToken) {
      res.cookies.set(`vaulty_host_${id}`, hostToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 days in seconds
      });
    }

    return res;
  } catch (err) {
    console.error('Event creation failed:', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
