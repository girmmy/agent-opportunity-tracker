-- A canonical master résumé, distinct from the free-text profile fields.
--
-- The profile's skills/experience/projects fields are a synthesis the user
-- edits by hand and can drift from any résumé they've uploaded. This is the
-- opposite: the literal file the user actually sends out, kept as its own
-- artifact so it can be previewed, and so any agent reading the profile gets
-- its exact wording rather than a paraphrase.
--
-- resume_file is bytea rather than object storage — this is a single-row,
-- single-user table, one PDF well under a few MB, and keeping it in Postgres
-- avoids adding a storage bucket and its own auth model for one file.

alter table profile
  add column if not exists resume_file bytea,
  add column if not exists resume_filename text,
  add column if not exists resume_content_type text,
  add column if not exists resume_text text,
  add column if not exists resume_uploaded_at timestamptz;
