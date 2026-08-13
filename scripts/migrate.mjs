#!/usr/bin/env node
/**
 * Apply everything in supabase/migrations/ to the database.
 *
 * Run:  npm run migrate
 *
 * Reads DATABASE_URL from .env.local. That file is gitignored and stays on your
 * machine — the connection string is never committed, and it doesn't need to be
 * pasted into a chat for this to run.
 *
 * Idempotent: the migration itself uses `if not exists` / `or replace`, and
 * enum creation is guarded, so re-running is safe.
 */

import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

async function loadEnv() {
  try {
    const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes — connection strings are often pasted quoted.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* fall through to ambient env */
  }
}

await loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(`
DATABASE_URL is not set.

Get it from Supabase: Project Settings -> Database -> Connection string -> URI
(use the "Session pooler" or "Direct connection" string; either works here).
It looks like:

  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

Add it to .env.local as:

  DATABASE_URL=postgresql://...

.env.local is gitignored, so it stays on your machine.
`);
  process.exit(1);
}

const dir = new URL('../supabase/migrations/', import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error('No .sql files found in supabase/migrations/.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  // Supabase requires TLS; its pooler cert isn't in Node's default trust store.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
} catch (err) {
  console.error(`\nCouldn't connect: ${err.message}\n`);
  if (/password authentication failed/i.test(err.message)) {
    console.error(
      'The password in DATABASE_URL looks wrong. If it contains special\n' +
        'characters they must be percent-encoded (e.g. @ becomes %40).\n'
    );
  }
  process.exit(1);
}

console.log(`Connected. Applying ${files.length} migration(s)…\n`);

let failed = false;
for (const file of files) {
  const sql = await readFile(new URL(file, dir), 'utf8');
  process.stdout.write(`  ${file} … `);
  try {
    await client.query(sql);
    console.log('ok');
  } catch (err) {
    console.log('FAILED');
    console.error(`\n  ${err.message}\n`);
    failed = true;
    break;
  }
}

if (!failed) {
  const { rows } = await client.query(
    `select column_name, data_type
       from information_schema.columns
      where table_name = 'opportunities'
      order by ordinal_position`
  );
  console.log(`\nTable 'opportunities' has ${rows.length} columns:`);
  console.log('  ' + rows.map((r) => r.column_name).join(', '));

  const { rows: rls } = await client.query(
    `select relrowsecurity from pg_class where relname = 'opportunities'`
  );
  console.log(`  row-level security enabled: ${rls[0]?.relrowsecurity === true}`);
  console.log('\nDone. Next: npm run seed\n');
}

await client.end();
process.exit(failed ? 1 : 0);
