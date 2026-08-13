-- Grant table access to the role the app's secret key runs as.
--
-- Supabase normally applies default privileges so new tables in `public` are
-- reachable by anon/authenticated/service_role. That did not happen for this
-- table, and PostgREST returned:
--
--   42501  permission denied for table opportunities
--   hint:  GRANT SELECT ON public.opportunities TO service_role;
--
-- Granting explicitly is the durable fix — it does not depend on whatever the
-- project's default privileges happen to be.
--
-- Only `service_role` is granted. The app talks to Postgres exclusively through
-- server-side code using the secret key, which maps to this role. `anon` and
-- `authenticated` are deliberately left with no privileges, so a leaked
-- publishable key reads nothing — that plus RLS-with-no-policies is the
-- defense in depth described in the README.
--
-- Safe to run more than once.

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.opportunities
  to service_role;

-- Future tables in this schema get the same treatment automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
