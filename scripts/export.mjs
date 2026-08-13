#!/usr/bin/env node
/**
 * Back up everything to a local file.
 *
 * Run:  npm run export
 *
 * The app's data lives in exactly one place — a Supabase project — and a
 * password reset can't help you if the account itself is gone. This writes a
 * plain JSON snapshot you can keep anywhere, and it's the file `npm run seed`
 * reads back if you ever need to rebuild.
 *
 * Output is gitignored: it contains a real application history.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

async function loadEnv() {
  try {
    const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
    }
  } catch {
    /* fall through to ambient env */
  }
}

await loadEnv();

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const url = rawUrl
  ? (() => {
      try {
        return new URL(rawUrl).origin;
      } catch {
        return rawUrl.replace(/\/+$/, '');
      }
    })()
  : undefined;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    '\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.\n'
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: opportunities, error: oppErr } = await supabase
  .from('opportunities')
  .select('*')
  .order('created_at', { ascending: true });

if (oppErr) {
  console.error('\nCouldn\'t read opportunities:', oppErr.message);
  process.exit(1);
}

// Profile may not exist on older databases — a missing profile shouldn't
// abort a backup of the rows that matter most.
const { data: profile } = await supabase
  .from('profile')
  .select('*')
  .eq('id', true)
  .maybeSingle();

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const dir = new URL('../backups/', import.meta.url);
await mkdir(dir, { recursive: true });

const outFile = new URL(`tracker-${stamp}.json`, dir);
await writeFile(
  outFile,
  JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      opportunity_count: opportunities.length,
      opportunities,
      profile: profile ?? null,
    },
    null,
    2
  )
);

// Also refresh the seed file, so `npm run seed` can rebuild from this backup.
const seedRows = opportunities.map((r) => ({
  organization: r.organization,
  role: r.role,
  opportunity_type: r.opportunity_type,
  category: r.category,
  cycle: r.cycle,
  status: r.status,
  fit: r.fit,
  date_applied: r.date_applied,
  deadline: r.deadline,
  listing_url: r.listing_url,
  resume_used: r.resume_used,
  source: r.source,
  notes: r.notes,
  details: r.details ?? {},
}));

await writeFile(
  new URL('../data/seed.json', import.meta.url),
  JSON.stringify(seedRows, null, 2)
);

console.log(`
Backed up ${opportunities.length} opportunities${profile ? ' + profile' : ''}.

  backups/tracker-${stamp}.json   full snapshot, keep this somewhere safe
  data/seed.json                  refreshed — 'npm run seed' rebuilds from it

Both are gitignored. If you ever lose the Supabase project: create a new one,
run 'npm run migrate' then 'npm run seed', and you're back.
`);
