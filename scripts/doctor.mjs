#!/usr/bin/env node
/**
 * Check a setup and explain anything wrong.  npm run doctor
 *
 * Read-only — it changes nothing.
 *
 * This exists because every misconfiguration here surfaces as a symptom that
 * doesn't name its cause. A '$' in the password hash reads as "my correct
 * password is rejected". The publishable key instead of the secret one reads as
 * "the app loads but everything is empty". A Data API URL reads as "Invalid
 * path specified in request URL". Each check below maps a real symptom back to
 * the thing that actually caused it.
 */

import {
  classifySupabaseKey,
  normalizeSupabaseUrl,
  parseEnv,
  readEnvFile,
} from './lib/envfile.mjs';
import { bad, c, heading, info, ok, warn } from './lib/prompt.mjs';

let problems = 0;
let warnings = 0;
const fail = (msg, fix) => {
  problems++;
  bad(msg);
  if (fix) info(`  → ${fix}`);
};
const caution = (msg, fix) => {
  warnings++;
  warn(msg);
  if (fix) info(`  → ${fix}`);
};

console.log(`\n${c.bold('Agent Opportunity Tracker — doctor')}`);

const raw = await readEnvFile();
if (!raw) {
  console.log('');
  fail('No .env.local found.', 'Run `npm run setup`.');
  console.log('');
  process.exit(1);
}
const env = parseEnv(raw);

// --- auth -------------------------------------------------------------------

heading('Auth');

const hash = env.APP_PASSWORD_HASH?.trim();
if (!hash) {
  fail('APP_PASSWORD_HASH is not set.', 'Run `npm run setup`.');
} else if (hash.includes('$')) {
  // The specific failure this catches: env loaders expand '$' as a variable
  // reference, so the value the app reads is shorter than the one on disk.
  fail(
    "APP_PASSWORD_HASH contains '$'.",
    "Separators must be ':'. A '$' gets expanded by env loaders, silently " +
      'corrupting the hash — your correct password will be rejected forever. ' +
      'Re-run `npm run setup` to regenerate it.'
  );
} else {
  const parts = hash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    fail(
      `APP_PASSWORD_HASH is malformed (${parts.length} parts, expected 4).`,
      'Re-run `npm run setup`.'
    );
  } else if (!Number(parts[1])) {
    fail('APP_PASSWORD_HASH has a non-numeric iteration count.', 'Re-run `npm run setup`.');
  } else {
    ok(`Password hash looks right (${Number(parts[1]).toLocaleString()} iterations).`);
  }
}

const secret = env.AUTH_SECRET?.trim();
if (!secret) {
  fail('AUTH_SECRET is not set.', 'Sessions cannot be signed. Run `npm run setup`.');
} else if (secret.length < 32) {
  caution(
    `AUTH_SECRET is short (${secret.length} chars).`,
    'Use at least 32. Changing it signs out every device.'
  );
} else {
  ok('AUTH_SECRET is set.');
}

// --- supabase ---------------------------------------------------------------

heading('Supabase');

const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const url = normalizeSupabaseUrl(rawUrl);
const key = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url) {
  fail('NEXT_PUBLIC_SUPABASE_URL is missing or unparseable.', 'Run `npm run setup`.');
} else {
  if (rawUrl.replace(/\/$/, '') !== url) {
    caution(
      `URL includes a path: ${rawUrl}`,
      `Normalized to ${url} at runtime, but set it to the origin to avoid surprises.`
    );
  } else {
    ok(`URL: ${url}`);
  }
}

const kind = classifySupabaseKey(key);
if (kind === 'missing') {
  fail('SUPABASE_SECRET_KEY is not set.', 'Run `npm run setup`.');
} else if (kind === 'publishable') {
  fail(
    'That is the publishable key, not the secret one.',
    'RLS is on with no policies, so this key reads zero rows — the app will ' +
      'load and look empty rather than erroring. Use the sb_secret_… key.'
  );
} else if (kind === 'unknown') {
  caution('Cannot identify the key type.', 'Testing it live below.');
} else {
  ok('Secret key looks right.');
}

if (url && key) {
  process.stdout.write('  Connecting… ');
  try {
    const res = await fetch(`${url}/rest/v1/opportunities?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });
    console.log('');
    if (res.ok) {
      ok('Connected, and the opportunities table exists.');
    } else if (res.status === 401 || res.status === 403) {
      fail('The key was rejected.', 'Check it matches this project. Re-run `npm run setup`.');
    } else if (res.status === 404) {
      fail(
        'Connected, but the tables are missing.',
        'Run `npm run migrate`, or paste supabase/all-migrations.sql into the SQL editor.'
      );
    } else {
      fail(`Unexpected ${res.status} from Supabase.`, (await res.text()).slice(0, 160));
    }
  } catch (err) {
    console.log('');
    fail(
      err?.name === 'TimeoutError' ? 'Connection timed out.' : 'Could not connect.',
      'Check the project URL, and that the project is not paused.'
    );
  }
}

// --- optional ---------------------------------------------------------------

heading('Optional');

const anthropic = env.ANTHROPIC_API_KEY?.trim();
const openai = env.OPENAI_API_KEY?.trim();
if (!anthropic && !openai) {
  info('No AI key — fit ratings, résumé upload, and tailoring are off. That is a valid setup.');
} else {
  const both = anthropic && openai;
  ok(
    `AI enabled via ${both ? 'both providers' : anthropic ? 'Anthropic' : 'OpenAI'}.` +
      (both && !env.AI_PROVIDER?.trim() ? ' Set AI_PROVIDER to pin one.' : '')
  );
}

env.AGENT_API_TOKEN?.trim()
  ? ok('AGENT_API_TOKEN set — the agent API and skill can be used.')
  : info('No AGENT_API_TOKEN — the agent API is unavailable. Fine if you do not use it.');

env.OWNER_NAME?.trim()
  ? ok(`Greeting set to "${env.OWNER_NAME.trim()}".`)
  : info('No OWNER_NAME — the greeting will be impersonal.');

if (env.DATABASE_URL?.trim()) {
  info('DATABASE_URL is set. Correct locally for migrations — do not add it to Vercel.');
}

// --- summary ----------------------------------------------------------------

console.log('');
if (problems === 0 && warnings === 0) {
  console.log(`${c.green(c.bold('All good.'))} ${c.dim('npm run dev')}\n`);
} else if (problems === 0) {
  console.log(
    `${c.yellow(c.bold(`Usable, with ${warnings} thing${warnings === 1 ? '' : 's'} worth a look.`))}\n`
  );
} else {
  console.log(
    `${c.red(c.bold(`${problems} problem${problems === 1 ? '' : 's'} to fix`))}` +
      `${warnings ? c.dim(`, plus ${warnings} warning${warnings === 1 ? '' : 's'}`) : ''}.\n`
  );
  process.exit(1);
}
