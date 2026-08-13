-- Remove 'Scholarship' from opportunity_type.
--
-- Scholarships don't belong in the same pipeline as applications. They turn on
-- essays, recommenders, and transcripts rather than a résumé and an interview
-- loop, so the statuses here ("Interview in Progress", "Return Offer") mostly
-- don't apply and the fields that would matter aren't modelled. 0001's own
-- comment gave the game away: it documented `essay_required` as scholarship
-- detail and nothing else used it.
--
-- Postgres has no ALTER TYPE … DROP VALUE, so the enum is rebuilt.

do $$
declare
  n bigint;
begin
  -- Nothing to do if the value is already gone — this migration re-runs safely.
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'opportunity_type' and e.enumlabel = 'Scholarship'
  ) then
    return;
  end if;

  -- Refuse rather than destroy. Someone upgrading may be tracking scholarships;
  -- silently retyping or deleting their rows would be the worst possible
  -- outcome of a routine migration.
  select count(*) into n from opportunities where opportunity_type = 'Scholarship';
  if n > 0 then
    raise exception
      'Cannot remove Scholarship: % row(s) still use it. Re-type them (Program fits most) and re-run.', n;
  end if;

  alter type opportunity_type rename to opportunity_type__old;

  create type opportunity_type as enum (
    'Internship',
    'Contract',      -- paid gig and contractor work
    'Program',       -- fellowships, student collectives, ambassador cohorts
    'Research',      -- REUs, university lab positions
    'Full-time'
  );

  -- The default references the old type and blocks the column rewrite.
  alter table opportunities alter column opportunity_type drop default;

  alter table opportunities
    alter column opportunity_type type opportunity_type
    using opportunity_type::text::opportunity_type;

  alter table opportunities
    alter column opportunity_type set default 'Internship';

  drop type opportunity_type__old;
end $$;
