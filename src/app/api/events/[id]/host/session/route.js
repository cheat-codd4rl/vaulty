import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vaulty_fallback_secret_change_me_in_production';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    let token = request.cookies.get(`vaulty_host_${id}`)?.value;

    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.event_id !== id || decoded.role !== 'host') {
        return NextResponse.json({ valid: false }, { status: 401 });
      }

      // Check if we need to refresh (if < 24h remaining)
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = decoded.exp - now;
      
      let res = NextResponse.json({ 
        valid: true, 
        expires_at: new Date(decoded.exp * 1000).toISOString() 
      });

      if (timeRemaining < 24 * 60 * 60) {
        // Refresh token
        const newToken = jwt.sign(
          { event_id: id, role: 'host' },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        res = NextResponse.json({ 
          valid: true, 
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
        });

        res.cookies.set(`vaulty_host_${id}`, newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60
        });
      }

      return res;
    } catch (err) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

  } catch (err) {
    console.error('Session validation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
