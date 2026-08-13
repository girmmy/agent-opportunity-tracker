-- Fix the uniqueness index so ON CONFLICT can target it.
--
-- 0001 originally created this index over an expression:
--     (organization, role, coalesce(cycle, ''))
-- Postgres will only use an index for ON CONFLICT when the conflict target
-- matches the index definition, and `on conflict (organization, role, cycle)`
-- does not match an expression index — it fails with "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification".
--
-- Replacing it with a plain-column index using NULLS NOT DISTINCT keeps the
-- same semantics (two NULL cycles are still treated as duplicates) while being
-- targetable by both the seed script and the weekly agent's upsert.
--
-- 0001 has been corrected too, so a fresh database never needs this file.
-- Safe to run more than once.

drop index if exists opportunities_org_role_cycle_key;

create unique index if not exists opportunities_org_role_cycle_key
  on opportunities (organization, role, cycle) nulls not distinct;
