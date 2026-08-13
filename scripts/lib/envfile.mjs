import { readFile, writeFile, rename } from 'node:fs/promises';

export const ENV_PATH = new URL('../../.env.local', import.meta.url);

export function parseEnv(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export async function readEnvFile() {
  try {
    return await readFile(ENV_PATH, 'utf8');
  } catch {
    return null;
  }
}

/** Load .env.local into process.env without clobbering what's already set. */
export async function loadEnv() {
  const raw = await readEnvFile();
  if (!raw) return {};
  const parsed = parseEnv(raw);
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
  return parsed;
}

/**
 * Update keys in an env file, preserving everything else.
 *
 * Rewriting the file from a template would silently drop comments and any key
 * the template doesn't know about — including a person's own additions. So each
 * key is replaced in place, and only genuinely new ones get appended.
 */
export function upsertEnv(raw, updates) {
  let out = raw ?? '';
  const appended = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const line = `${key}=${value}`;
    // Only match an assignment at the start of a line, so a key named inside a
    // comment ("# APP_PASSWORD_HASH is …") isn't mistaken for the real one.
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(out)) {
      out = out.replace(re, line);
    } else {
      appended.push(line);
    }
  }

  if (appended.length) {
    if (out && !out.endsWith('\n')) out += '\n';
    out += appended.join('\n') + '\n';
  }
  return out;
}

/** Write atomically — a half-written .env.local locks you out of your own app. */
export async function writeEnvFile(contents) {
  const tmp = new URL('../../.env.local.tmp', import.meta.url);
  await writeFile(tmp, contents, { mode: 0o600 });
  await rename(tmp, ENV_PATH);
}

/**
 * Reduce a Supabase URL to its origin.
 *
 * The dashboard shows several URLs and the Data API one ends in /rest/v1/. The
 * client appends that path itself, so pasting it produces "Invalid path
 * specified in request URL" on every query — an error that names nothing you
 * can act on.
 */
export function normalizeSupabaseUrl(input) {
  let value = (input ?? '').trim().replace(/^["']|["']$/g, '');
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

/**
 * Tell a Supabase secret key from a publishable one.
 *
 * They look alike and sit next to each other in the dashboard, but a
 * publishable key is subject to row-level security — which this schema enables
 * with zero policies. So the wrong key doesn't error, it just returns no rows,
 * forever, and the app looks broken rather than misconfigured.
 */
export function classifySupabaseKey(key) {
  const k = (key ?? '').trim();
  if (!k) return 'missing';
  if (k.startsWith('sb_secret_')) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';

  // Older projects issue JWTs; the role lives in the payload.
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      );
      if (payload.role === 'service_role') return 'secret';
      if (payload.role === 'anon') return 'publishable';
    } catch {
      /* not a JWT we can read */
    }
  }
  return 'unknown';
}
