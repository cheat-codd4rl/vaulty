import { NextResponse } from 'next/server';

export function middleware(request) {
  // Only apply to state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    // Only protect API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');

      if (process.env.NODE_ENV === 'production') {
        if (origin) {
          try {
            const originUrl = new URL(origin);
            if (originUrl.host !== host) {
              console.warn(`CSRF protection rejected request to ${request.nextUrl.pathname} from origin ${origin}. Expected host ${host}`);
              return NextResponse.json({ error: 'Forbidden: CSRF protection' }, { status: 403 });
            }
          } catch (e) {
            return NextResponse.json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
          }
        }
        return NextResponse.next();
      }

      // Fallback for local development
      if (origin) {
        try {
          const originUrl = new URL(origin);
          if (originUrl.host === host) {
            return NextResponse.next();
          }
        } catch (e) {}
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
