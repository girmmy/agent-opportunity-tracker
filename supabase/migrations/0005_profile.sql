-- Candidate profile.
--
-- The AI features can't say anything useful about fit without knowing who's
-- applying. That context lived outside the app (in notes on the owner's
-- machine), which is exactly why fit ratings had to be done by hand.
--
-- A single row, enforced by a check constraint on a fixed id. This app is
-- single-user by design — see the README's "Known limits" — so a settings row
-- is the honest shape rather than pretending at multi-tenancy with a user_id
-- that would always hold the same value.

create table if not exists profile (
  id            boolean primary key default true,
  headline      text,          -- "Incoming CS freshman at Georgia Tech"
  summary       text,          -- free text: situation, what they're looking for
  skills        text,          -- languages, frameworks, tools
  experience    text,          -- roles held, with what was actually built
  projects      text,          -- notable projects and their stacks
  education     text,
  constraints   text,          -- eligibility limits: class year, work auth, location
  updated_at    timestamptz not null default now(),

  constraint profile_singleton check (id)
);

drop trigger if exists profile_set_updated_at on profile;
create trigger profile_set_updated_at
  before update on profile
  for each row execute function set_updated_at();

alter table profile enable row level security;
-- No policies, same as `opportunities`: reachable only via the service role.

grant select, insert, update on table public.profile to service_role;

-- Seed the singleton so the settings page always has a row to edit.
insert into profile (id) values (true) on conflict (id) do nothing;
