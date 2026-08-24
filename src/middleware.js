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
  // Check if the request is coming from Cloudflare
  // In Next.js, the connecting IP is sometimes available in request.ip
  // or the x-forwarded-for header (depending on hosting provider).
  // Note: On Vercel, request.ip is the client's IP, so this might block legitimate users
  // if Vercel parses the headers before this middleware runs.
  // If hosted on a VPS/Docker, x-forwarded-for will contain the chain.
  const clientIp = request.ip || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  
  if (clientIp) {
    // In production, we enforce the Cloudflare IP check
    if (process.env.NODE_ENV === 'production') {
      const isCloudflareV4 = isIpInRanges(clientIp, cloudflareIpv4Ranges);
      const isCloudflareV6 = isIpInRanges(clientIp, cloudflareIpv6Ranges);
      
      if (!isCloudflareV4 && !isCloudflareV6) {
        console.warn(`Blocked request from non-Cloudflare IP: ${clientIp}`);
        return NextResponse.json({ error: 'Forbidden: Direct IP access not allowed. Please use the Cloudflare domain.' }, { status: 403 });
      }
    }
  }

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
