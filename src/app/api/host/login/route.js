import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import bcrypt from 'bcryptjs';
import { sendHostOtp } from '@/lib/otpService';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const hostEmail = email.toLowerCase().trim();

    // 1. Find the host profile
    const hostsRef = adminDb.collection('hosts');
    const snapshot = await hostsRef.where('email', '==', hostEmail).limit(1).get();

    if (snapshot.empty) {
      // Return a generic error to prevent email enumeration
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const hostDoc = snapshot.docs[0];
    const hostData = hostDoc.data();
    const hostId = hostDoc.id;

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, hostData.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 3. Rate limiting check for OTP generation
    const otpRef = adminDb.collection('host_otps').doc(hostId);
    const otpDoc = await otpRef.get();
    if (otpDoc.exists) {
      const otpData = otpDoc.data();
      // Simple rate limit: prevent generating a new OTP more than once per minute
      if (otpData.lastGeneratedAt && Date.now() - otpData.lastGeneratedAt < 60000) {
        return NextResponse.json({ error: 'Please wait before requesting a new code' }, { status: 429 });
      }
    }

    // 4. Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(code, 12);
    
    await otpRef.set({
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0,
      consumed: false,
      lastGeneratedAt: Date.now()
    });

    // 5. Deliver OTP
    await sendHostOtp(hostEmail, code);

    return NextResponse.json({ requiresOtp: true, hostId });

  } catch (err) {
    console.error('Host login failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
