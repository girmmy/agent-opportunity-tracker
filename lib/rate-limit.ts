import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export interface RateLimitResult {
  locked: boolean;
  recentFailures: number;
  retryAfterSeconds: number;
}

/**
 * In-memory fallback, used only when the database is unreachable.
 *
 * This is strictly weaker than the Postgres path — it's per-instance and dies
 * with the process — but failing open entirely would turn a database blip into
 * an unlimited guessing window, so some limit is better than none.
 */
const memory = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function memoryLimit(ip: string, succeeded: boolean): RateLimitResult {
  const now = Date.now();
  const existing = (memory.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  // Same ordering rule as the SQL version: judge the lockout on prior state, so
  // a correct password can't walk through an active lockout.
  if (existing.length >= MAX_ATTEMPTS) {
    memory.set(ip, existing);
    return {
      locked: true,
      recentFailures: existing.length,
      retryAfterSeconds: Math.max(
        0,
        Math.ceil((existing[0]! + WINDOW_MS - now) / 1000)
      ),
    };
  }

  if (succeeded) {
    memory.delete(ip);
    return { locked: false, recentFailures: 0, retryAfterSeconds: 0 };
  }

  existing.push(now);
  memory.set(ip, existing);

  return {
    locked: existing.length >= MAX_ATTEMPTS,
    recentFailures: existing.length,
    retryAfterSeconds: Math.max(
      0,
      Math.ceil((existing[0]! + WINDOW_MS - now) / 1000)
    ),
  };
}

/**
 * Record a login attempt and report whether this IP is now locked out.
 *
 * Counting and inserting happen in one database call (see
 * `record_login_attempt`) so concurrent guesses can't race past the threshold.
 */
export async function recordLoginAttempt(
  ip: string,
  succeeded: boolean
): Promise<RateLimitResult> {
  if (!isSupabaseConfigured()) return memoryLimit(ip, succeeded);

  try {
    const { data, error } = await supabaseAdmin().rpc('record_login_attempt', {
      p_ip: ip,
      p_succeeded: succeeded,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return memoryLimit(ip, succeeded);

    return {
      locked: Boolean(row.locked),
      recentFailures: Number(row.recent_failures ?? 0),
      retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
    };
  } catch {
    // Database unavailable — degrade to the in-memory limiter rather than
    // letting attempts through unchecked.
    return memoryLimit(ip, succeeded);
  }
}

/**
 * Best-effort client IP.
 *
 * On Vercel `x-forwarded-for` is set by the platform edge and the leftmost
 * entry is the real client. Self-hosted behind an untrusted proxy this header
 * is spoofable, which is one reason the password hash — not this limiter — is
 * the actual security boundary.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
