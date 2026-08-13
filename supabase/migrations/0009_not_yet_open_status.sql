-- Add 'Not Yet Open' status.
--
-- 'Not Applied Yet' was doing double duty: a live posting Gimmy hasn't
-- gotten to, and a target-list program whose next cycle hasn't posted at
-- all. Those need different action (apply now vs. watch for it), so they
-- get different statuses. Placed right after 'Not Applied Yet' so it reads
-- naturally in the status picker.

alter type opportunity_status add value if not exists 'Not Yet Open' after 'Not Applied Yet';
