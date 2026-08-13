#!/usr/bin/env node
/**
 * One-command setup.  npm run setup
 *
 * Replaces a ten-step checklist where five of the steps were copy-pasting
 * generated values between a terminal and a text editor. Every one of those was
 * a chance to truncate a hash, paste the wrong Supabase key, or include a
 * trailing /rest/v1/ — and each of those failures surfaces later as a symptom
 * that doesn't name its cause ("correct password rejected", "no rows, ever").
 *
 * So this generates the secrets and writes them directly, and validates the
 * things it can't generate before writing them down.
 *
 * Safe to re-run: it shows what's already configured and leaves it alone unless
 * you say otherwise.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';
import {
  ENV_PATH,
  classifySupabaseKey,
  normalizeSupabaseUrl,
  parseEnv,
  readEnvFile,
  upsertEnv,
  writeEnvFile,
} from './lib/envfile.mjs';
import {
  ask,
  askHidden,
  bad,
  c,
  confirm,
  heading,
  info,
  isInteractive,
  ok,
  warn,
} from './lib/prompt.mjs';

const PBKDF2_ITERATIONS = 210_000;
const enc = new TextEncoder();
const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);
const COMBINED_SQL = new URL('../supabase/all-migrations.sql', import.meta.url);

const hex = (n) =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('hex');

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  // ':' not '$' — env loaders expand '$' and would corrupt this silently.
  return [
    'pbkdf2',
    PBKDF2_ITERATIONS,
    Buffer.from(salt).toString('base64'),
    Buffer.from(hash).toString('base64'),
  ].join(':');
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function combineMigrations() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql') && f !== 'all-migrations.sql')
    .sort();
  const parts = [
    '-- Every migration, concatenated in order, so this is a single paste.',
    '-- Idempotent: safe to run more than once.',
    '',
  ];
  for (const f of files) {
    parts.push(`-- ${'='.repeat(66)}`, `-- ${f}`, `-- ${'='.repeat(66)}`, '');
    parts.push(await readFile(new URL(f, MIGRATIONS_DIR), 'utf8'), '');
  }
  const sql = parts.join('\n');
  await writeFile(COMBINED_SQL, sql);
  return { sql, count: files.length };
}

/** Does this key actually reach this project? */
async function checkSupabase(url, key) {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { okay: false, why: 'the key was rejected' };
    }
    if (res.status >= 500) {
      return { okay: false, why: `the project returned ${res.status}` };
    }
    return { okay: true };
  } catch (err) {
    const why =
      err?.name === 'TimeoutError'
        ? 'the request timed out — check the URL'
        : 'could not reach that URL';
    return { okay: false, why };
  }
}

/** Are the tables there yet? */
async function tablesExist(url, key) {
  try {
    const res = await fetch(`${url}/rest/v1/opportunities?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

console.log(`
${c.bold('Agent Opportunity Tracker — setup')}
${c.dim('Generates your secrets, checks your database, and writes .env.local.')}
${c.dim('Nothing leaves your machine. Ctrl-C any time; nothing is written until the end.')}`);

if (!isInteractive()) {
  console.error(`
This needs an interactive terminal. Run it directly:

  npm run setup
`);
  process.exit(1);
}

const existingRaw = await readEnvFile();
const existing = existingRaw ? parseEnv(existingRaw) : {};
const updates = {};

if (existingRaw) {
  heading('Found an existing .env.local');
  const has = (k) => Boolean(existing[k]?.trim());
  for (const k of [
    'APP_PASSWORD_HASH',
    'AUTH_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
  ]) {
    has(k) ? ok(`${k} is set`) : bad(`${k} is missing`);
  }
  info('Anything already set is kept unless you choose to change it.');
}

// --- password ---------------------------------------------------------------

heading('1. Password');

const needPassword = !existing.APP_PASSWORD_HASH?.trim();
let setPassword = needPassword;

if (!needPassword) {
  setPassword = await confirm('  A password is already set. Change it?', {
    def: false,
  });
}

if (setPassword) {
  info('This is the only thing between a public URL and your data.');
  let password = '';
  for (;;) {
    password = await askHidden('  Choose a password: ');
    if (password.length < 10) {
      bad('At least 10 characters, please.');
      continue;
    }
    const again = await askHidden('  Confirm: ');
    if (password !== again) {
      bad("Those didn't match. Again.");
      continue;
    }
    break;
  }
  updates.APP_PASSWORD_HASH = await hashPassword(password);
  ok('Password hashed. The password itself is not stored anywhere.');
}

if (!existing.AUTH_SECRET?.trim()) {
  updates.AUTH_SECRET = hex(32);
  ok('Generated AUTH_SECRET (signs your session cookie).');
}
if (!existing.AGENT_API_TOKEN?.trim()) {
  updates.AGENT_API_TOKEN = hex(32);
  ok('Generated AGENT_API_TOKEN (for the agent API — ignore it if unused).');
}

// --- supabase ---------------------------------------------------------------

heading('2. Supabase');

let url = normalizeSupabaseUrl(existing.NEXT_PUBLIC_SUPABASE_URL ?? '');
let key = (existing.SUPABASE_SECRET_KEY || existing.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let needSupabase = !url || !key;
if (!needSupabase) {
  const probe = await checkSupabase(url, key);
  if (probe.okay) {
    ok(`Reached ${url}`);
    needSupabase = await confirm('  Point at a different project?', { def: false });
  } else {
    warn(`Existing settings didn't work — ${probe.why}.`);
    needSupabase = true;
  }
}

if (needSupabase) {
  info('Create a project at supabase.com, then: Project Settings → API Keys.');

  for (;;) {
    const rawUrl = await ask('  Project URL: ');
    url = normalizeSupabaseUrl(rawUrl);
    if (!url) {
      bad("That doesn't look like a URL.");
      continue;
    }
    if (rawUrl.trim().replace(/\/$/, '') !== url) {
      // Quietly correcting this would leave them with a URL that doesn't match
      // what they pasted, and no idea why.
      info(`Using ${url} — the client adds the API path itself.`);
    }
    break;
  }

  for (;;) {
    key = (await ask('  Secret key: ')).trim();
    const kind = classifySupabaseKey(key);
    if (kind === 'publishable') {
      bad('That is the publishable key — it can only see rows RLS allows,');
      bad('and this schema enables RLS with no policies, so it would read');
      bad('nothing at all. Copy the Secret key (sb_secret_…) instead.');
      continue;
    }
    if (kind === 'missing') {
      bad('No key entered.');
      continue;
    }
    if (kind === 'unknown') {
      warn("Can't tell what kind of key that is. Continuing — it'll be tested.");
    }

    process.stdout.write('  Checking… ');
    const probe = await checkSupabase(url, key);
    console.log('');
    if (probe.okay) {
      ok('Connected.');
      break;
    }
    bad(`No good — ${probe.why}.`);
    if (!(await confirm('  Try again?', { def: true }))) process.exit(1);
    if (await confirm('  Change the project URL too?', { def: false })) {
      const again = normalizeSupabaseUrl(await ask('  Project URL: '));
      if (again) url = again;
    }
  }

  updates.NEXT_PUBLIC_SUPABASE_URL = url;
  updates.SUPABASE_SECRET_KEY = key;
}

// --- optional extras --------------------------------------------------------

heading('3. Optional');

if (!existing.OWNER_NAME?.trim()) {
  const name = await ask(`  Your first name, to be greeted by ${c.dim('(enter to skip)')}: `);
  if (name) updates.OWNER_NAME = name;
}

const hasAiKey = Boolean(
  existing.ANTHROPIC_API_KEY?.trim() || existing.OPENAI_API_KEY?.trim()
);
if (!hasAiKey) {
  info('AI features (fit ratings, résumé tailoring, résumé upload) need a key.');
  info('Billed to your own account. Skip this and the app works without them.');
  const aiKey = await ask(`  Anthropic or OpenAI API key ${c.dim('(enter to skip)')}: `);
  if (aiKey.startsWith('sk-ant')) {
    updates.ANTHROPIC_API_KEY = aiKey;
    ok('Anthropic key saved.');
  } else if (aiKey.startsWith('sk-')) {
    updates.OPENAI_API_KEY = aiKey;
    ok('OpenAI key saved.');
  } else if (aiKey) {
    warn("Didn't recognise that key's prefix — skipping. Add it to .env.local by hand.");
  }
}

// --- write ------------------------------------------------------------------

heading('4. Writing .env.local');

const merged = upsertEnv(
  existingRaw ?? (await readFile(new URL('../.env.example', import.meta.url), 'utf8')),
  updates
);
await writeEnvFile(merged);
ok(`Wrote ${ENV_PATH.pathname.split('/').pop()} (gitignored, mode 600).`);

const finalUrl = updates.NEXT_PUBLIC_SUPABASE_URL ?? url;
const finalKey = updates.SUPABASE_SECRET_KEY ?? key;

// --- schema -----------------------------------------------------------------

heading('5. Database tables');

if (await tablesExist(finalUrl, finalKey)) {
  ok('Tables already exist. Nothing to do.');
} else {
  info('The tables need creating. Two ways — either is fine.');

  const dbUrl = (
    existing.DATABASE_URL?.trim() ||
    (await ask(
      `  Paste the Postgres connection string to do it automatically\n  ${c.dim('(Supabase → Connect → Direct connection; or press enter to do it by hand)')}\n  > `
    ))
  ).trim();

  if (dbUrl) {
    await writeEnvFile(upsertEnv(await readFile(ENV_PATH, 'utf8'), { DATABASE_URL: dbUrl }));
    info('Running migrations…');
    const migrated = await run(process.execPath, ['scripts/migrate.mjs']);
    if (migrated) {
      ok('Tables created.');
    } else {
      warn('That did not complete. Falling back to the manual route below.');
      const { count } = await combineMigrations();
      info(`Paste supabase/all-migrations.sql (${count} migrations) into the Supabase SQL editor.`);
    }
  } else {
    const { count } = await combineMigrations();
    console.log(`
  Wrote ${c.cyan('supabase/all-migrations.sql')} — all ${count} migrations in one file.

  Open your project → ${c.bold('SQL Editor')} → paste that file's contents → Run.
  It's idempotent, so running it twice is harmless.`);
    await ask('\n  Press enter once you have run it… ');

    if (await tablesExist(finalUrl, finalKey)) {
      ok('Tables found.');
    } else {
      warn("Still can't see the tables. Run `npm run doctor` after you've applied the SQL.");
    }
  }
}

// --- sample rows ------------------------------------------------------------

if (await tablesExist(finalUrl, finalKey)) {
  heading('6. Sample data');
  if (await confirm('  Load a few example rows so the UI is not empty?', { def: true })) {
    await run(process.execPath, ['scripts/seed.mjs']);
  }
}

// --- done -------------------------------------------------------------------

console.log(`
${c.green(c.bold('Ready.'))}

  ${c.bold('npm run dev')}     ${c.dim('→ http://localhost:3000, sign in with your password')}
  ${c.bold('npm run doctor')}  ${c.dim('→ check the setup any time')}

${c.bold('Deploying to Vercel')}
  Import this repo, then copy these four env vars from .env.local:

    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SECRET_KEY
    APP_PASSWORD_HASH
    AUTH_SECRET

  ${c.dim('Plus OWNER_NAME, AGENT_API_TOKEN, and any AI key you set — all optional.')}
  ${c.dim('Do NOT add DATABASE_URL: migrations run from here, and a superuser')}
  ${c.dim('connection string in the deployment is exposure for no benefit.')}
`);
