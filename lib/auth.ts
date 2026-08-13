/**
 * Auth for a single-user app.
 *
 * Threat model: this thing sits at a public Vercel URL. The only real
 * requirement is that someone who finds the URL sees a login screen and
 * nothing else — no data in the HTML, no data reachable from the API.
 *
 * How that's achieved:
 *   - The password is never in the codebase. Only a PBKDF2 hash lives in an
 *     env var, generated locally by `npm run hash-password`.
 *   - The session cookie is HMAC-signed, so it can't be forged by editing it,
 *     and httpOnly, so page scripts can't read it.
 *   - middleware.ts rejects unauthenticated requests before any page or data
 *     route runs, so an unauthenticated response never contains real data.
 *
 * Everything here uses Web Crypto only (no native deps) so it runs in the
 * edge runtime that middleware uses.
 */

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-HMAC-SHA256
const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'got_session';

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Compare without leaking match position through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

/**
 * Field delimiter for the stored hash.
 *
 * Deliberately ':' and not the conventional '$'. Env file loaders (dotenv, and
 * therefore Next's @next/env) perform shell-style variable expansion, so a
 * value like `pbkdf2$210000$abc$def` gets silently mangled on the way in — the
 * `$210000` reads as a variable reference and expands to nothing. That
 * produces the worst possible symptom: the app loads fine and simply rejects
 * the correct password. ':' is untouched by every loader and is not in the
 * base64 alphabet, so it can't collide with the payload.
 */
const DELIM = ':';
const PREFIX = 'pbkdf2';

/** Produce the string stored in APP_PASSWORD_HASH. Used by the CLI script. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return [PREFIX, PBKDF2_ITERATIONS, b64(salt), b64(hash)].join(DELIM);
}

/** True when the stored value is structurally a hash we can check against. */
export function isWellFormedHash(stored: string | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(DELIM);
  return (
    parts.length === 4 &&
    parts[0] === PREFIX &&
    Number.isFinite(Number(parts[1])) &&
    Number(parts[1]) > 0 &&
    parts[2].length > 0 &&
    parts[3].length > 0
  );
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (!isWellFormedHash(stored)) return false;
  const parts = stored.split(DELIM);

  const iterations = Number(parts[1]);

  let salt: Uint8Array;
  try {
    salt = unb64(parts[2]);
  } catch {
    return false;
  }

  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(b64(actual), parts[3]);
}

// ----------------------------------------------------------------- session --

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return b64(new Uint8Array(sig));
}

/** Cookie value: "<expiresAtMs>.<signature>" */
export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiresAt);
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;

  const idx = token.indexOf('.');
  if (idx < 1) return false;

  const payload = token.slice(0, idx);
  const signature = token.slice(idx + 1);

  const expected = await sign(payload, secret);
  if (!timingSafeEqual(signature, expected)) return false;

  // Signature is valid, so the expiry is trustworthy — now check it.
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
