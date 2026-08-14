-- Add 'Hackathon', and bring back 'Scholarship'.
--
-- Scholarship was dropped in 0007 because its application process doesn't fit
-- the same pipeline as a job application — an essay, recommenders, a
-- transcript, rather than a résumé and an interview loop. That's still true,
-- but it turns out to be a reason to track the extra requirements, not a
-- reason to drop the type. The existing `details` JSONB column already
-- exists for exactly this — type-specific extras with no migration needed —
-- so a scholarship row can carry `{"essay_required": true, "recommenders":
-- 2, "transcript_required": true, "award_amount": 5000}` without the schema
-- needing to know about essays as a first-class concept.
--
-- Additive only — no enum rebuild needed this time, unlike 0007's removal.
-- add value if not exists is already idempotent on its own.

alter type opportunity_type add value if not exists 'Hackathon';
alter type opportunity_type add value if not exists 'Scholarship';
