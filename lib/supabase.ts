import { createClient } from '@supabase/supabase-js';

/**
 * The privileged, server-side key.
 *
 * Supabase renamed these in 2025: the dashboard now shows "Publishable" and
 * "Secret" keys instead of `anon` and `service_role`. The Secret key
 * (`sb_secret_…`) is the drop-in replacement for `service_role` — same
 * RLS-bypassing privileges, same usage with createClient.
 *
 * Both names are accepted so the app works whether the project predates the
 * rename or not. `SUPABASE_SECRET_KEY` is preferred because it matches what the
 * dashboard actually says today.
 */
function secretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Reduce whatever was pasted to the project origin.
 *
 * The dashboard shows several URLs, and the "Data API" one
 * (`https://<ref>.supabase.co/rest/v1/`) is an easy thing to grab by mistake.
 * supabase-js appends `/rest/v1/` itself, so that produces a doubled path and
 * a genuinely unhelpful "Invalid path specified in request URL" error.
 * Normalizing here means either form works.
 */
export function normalizeSupabaseUrl(raw: string): string {
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

/**
 * Server-only Supabase client.
 *
 * This key bypasses row-level security, so it must never reach the browser —
 * that's why the env var has no NEXT_PUBLIC_ prefix and why every caller is a
 * route handler or server component. RLS is enabled on the table with no
 * policies, so this key is the only way in.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = secretKey();

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SECRET_KEY (the "Secret" key in Supabase → Settings → API Keys). ' +
        'See .env.example.'
    );
  }

  return createClient(normalizeSupabaseUrl(url), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when Supabase env vars are present, so pages can show a setup hint
 *  instead of crashing before the project has been wired up. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && secretKey());
}
