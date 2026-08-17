import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { new_password, deviceToken } = body;

    if (!new_password) {
      return NextResponse.json({ error: 'Missing new_password' }, { status: 400 });
    }

    // Auth Validation
    // We accept either a valid JWT cookie OR a valid deviceToken (legacy fallback)
    let isAuthorized = false;

    // 1. Check JWT Cookie
    const cookieToken = request.cookies.get(`vaulty_host_${id}`)?.value;
    if (cookieToken) {
      try {
        const decoded = jwt.verify(cookieToken, JWT_SECRET);
        if (decoded.event_id === id && decoded.role === 'host') {
          isAuthorized = true;
        }
      } catch (err) {
        // invalid token, fallback to deviceToken check
      }
    }

    // 2. Check Auth Header (for Android App)
    const authHeader = request.headers.get('authorization');
    if (!isAuthorized && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.event_id === id && decoded.role === 'host') {
          isAuthorized = true;
        }
      } catch (err) {
        // invalid token
      }
    }

    // 3. Fallback to deviceToken
    if (!isAuthorized && deviceToken) {
      const eventDoc = await adminDb.collection('events').doc(id).get();
      if (eventDoc.exists && eventDoc.data().creatorToken === deviceToken) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Update Password
    const hostPasswordHash = await bcrypt.hash(new_password, 12);
    
    await adminDb.collection('events').doc(id).update({
      hostPasswordHash
    });

    return new NextResponse(null, { status: 204 });

  } catch (err) {
    console.error('Set host password error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
