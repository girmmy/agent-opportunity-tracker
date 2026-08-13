-- The résumé tailoring needs a name for the output filename. Without one it
-- produced "Georgia Tech Freshman - Acme - Role.pdf" — a description of the
-- person where their name belonged.

alter table profile add column if not exists full_name text;
