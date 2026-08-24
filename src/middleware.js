import { NextResponse } from 'next/server';
import ipaddr from 'ipaddr.js';
import { cloudflareIpv4Ranges, cloudflareIpv6Ranges } from '@/lib/cloudflare-ips';

// Helper to check if an IP is in a list of CIDR ranges
function isIpInRanges(ipString, ranges) {
  try {
    const ip = ipaddr.parse(ipString);
    for (const range of ranges) {
      const parsedRange = ipaddr.parseCIDR(range);
      if (ip.match(parsedRange)) {
        return true;
      }
    }
  } catch (err) {
    // Ignore invalid IPs
  }
  return false;
}

export function middleware(request) {
  // The Cloudflare IP check has been removed because Vercel automatically parses 
  // the X-Forwarded-For headers and sets request.ip to the user's actual IP address.
  // Checking the user's IP against Cloudflare's server IP ranges will always fail
  // and block legitimate users.
  
  // To restrict access on Vercel to only Cloudflare, the recommended approach is 
  // setting a secret header in Cloudflare Transform Rules and checking it here.

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
