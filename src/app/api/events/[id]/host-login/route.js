import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: 'Missing password' }, { status: 400 });
    }

    // Rate Limiting Transaction
    const attemptRef = adminDb.collection('events').doc(id).collection('security').doc('loginAttempts');
    const now = Date.now();
    
    let lockedOut = false;
    let retryAfter = 0;

    await adminDb.runTransaction(async (t) => {
      const doc = await t.get(attemptRef);
      if (doc.exists) {
        const data = doc.data();
        if (data.lockedUntil && data.lockedUntil > now) {
          lockedOut = true;
          retryAfter = Math.ceil((data.lockedUntil - now) / 1000);
          return;
        }

        let attempts = data.attempts || 0;
        
        // Reset attempts if lockout expired
        if (data.lockedUntil && data.lockedUntil <= now) {
          attempts = 0;
        }

        if (attempts >= MAX_ATTEMPTS) {
          lockedOut = true;
          const lockedUntil = now + (LOCKOUT_MINUTES * 60 * 1000);
          retryAfter = LOCKOUT_MINUTES * 60;
          
          t.set(attemptRef, {
            attempts,
            lockedUntil,
            expireAt: new Date(lockedUntil + 24 * 60 * 60 * 1000) // Keep for 24h for TTL
          }, { merge: true });
          return;
        }

        t.set(attemptRef, {
          attempts: attempts + 1,
          lastAttempt: now,
          expireAt: new Date(now + 24 * 60 * 60 * 1000)
        }, { merge: true });
      } else {
        t.set(attemptRef, {
          attempts: 1,
          lastAttempt: now,
          expireAt: new Date(now + 24 * 60 * 60 * 1000)
        });
      }
    });

    if (lockedOut) {
      return NextResponse.json(
        { error: 'too_many_attempts', retry_after_seconds: retryAfter }, 
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // Verify Password
    const eventDoc = await adminDb.collection('events').doc(id).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
    }

    const event = eventDoc.data();

    if (!event.hostPasswordHash) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, event.hostPasswordHash);

    if (!isMatch) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    // Success! Reset attempts
    await attemptRef.delete();

    // Issue JWT
    const hostToken = jwt.sign(
      { event_id: id, role: 'host' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const res = NextResponse.json({
      host_token: hostToken,
      expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      event: {
        name: event.name,
        event_code: event.id
      }
    });

    // Set Cookie
    res.cookies.set(`vaulty_host_${id}`, hostToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    });

    return res;

  } catch (err) {
    console.error('Host login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
