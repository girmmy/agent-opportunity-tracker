-- Mark rows an agent found on its own, rather than ones the user logged.
--
-- Without this the two are indistinguishable, and that matters in both
-- directions: a suggestion the user never asked for shouldn't be mistaken for
-- something they applied to, and a row they added themselves shouldn't carry
-- a machine's judgement about whether it was worth surfacing.
--
-- A boolean rather than a `source` string because provenance shouldn't live in
-- free text that any later edit can quietly overwrite.

alter table opportunities
  add column if not exists suggested_by_agent boolean not null default false;

comment on column opportunities.suggested_by_agent is
  'True when an agent surfaced this opportunity itself. The user never asked for it, so the UI labels it as a suggestion.';

create index if not exists opportunities_suggested_idx
  on opportunities (suggested_by_agent) where suggested_by_agent;
