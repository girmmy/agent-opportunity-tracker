# Opportunity Tracker

A private, password-gated tracker for internships, contract work, programs, research
positions, and scholarships — because spreadsheets don't work from a phone and don't sync.

Built for one person, self-hosted. Your data lives in **your** Supabase project; nobody
else's server ever sees it.

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase/Postgres · Tailwind v4 ·
Radix primitives · Vercel

---

## What it does

- **Overview** — a greeting, what's happening in the next few days, a pipeline bar showing
  where everything stands, and a nudge for applications that have gone quiet.
- **Everything in one table** — filter by type, status, fit, or cycle; show and hide
  columns; sort; edit inline. Table on desktop, cards on mobile.
- **Six opportunity types** — Internship, Contract, Program, Research, Scholarship,
  Full-time — tracked across multiple cycles, so it doesn't go stale after one season.
- **A fit rating** you set honestly (Strong / Good / Weak / Unknown), plus which résumé
  you sent and a link to the original listing.
- **Optional AI assist** — paste a job description and either pre-fill the form or get an
  honest fit read against your stored profile. Off unless you supply an API key.

---

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgirmmy%2Fopportunity-tracker&env=APP_PASSWORD_HASH,AUTH_SECRET,NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SECRET_KEY&envDescription=Generate%20the%20auth%20values%20with%20npm%20run%20hash-password%2C%20and%20get%20the%20Supabase%20ones%20from%20Settings%20-%3E%20API%20Keys&envLink=https%3A%2F%2Fgithub.com%2Fgirmmy%2Fopportunity-tracker%23deploy-your-own&project-name=opportunity-tracker&repository-name=opportunity-tracker)

The button clones the repo and asks for the four required env vars. You'll need a Supabase
project first — steps below. Free tiers on both Supabase and Vercel are plenty for this.

### 1. Create a Supabase project

[supabase.com](https://supabase.com) → **New project**. Note the database password it asks
you to set; you'll want it for step 3.

### 2. Set your password

```bash
git clone https://github.com/girmmy/opportunity-tracker.git
cd opportunity-tracker
npm install
npm run hash-password
```

It prompts twice with hidden input, then prints three values. The password itself is never
stored, logged, or sent anywhere — only its hash, which can't be reversed.

```bash
cp .env.example .env.local
```

Fill in what it printed, plus your Supabase **Project URL** and **Secret key** (Settings →
API Keys → the `sb_secret_…` one).

### 3. Create the tables

Either paste each file in `supabase/migrations/` into the Supabase SQL editor in order, or
add `DATABASE_URL` to `.env.local` (Supabase → **Connect** → Direct connection) and run:

```bash
npm run migrate
```

Both are idempotent — safe to run twice. `migrate` prints the resulting columns and
confirms row-level security is on.

Optionally load a few sample rows so the UI isn't empty:

```bash
npm run seed
```

### 4. Run it

```bash
npm run dev
```

### 5. Deploy

Push to your own GitHub repo and import it in Vercel, or use the button above. Add these
under **Project Settings → Environment Variables**:

| Variable | Required |
|---|---|
| `APP_PASSWORD_HASH` | Yes |
| `AUTH_SECRET` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `SUPABASE_SECRET_KEY` | Yes |
| `OWNER_NAME` | Optional — greets you by name |
| `AGENT_API_TOKEN` | Optional — only for the automation endpoint |
| `ANTHROPIC_API_KEY` *or* `OPENAI_API_KEY` | Optional — either one turns on the AI features. Billed to your own account. |
| `AI_PROVIDER` | Optional — only if you set both keys and want to pin one |
| `CLAUDE_MODEL` / `OPENAI_MODEL` | Optional — model used for fit analysis |
| `CLAUDE_MODEL_FAST` / `OPENAI_MODEL_FAST` | Optional — cheaper model used for extraction |
| `DATABASE_URL` | **No.** Migrations run from your machine. A superuser connection string in the deployment environment is exposure for no benefit. |

---

## How the login works

The requirement was "only I can reach this," on a public URL. That rules out a client-side
password check — with a static page the data ships to the browser before any password is
entered, so anyone can read it from view-source and skip the prompt.

What's here instead:

- **`proxy.ts`** (Next 16's renamed middleware) runs before any page renders. An
  unauthenticated request gets a redirect, never rendered data.
- **The password is never in the code.** Only a PBKDF2-SHA256 hash (210k iterations,
  random salt) lives in an env var.
- **The session cookie is HMAC-signed and `httpOnly`** — it can't be forged by editing it
  in devtools, and page scripts can't read it.
- **Every data route re-checks the session itself** (`lib/guard.ts`), so auth doesn't
  depend on `proxy.ts` alone. Next.js has shipped real middleware-bypass CVEs
  (`GHSA-f82v-jwr5-mffw`); one bypass shouldn't expose everything.
- **RLS is on with no policies**, so even a leaked publishable key reads zero rows.
- **Login rate limiting lives in Postgres**, not process memory, so the limit is shared
  across serverless instances instead of resetting on every cold start. A lockout refuses
  *every* attempt for its duration, including a correct password — otherwise the lockout
  is cosmetic and an attacker just keeps guessing.

### If you forget the password

There's no reset email, because there are no accounts — but recovery is quick, and
**your data is never at risk**. It lives in Supabase; the password only gates the app.

1. `npm run hash-password` — pick a new one
2. Replace `APP_PASSWORD_HASH` in Vercel (Settings → Environment Variables) and in
   `.env.local`
3. **Redeploy.** Vercel doesn't apply new env vars to an existing deployment.

Two related things worth knowing:

- **Changing `AUTH_SECRET` signs out every device.** That's the break-glass move if you
  think a session cookie leaked — there's no per-session revocation.
- **A lockout refuses the correct password too.** Ten wrong attempts locks that IP for 15
  minutes, deliberately: a lockout that lets a correct guess through isn't a lockout. If
  you fat-finger it repeatedly, wait it out.

Even completely locked out of the app, you can read or export everything from the Supabase
dashboard directly.

### Backups

`npm run export` writes a full snapshot to `backups/` and refreshes `data/seed.json`.
Both are gitignored — they hold a real application history.

That file is the rebuild path: with a fresh Supabase project, `npm run migrate` then
`npm run seed` restores everything. Worth running occasionally, since otherwise the
database is the only copy that exists.

### Known limits

Being honest about what this isn't:

- **Single user by design.** There are no accounts. One password, one dataset. Multi-tenant
  would mean replacing the auth layer, adding `user_id` to every row, and writing RLS
  policies that actually enforce isolation — the current service-role model is safe for one
  person precisely because the key *is* the boundary.
- **Sessions can't be individually revoked.** The cookie is an HMAC over an expiry, with no
  server-side session record. Rotating `AUTH_SECRET` invalidates everything everywhere,
  which is the break-glass move if a session leaks.
- **IP-based rate limiting trusts `x-forwarded-for`.** Correct behind Vercel, which sets it
  at the edge. Self-hosting behind an untrusted proxy, that header is spoofable — the
  password hash, not the limiter, is the real boundary.

---

## The AI features

Both are optional, and work with **either Anthropic or OpenAI** — set whichever key you
already have. With neither, the app behaves exactly as it did before and the controls
don't render; the template shouldn't force an API bill, or a second vendor account, on
anyone.

Two model tiers, because the tasks are different work. Extraction is mechanical — pulling
stated fields out of text — so it uses a small, cheap model. Fit analysis is a judgement
call that has to be willing to say "Weak", which is where model quality actually shows, so
it gets the better tier. Both are env-overridable: the cost/quality tradeoff belongs to
whoever is paying.

| | Fit analysis | Extraction |
|---|---|---|
| Anthropic | `claude-sonnet-4-6` | `claude-haiku-4-5` |
| OpenAI | `gpt-4o` | `gpt-4o-mini` |

Fill in **Profile** first (the nav's settings tab). Fit analysis is judged against it, and
a rating against an empty profile is meaningless — the endpoint returns 428 rather than
inventing something.

**Fill the blanks** — paste a posting, get organization / role / type / cycle / deadline /
listing URL extracted into the form. Every field is nullable and only *empty* fields are
filled, so it never overwrites something you typed. The prompt is told to return null
rather than infer, because a wrong value costs you more attention than a blank one.

**Rate the fit** — paste a posting, get Strong / Good / Weak / Unknown with named matches,
named gaps, and any hard eligibility barrier called out separately from skill fit.

The prompt deliberately pushes against the model's instinct to be encouraging:

> "Weak" is a legitimate and useful verdict. […] Never infer fit from the company's
> reputation, size, or how desirable the role sounds. […] Flag hard eligibility barriers
> separately from skill fit.

An inflated rating costs a real application slot, which is worse than no rating at all.
Anything machine-written is labelled *Analyzed with Claude* in the UI, and nothing is
written to the database until you review it and hit Save.

Implementation: `lib/claude.ts`, `app/api/ai/*`. Structured output via Zod schemas so
responses are validated rather than string-parsed, and API errors are mapped to
actionable messages (bad key vs. rate limit vs. spent credit).

---

## Data model

One table with an `opportunity_type` discriminator rather than a table per type. The types
share most of their fields, and one table is what makes the overview's "everything active
right now" a single query instead of a six-way union.

| Field | Notes |
|---|---|
| `opportunity_type` | Internship · Contract · Program · Research · Scholarship · Full-time |
| `category` | SWE · AI/ML · Product · Data · Research · Other · Unclear |
| `cycle` | Free text — `Summer 2027`, `Ongoing`. This is what makes it multi-year: filter by cycle, archive old ones rather than deleting. |
| `status` | Not Applied Yet → In Progress → Waiting → Interview → Offer Received → Accepted / Active → Completed. Plus Return Offer, Rejected, Withdrawn / Lapsed. |
| `fit` | Strong / Good / Weak / Unknown. Rate it only after actually reading the posting — `Unknown` is the honest default. |
| `resume_used` | Filename of whatever you submitted |
| `listing_url` | The original posting |
| `details` | JSONB for type-specific extras (scholarship award, contract rate, interview date, research lab) — add a type without a migration |

---

## Automation endpoint

`POST /api/agent/opportunities` with `Authorization: Bearer $AGENT_API_TOKEN`. Accepts one
object or an array, and upserts on `(organization, role, cycle)` so re-runs update rather
than duplicate. `GET` returns everything.

Deliberately outside the cookie auth — a script has no browser session — and checks its own
bearer token instead.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run hash-password` | Generate `APP_PASSWORD_HASH`, `AUTH_SECRET`, `AGENT_API_TOKEN` |
| `npm run migrate` | Apply `supabase/migrations/*.sql` (needs `DATABASE_URL`) |
| `npm run seed` | Load `data/seed.json`, or the sample data if that's absent |
| `npm run setup` | `migrate` then `seed` |
| `npm run typecheck` | `tsc --noEmit` |

## Notes

The login screen is the only surface reachable without the password, so it carries two
things for whoever lands there: a **"made by gimmy"** credit, and a **GitHub icon in the
bottom-right linking to this repo** — so anyone technical can read the source instead of
wondering what they've been sent.

Those are the only hardcoded attribution in the project. Forking? Change or delete both
blocks in `app/login/page.tsx`; they're marked with a comment.

`data/seed.json` is gitignored — it's where real application history would live. The repo
ships `data/seed.example.json` with fictional rows so a fresh clone runs end to end.

MIT licensed. Fork it, change it, make it yours.
