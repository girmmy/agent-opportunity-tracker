import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Gate every route except the login page and the routes needed to log in.
 * This runs before any page renders, so an unauthenticated request never
 * receives rendered data — the redirect happens first.
 */

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The agent endpoints authenticate with their own bearer token, checked by
  // agentAuthorized() in each route handler, so they opt out of cookie auth
  // here. Matched by prefix rather than by exact path: naming one route meant a
  // second agent route silently got the cookie gate and 401'd with a message
  // about a session it was never going to have. Every route under this prefix
  // must call agentAuthorized() — that check is the only gate they get.
  if (pathname.startsWith('/api/agent/')) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  const secret = process.env.AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authed = Boolean(secret) && (await verifySessionToken(token, secret!));

  if (isPublic) {
    // Already signed in? Skip the login screen.
    if (authed && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  // API routes get a clean 401 rather than an HTML redirect, so the client
  // can tell "session expired" apart from "request failed".
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
