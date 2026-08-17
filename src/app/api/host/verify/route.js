import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request) {
  try {
    const { hostId, otp } = await request.json();
    if (!hostId || !otp) {
      return NextResponse.json({ error: 'Missing host ID or OTP' }, { status: 400 });
    }

    const otpRef = adminDb.collection('host_otps').doc(hostId);
    
    // We must run this in a transaction to prevent race conditions on attempt counts
    return await adminDb.runTransaction(async (transaction) => {
      const otpDoc = await transaction.get(otpRef);
      
      if (!otpDoc.exists) {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
      }

      const otpData = otpDoc.data();

      // 1. Check expiration
      if (Date.now() > otpData.expiresAt || otpData.consumed) {
        return NextResponse.json({ error: 'Code has expired or been used' }, { status: 401 });
      }

      // 2. Check attempts limit (e.g. max 5 attempts)
      if (otpData.attempts >= 5) {
        return NextResponse.json({ error: 'Too many failed attempts. Please login again.' }, { status: 429 });
      }

      // 3. Verify hash
      const isMatch = await bcrypt.compare(otp, otpData.otpHash);
      if (!isMatch) {
        transaction.update(otpRef, { attempts: otpData.attempts + 1 });
        return NextResponse.json({ error: 'Invalid code' }, { status: 401 });
      }

      // 4. Mark consumed
      transaction.update(otpRef, { consumed: true });

      // 5. Issue JWT
      const hostToken = jwt.sign(
        { hostId, role: 'host' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const res = NextResponse.json({ success: true, hostId });
      
      res.cookies.set('vaulty_host_session', hostToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 days in seconds
      });

      return res;
    });

  } catch (err) {
    console.error('OTP verification failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
