import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function POST(request) {
  try {
    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/vaulty_host_session=([^;]+)/);
    if (!match) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(match[1], JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { hostId } = decoded;
    if (!hostId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const hostRef = adminDb.collection('hosts').doc(hostId);
    const hostDoc = await hostRef.get();

    if (!hostDoc.exists) {
      return NextResponse.json({ error: 'Host profile not found' }, { status: 404 });
    }

    const host = hostDoc.data();
    
    // Verify current password
    if (currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, host.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Incorrect current password' }, { status: 403 });
      }
    } else {
       return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await hostRef.update({ passwordHash });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password change failed:', err);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
