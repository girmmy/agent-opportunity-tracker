# Opportunity workspace design

## Goal

Evolve the tracker from a record of opportunities into a lightweight, single-user
workspace for deciding and completing opportunity-related work. The existing
opportunity table remains the system of record. Tasks, activity, contacts, and
offer decisions are separately queryable resources which may optionally belong
to an opportunity.

## Product shape

The navigation gains three focused views alongside Overview, All, and Profile:

- **Tasks**: every open and completed task, including standalone work such as
  “refresh portfolio” and work linked to a tracked opportunity.
- **Contacts**: recruiter, coordinator, professor, and collaborator records.
- **Decisions**: offer comparisons and the decision context for live offers.

The opportunity edit dialog becomes a detail workspace. Its main fields stay
unchanged and compact; below them, linked tasks, activity, contacts, fit
evidence, and decision details are available in focused sections. The All table
does not attempt to display this secondary data.

## Data model

### `tasks`

`id`, `title`, `status` (`Open`, `In Progress`, `Done`, `Cancelled`), `priority`
(`High`, `Medium`, `Low`), nullable `due_date`, nullable `opportunity_id`,
nullable `notes`, `completed_at`, and timestamps. `opportunity_id` uses
`ON DELETE SET NULL` so a recoverable row deletion never deletes personal work.

### `activity`

Append-only event log with `id`, nullable `opportunity_id`, nullable
`contact_id`, `kind` (`Note`, `Email`, `Status change`, `Interview`,
`Assessment`, `Offer`, `Follow-up`, `Other`), `body`, nullable `occurred_at`,
and `created_at`. User-entered history is never overwritten. Automated agents
can add an event but cannot alter profile data.

### `contacts`

`id`, `name`, nullable `email`, nullable `organization`, nullable `title`,
nullable `opportunity_id`, nullable `last_contacted_at`, nullable `notes`, and
timestamps. Email is stored as user data and never exposed through the public
repository or profile endpoint.

### Opportunity extensions

The opportunities table gains nullable `next_action`, nullable
`next_action_due`, nullable `fit_rationale`, and JSONB `decision_details`.
`decision_details` stores compensation, location, work mode, decision deadline,
pros, concerns, and outcome. A dedicated column is intentionally avoided until
offer comparison proves a cross-record reporting need.

## APIs and agent boundary

Cookie-authenticated routes provide CRUD for tasks, contacts, and activity and
validate all input server-side. Existing opportunity routes accept the four
new opportunity fields.

The bearer-token agent opportunity endpoint remains limited to opportunities.
It may set `next_action`, fit rationale, and decision details only when the
agent has unambiguous source material. It does not receive contact data, write
standalone tasks, or alter personal profile data. Activity writes are reserved
for a future explicit endpoint, avoiding an accidental expansion of automation
authority.

## Interface behavior

Tasks defaults to incomplete work ordered by overdue date, due date, priority,
then creation time. The page supports creating a standalone task or linking one
to an opportunity. Completing a task records `completed_at`; it is never
destroyed merely because it is finished.

Overview elevates urgent open tasks and explicit next actions above pipeline
summary. A task linked to an opportunity shows the organization and role, and
the opportunity workspace shows its incomplete task count and nearest due
date.

Contacts are searchable and can be linked to an opportunity. Activity is
chronological and supports a short manual entry. Changing an opportunity status
creates an activity entry, giving the app a durable explanation of its history.

Decisions lists opportunities with offer/decision information. The editor
compares the important fields side by side and preserves freeform pros and
concerns rather than manufacturing a universal score.

Fit rationale appears beside the existing rating. It must identify matched
evidence, gaps, and any hard eligibility barrier separately from skill fit.

## Error handling and security

All new tables retain RLS with no browser-accessible policies and service-role
access only. Routes return field-level validation errors and preserve user input
on a failed save. Deleting a contact or opportunity does not cascade into user
created tasks or activity; links are nulled. Deleting a task or activity
requires explicit UI confirmation.

## Migration and compatibility

Use additive, idempotent Supabase migrations. Existing rows get null values for
new opportunity fields and continue to work unchanged. Exports include the new
tables and fields; seed/example fixtures stay fictional.

## Verification

Introduce Vitest for domain and route validation tests. Test task ordering,
task completion timestamps, optional relationship handling, activity append
semantics, decision parsing, and agent-field allowlisting. Run typecheck,
unit tests, and production build. Manually verify desktop and narrow mobile
navigation, standalone and linked task creation, status-history creation, and
offer details rendering.
