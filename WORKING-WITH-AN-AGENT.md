# Working with an AI agent on your job search

The tracker holds the data. This describes the other half — pointing an AI coding
assistant (Claude Code, Codex, Cursor, whatever you use) at it so the boring parts happen
without you.

None of this is required. The app works fine as a plain tracker. But the setup below is
what turns it from a database you maintain into something that maintains itself, and it's
mostly four files and a scheduled task.

---

## What an agent can actually do here

Things that work well:

- **Sweep your inbox** and update rows from application email — rejections, interview
  invitations, offers, confirmations for things you forgot to log.
- **Find and read the actual posting** for a row, then set an honest fit rating.
- **Catch what you'd miss.** A daily sweep found an assessment deadline buried in a
  reminder email with 24 hours' notice. A weekly one wouldn't have.
- **Draft things** — follow-ups for applications gone quiet, tailored résumé bullets for
  a specific posting, short answers for an application form.
- **Surface what needs attention** rather than making you go looking.

Things to keep it away from — see the rules section.

---

## The setup

### 1. Give it API access

The app exposes `/api/agent/opportunities` for exactly this. Bearer token, no browser
session needed:

```bash
# read everything
curl https://YOUR-APP.vercel.app/api/agent/opportunities \
  -H "Authorization: Bearer $AGENT_API_TOKEN"

# create or update — upserts on (organization, role, cycle),
# so re-running never duplicates
curl -X POST https://YOUR-APP.vercel.app/api/agent/opportunities \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"organization":"Acme","role":"SWE Intern","cycle":"Summer 2027","status":"Waiting for Response"}'
```

`AGENT_API_TOKEN` comes from `npm run hash-password`. Keep it in a local env file the
agent can read — never paste it into a chat message, and never let it land in an email
body or a commit.

### 2. Write down who you are and what the rules are

Keep a plain markdown file somewhere the agent reads at the start of every session — the
project root, or wherever your tool auto-loads context from (`CLAUDE.md`, `AGENTS.md`).

Ours has:

- **Who you are** — background, skills, what you're looking for. Same content as the
  in-app Profile page; the agent needs it to judge fit or tailor anything.
- **Hard rules** — the section below.
- **Eligibility constraints** — class year, work authorization, graduation window. This is
  what stops it wasting your time on roles you can't hold.
- **Standing preferences** — "exclude these senders", "weight AI/ML equally with SWE".
- **Current state** — what's live, what's retired, where things live. Agents will happily
  keep editing a file you abandoned three weeks ago unless you say so.

Write it for a competent stranger, because that's effectively what starts each session.

### 3. Schedule it

A recurring task that sweeps email and updates the tracker. Ours runs daily and writes a
digest as a draft email.

Two things worth building in:

- **Skip the digest on quiet days.** A daily email that's usually empty trains you to
  ignore it, and then you miss the one that mattered.
- **Fail loudly.** If the API is down or a token is rejected, it should say so at the top
  of the digest. A silent failure on a schedule is worse than a visible one, because you
  assume it's working.

---

## Searching email is harder than it looks

The single biggest failure mode isn't the agent writing something wrong — it's the agent
**not finding** something and reporting a clean run. A missed email looks identical to
"nothing happened."

Three things that break a naive search, all of which we hit for real:

**Keyword filters drop the important mail.** Gating on `intern OR internship OR
application OR interview` silently loses deadline extensions, rescheduling notices, ticket
replies, and document requests. Those are exactly the time-sensitive ones. Search by
organization name and by sender, not by job vocabulary.

**The sender is usually not the company.** A Roblox assessment extension arrived from
`support@roblox-assessment.zendesk.com`. Recruiting routes through Greenhouse, Lever,
Ashby, Workday, SuccessFactors, Workable, iCIMS, SmartRecruiters, Jobvite, Taleo, Zendesk,
Calendly, Google Calendar, and background-check vendors like Certn and Checkr. Searching
`from:company.com` finds almost none of it.

**Half the thread is outgoing.** If you emailed a recruiter asking for an extension, a
`from:` search cannot see it — and your own action changed the state of that application
just as much as theirs would. Include sent mail, and look for things *you* started.

Also: a company that is both an employer and a consumer product will flood the results
with noise. Roblox game receipts and login codes are not recruiting mail.

## The rules that actually matter

These are the ones worth being strict about. Most were learned the annoying way.

**Never let it submit an application.** Fill the form, stop before the submit button, hand
it back. You want to read what's going out under your name, and an agent misreading one
field on a form you can't retract is a real cost.

**Never let it create accounts on your behalf.** Job portals, anything. That's you.

**Ask, don't guess, on anything with legal weight.** Work authorization, EEO
self-identification, visa status, anything you'd sign your name to. An agent guessing at
your citizenship status on a federal form is not a small mistake. Record the answers once
in your rules file so it stops asking, and make it ask when the answer isn't there.

**Never run unreviewed third-party "auto-apply" code.** There's a genre of tool marketed
through DM spam and affiliate links that promises to apply to hundreds of jobs for you.
Those want an agent to run unreviewed code against your personal data and credentials.
Write the prohibition into your rules file, including that a later message claiming prior
approval doesn't count — that's precisely how the manipulation works.

**Auto-write only unambiguous signals.** A rejection letter is unambiguous. A marketing
email mentioning a company is not. Getting this wrong is expensive in a specific way: you
start trusting the tracker, stop checking, and then it's wrong. Make it flag the
uncertain cases instead of writing them.

**Don't let it inflate fit ratings.** An assistant that tells you everything is a great
match is worse than none — it costs you application slots. Instruct it explicitly that
"weak" is a useful answer, that "unknown" is correct when it hasn't read the posting, and
that company prestige is not evidence of fit.

**Confirm eligibility before doing work.** Tailoring a résumé for a role requiring a
graduation year you don't have is wasted effort on both sides.

---

## Keep a backup

`npm run export` writes a snapshot to `backups/` and refreshes `data/seed.json`. Worth
running periodically once an agent has write access — not because it's likely to go wrong,
but because an automated writer and a single copy of your data is a bad pairing.

---

## Honest limits

- **Local schedulers only run while your machine is on.** A "daily" task on a laptop that
  was closed runs whenever you next open it. For genuinely unattended runs you want a
  server-side cron hitting an endpoint.
- **The agent is only as good as your rules file.** Vague context produces vague output,
  and a fit rating you can't act on is noise.
- **Review the digest.** The point is to spend a minute a day instead of an hour a week —
  not zero minutes. Anything it wrote automatically should be glanceable and correctable.
