import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  createSessionToken,
  isWellFormedHash,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth';
import { clientIp, recordLoginAttempt } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const hash = process.env.APP_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;

  if (!hash || !secret) {
    return NextResponse.json(
      { error: 'Server is missing APP_PASSWORD_HASH or AUTH_SECRET.' },
      { status: 500 }
    );
  }

  // Distinguish "bad password" from "the stored hash is corrupted". Without
  // this, a mangled env var looks exactly like a wrong password.
  if (!isWellFormedHash(hash)) {
    return NextResponse.json(
      {
        error:
          'APP_PASSWORD_HASH is malformed. Re-run `npm run hash-password` and ' +
          'copy the whole value, including the pbkdf2: prefix.',
      },
      { status: 500 }
    );
  }

  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const ip = clientIp(request);

  const valid = password ? await verifyPassword(password, hash) : false;

  // Record before branching, so a locked-out IP still accrues attempts and
  // can't probe by watching which responses change.
  const limit = await recordLoginAttempt(ip, valid);

  // Refuse everything while locked — including the correct password. Letting a
  // valid guess through would make the lockout cosmetic.
  if (limit.locked) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      }
    );
  }

  if (!valid) {
    const left = Math.max(0, 10 - limit.recentFailures);
    return NextResponse.json(
      {
        error:
          left <= 3 && left > 0
            ? `Incorrect password. ${left} attempt${left === 1 ? '' : 's'} left.`
            : 'Incorrect password.',
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(secret),
    sessionCookieOptions()
  );
  return response;
}
