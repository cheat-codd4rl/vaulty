import { NextResponse } from 'next/server';

export function middleware(request) {
  // Only apply to state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    // Only protect API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');

      const allowedOrigin = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
      
      if (process.env.NODE_ENV === 'production') {
        if (!allowedOrigin) {
          console.error('[CRITICAL] CSRF Middleware: APP_ORIGIN is not configured in production.');
          return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
        if (origin !== allowedOrigin) {
          console.warn(`CSRF protection rejected request to ${request.nextUrl.pathname} from origin ${origin}. Expected ${allowedOrigin}`);
          return NextResponse.json({ error: 'Forbidden: CSRF protection' }, { status: 403 });
        }
        return NextResponse.next();
      }

      // Fallback for local development
      if (allowedOrigin && origin === allowedOrigin) {
        return NextResponse.next();
      }

      const secFetchSite = request.headers.get('sec-fetch-site');
      if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
        return NextResponse.next();
      }

      console.warn(`CSRF protection rejected request to ${request.nextUrl.pathname} from origin ${origin}, sec-fetch-site ${secFetchSite}`);
      return NextResponse.json({ error: 'Forbidden: CSRF protection' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
