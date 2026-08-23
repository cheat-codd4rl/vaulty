/**
 * GET /api/events/resolve?code=XYZ
 *
 * Lightweight public endpoint that resolves a short event code
 * to an event ID. Rate-limited per IP via the shared utility.
 */

import { NextResponse } from 'next/server';
import { resolveEventByCode } from '@/lib/resolveEventByCode';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code || code.trim().length < 4) {
      return NextResponse.json(
        { error: 'A valid event code is required' },
        { status: 400 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown_ip';
    const result = await resolveEventByCode(code, ip);

    if (!result) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (result.rateLimited) {
      return NextResponse.json(
        { error: 'Too many attempts, try again later' },
        { status: 429 }
      );
    }

    return NextResponse.json({
      id: result.eventId,
      name: result.eventName,
    });
  } catch (err) {
    console.error('Event resolve error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
