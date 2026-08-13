-- Gimmy-Opportunity-Tracker — initial schema
--
-- Design note: one table with an `opportunity_type` discriminator rather than a
-- table per type. The types share ~90% of their fields (org, status, dates, fit,
-- notes), and a single table is what makes the dashboard's "everything active
-- right now" view a simple query instead of a five-way union. Fields that only
-- matter to one type (scholarship award amount, contract hourly rate, research
-- lab/PI) live in `details` JSONB so adding a type never needs a migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
-- Wrapped in exception guards so this file can be re-run safely; plain
-- `create type` errors out if the type already exists, which would make the
-- whole migration non-idempotent.

do $$ begin
  create type opportunity_type as enum (
    'Internship',
    'Contract',      -- Mercor, Handshake-style paid gig work
    'Program',       -- OpenAI Student Collective, fellowships, ambassador cohorts
    'Research',      -- NSF REU, university lab positions
    'Scholarship',
    'Full-time'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type opportunity_status as enum (
    'Not Applied Yet',
    'In Progress (Applying)',
    'Waiting for Response',
    'Interview in Progress',
    'Offer Received',
    'Accepted / Active',      -- currently doing it
    'Return Offer',
    'Completed',
    'Rejected',
    'Withdrawn / Lapsed'      -- withdrew, or the window closed before applying
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type fit_rating as enum ('Strong', 'Good', 'Weak', 'Unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type role_category as enum (
    'SWE', 'AI/ML', 'Product', 'Data', 'Research', 'Other', 'Unclear'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- table ----

create table if not exists opportunities (
  id                uuid primary key default gen_random_uuid(),

  organization      text not null,
  role              text not null,
  opportunity_type  opportunity_type not null default 'Internship',
  category          role_category    not null default 'Unclear',

  -- Free text rather than an enum so a new cycle never needs a migration.
  -- Convention: 'Summer 2027', 'Fall 2026', '2026-27', or 'Ongoing'.
  cycle             text,

  status            opportunity_status not null default 'Not Applied Yet',
  fit               fit_rating         not null default 'Unknown',

  date_applied      date,
  deadline          date,
  listing_url       text,

  -- Filename inside `Professional Stuff/Job Search/Tailored Resumes/`, or
  -- 'master' when the untailored resume went out.
  resume_used       text,

  source            text,
  notes             text,

  -- Type-specific extras. Examples:
  --   Scholarship  {"award_amount": 5000, "essay_required": true}
  --   Contract     {"hourly_rate": 45, "hours_per_week": 10}
  --   Research     {"lab": "...", "pi": "...", "funded": true}
  details           jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists opportunities_status_idx on opportunities (status);
create index if not exists opportunities_type_idx   on opportunities (opportunity_type);
create index if not exists opportunities_cycle_idx  on opportunities (cycle);

-- Prevent the seed script and the weekly agent from double-inserting the same
-- row on re-run.
--
-- Plain columns, not an expression like coalesce(cycle,''): ON CONFLICT can
-- only target an index whose definition matches the conflict spec, and an
-- expression index will not match `on conflict (organization, role, cycle)`.
-- NULLS NOT DISTINCT (Postgres 15+) makes two NULL cycles count as the same
-- row, which is what coalesce was there for.
create unique index if not exists opportunities_org_role_cycle_key
  on opportunities (organization, role, cycle) nulls not distinct;

-- ------------------------------------------------------------- updated_at --

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists opportunities_set_updated_at on opportunities;
create trigger opportunities_set_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------ RLS ----
-- Every read and write goes through this app's server-side routes using the
-- service-role key, which bypasses RLS. Enabling RLS with no permissive policy
-- means that if the anon/publishable key ever leaks, it still reads nothing.

alter table opportunities enable row level security;

-- Deliberately no policies. Anon and authenticated roles get zero rows.

-- ---------------------------------------------------------------- grants ---
-- Supabase's default privileges don't reliably reach a table created this way,
-- which surfaces as PostgREST error 42501 "permission denied". Granting
-- explicitly makes this independent of project defaults.
--
-- service_role only: the app reaches Postgres exclusively through server-side
-- code using the secret key. anon/authenticated stay with no privileges, so a
-- leaked publishable key reads nothing even before RLS is considered.

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.opportunities
  to service_role;
