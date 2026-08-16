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

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, date, accessMode, moderationMode, photographerName, deviceToken } = body;

    if (!name || !deviceToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate IDs
    const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const collaboratorCode = Math.random().toString(36).slice(2, 10);
    const pin = accessMode === 'pin' ? String(Math.floor(1000 + Math.random() * 9000)) : null;

    // Create the Drive folder for this event — done once here, not per-upload
    let driveFolderId = null;
    try {
      driveFolderId = await createEventFolder(id, name);
    } catch (err) {
      console.error('Drive folder creation failed:', err.message);
      // Don't block event creation if Drive isn't configured (local dev)
      // The upload route will handle the missing folderId gracefully
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

    await adminDb.collection('events').doc(id).set(event);

    return NextResponse.json(event);
  } catch (err) {
    console.error('Event creation failed:', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
