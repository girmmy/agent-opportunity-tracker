import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Second line of defense.
 *
 * middleware.ts already blocks unauthenticated requests, but Next.js has had
 * real middleware-bypass vulnerabilities in the past (GHSA-f82v-jwr5-mffw let
 * an attacker skip middleware entirely with a crafted header). Auth that lives
 * in exactly one place fails completely the moment that one place is bypassed,
 * so every route that touches data re-checks the session itself.
 *
 * Returns a 401 response when the caller isn't authenticated, or null when they
 * are — so handlers can `const denied = await requireSession(); if (denied) return denied;`
 */
export async function requireSession(): Promise<NextResponse | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Server is missing AUTH_SECRET.' },
      { status: 500 }
    );
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, secret)) return null;

  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}

/** Boolean form, for server components that render rather than return a response. */
export async function hasSession(): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, secret);
}
