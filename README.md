# Opportunity Tracker

A password-gated tracker for internships, contract work, programs, research positions,
and scholarships — built because spreadsheets don't work from a phone and don't sync.

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase/Postgres · Tailwind v4 ·
Radix primitives · deployed on Vercel.

**Notable bits**
- Session auth with no third-party provider: PBKDF2-SHA256 password hashing and
  HMAC-signed `httpOnly` cookies, all via Web Crypto so it runs in the edge runtime.
- Defense in depth — auth is enforced in `proxy.ts` *and* re-checked in every data
  route, so a middleware bypass doesn't expose data.
- Row-level security enabled with no policies; the app reaches Postgres only through
  server-side code holding the secret key.
- Login rate limiting backed by a Postgres function, so the limit is shared across
  serverless instances instead of resetting on every cold start.
- One table with a type discriminator plus a JSONB `details` column, so adding an
  opportunity type needs no migration.
- Responsive by shape, not just by width: a sortable table with toggleable columns on
  desktop, card list and bottom sheets on mobile.

> **Note on data.** `data/seed.json` is gitignored — it holds a real application
> history. The repo ships `data/seed.example.json` with fictional rows so a fresh
> clone runs end to end.

---

## Setup

The split is deliberate: **you do the things that require your credentials to exist;
everything after that can be run for you.** Secrets live in `.env.local` on your machine
(gitignored) — they never need to be pasted into a chat, and the scripts read them from
disk.

### 1. Create a Supabase project — *you*

Use a **new** project, not Bantr's, so a personal tracker doesn't share a database with a
production app.

1. supabase.com → New project. Free tier is plenty.
2. **Project Settings → API** — note the Project URL and the `service_role` key.
3. **Project Settings → Database → Connection string → URI** — note that too.

> The `service_role` key bypasses row-level security and is server-side only. Never put
> it in a `NEXT_PUBLIC_*` variable, and never paste it into a chat.

### 2. Set your password — *you*

```bash
npm install
npm run hash-password
```

Prompts twice with hidden input, then prints three values. The password itself is never
stored, logged, or transmitted — only the hash, which can't be reversed. That's why this
is a script you run rather than something anyone else does for you.

### 3. Fill in `.env.local` — *you*

```bash
cp .env.example .env.local
```

Six values: three from `hash-password`, plus `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`.

### 4. Create the tables and load the data — *can be run for you*

```bash
npm run setup     # = migrate + seed
```

`migrate` applies `supabase/migrations/*.sql` over a direct Postgres connection and then
prints the resulting columns and RLS status so you can see it worked. `seed` loads
`data/seed.json` — the 33 applications from the old tracker, plus Mercor and the OpenAI
Student Collective. Both are idempotent; re-running updates rather than duplicating.

Once `.env.local` exists, this step needs nothing from you — hand it off.

### 5. Run it

```bash
npm run dev
```

http://localhost:3000 → login screen → your password.

### 5. Deploy to Vercel

Import the repo in Vercel, then add these under **Project Settings → Environment
Variables**. Values are the same as `.env.local`.

| Variable | Needed in Vercel? |
|---|---|
| `APP_PASSWORD_HASH` | Yes |
| `AUTH_SECRET` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `SUPABASE_SECRET_KEY` | Yes — the `sb_secret_…` key. `SUPABASE_SERVICE_ROLE_KEY` is also accepted for older projects. |
| `AGENT_API_TOKEN` | Only if the weekly agent will post to `/api/agent/opportunities` |
| `DATABASE_URL` | **No.** Migrations run from your machine; putting a full Postgres connection string in the deployment environment widens the blast radius for nothing. |

`.gitignore` excludes `.env.local` and `data/seed.json`. Confirm with `git status`
before pushing that no `.env` file is staged.

---

## How the login actually works

The requirement was "only I can access it," on a public URL. That rules out a
client-side password check — with a static page, the data ships to the browser before
any password is entered, so anyone can read it from view-source and skip the prompt.

What's here instead:

- **`proxy.ts`** (Next 16's renamed middleware) runs before any page renders. An
  unauthenticated request gets a redirect, never rendered data.
- **The password is never in the code.** Only a PBKDF2-SHA256 hash (210k iterations,
  random 16-byte salt) lives in an env var.
- **The session cookie is HMAC-signed and `httpOnly`** — it can't be forged by editing
  it in devtools, and page scripts can't read it.
- **Every data route re-checks the session itself** (`lib/guard.ts`), so auth doesn't
  depend on `proxy.ts` alone. Next.js has shipped real middleware-bypass CVEs before
  (`GHSA-f82v-jwr5-mffw`); one bypass shouldn't expose everything.
- **RLS is on with no policies**, so even a leaked anon key reads zero rows.
- Login is rate-limited to 10 attempts per 15 minutes per IP.

Verified working: unauthenticated page → 307 to `/login`; unauthenticated API → 401;
wrong password → 401; correct password → 200 + `httpOnly` cookie; tampered cookie →
rejected; logout → subsequent requests rejected.

**One implementation note worth knowing:** the hash uses `:` as its field delimiter
rather than the conventional `$`. Env file loaders do shell-style variable expansion, so
a `$`-delimited hash gets silently corrupted on load — the app starts fine and just
rejects your correct password forever. This bit during development; `:` avoids it.

---

## Data model

One table, `opportunities`, with an `opportunity_type` discriminator rather than a table
per type — the types share most of their fields, and one table is what makes the
overview page's "everything active right now" a single query.

| Field | Notes |
|---|---|
| `opportunity_type` | Internship, Contract, Program, Research, Scholarship, Full-time |
| `category` | SWE, AI/ML, Product, Data, Research, Other, Unclear |
| `cycle` | Free text: `Summer 2027`, `Fall 2026`, `Ongoing`. This is what makes it multi-year — filter by cycle, archive old ones rather than deleting. |
| `status` | Not Applied Yet → In Progress → Waiting → Interview → Offer Received → Accepted / Active → Completed. Plus Return Offer, Rejected, Withdrawn / Lapsed. |
| `fit` | Strong / Good / Weak / Unknown. Only rate it after actually reading the job description — `Unknown` is the honest answer otherwise. |
| `resume_used` | `master`, or a filename in `../Job Search/Tailored Resumes/` |
| `listing_url` | The actual posting |
| `details` | JSONB for type-specific extras (scholarship award amount, contract rate, research lab/PI) — add a type without a migration |

---

## For the weekly agent

`POST /api/agent/opportunities` with `Authorization: Bearer $AGENT_API_TOKEN`.
Accepts one object or an array; upserts on `(organization, role, cycle)` so re-runs
update rather than duplicate. `GET` the same path returns everything.

This route is deliberately outside the cookie auth (an agent has no browser session) and
checks its own bearer token instead.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run hash-password` | Generate `APP_PASSWORD_HASH`, `AUTH_SECRET`, `AGENT_API_TOKEN` |
| `npm run migrate` | Apply `supabase/migrations/*.sql` (idempotent) |
| `npm run seed` | Load `data/seed.json` into Supabase (idempotent) |
| `npm run setup` | `migrate` then `seed` |
| `npm run typecheck` | `tsc --noEmit` |
