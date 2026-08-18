-- Personal opportunity workspace: linked/standalone tasks, contacts, and history.
alter table opportunities add column if not exists next_action text;
alter table opportunities add column if not exists next_action_due date;
alter table opportunities add column if not exists fit_rationale text;
alter table opportunities add column if not exists decision_details jsonb not null default '{}'::jsonb;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(), title text not null check (length(trim(title)) > 0),
  status text not null default 'Open' check (status in ('Open','In Progress','Done','Cancelled')),
  priority text not null default 'Medium' check (priority in ('High','Medium','Low')),
  due_date date, opportunity_id uuid references opportunities(id) on delete set null,
  notes text, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) > 0), email text,
  organization text, title text, opportunity_id uuid references opportunities(id) on delete set null,
  last_contacted_at date, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists activity (
  id uuid primary key default gen_random_uuid(), opportunity_id uuid references opportunities(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  kind text not null default 'Note' check (kind in ('Note','Email','Status change','Interview','Assessment','Offer','Follow-up','Other')),
  body text not null check (length(trim(body)) > 0), occurred_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists tasks_due_idx on tasks (due_date);
create index if not exists tasks_opportunity_idx on tasks (opportunity_id);
create index if not exists contacts_opportunity_idx on contacts (opportunity_id);
create index if not exists activity_opportunity_idx on activity (opportunity_id, occurred_at desc);
drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at before update on tasks for each row execute function set_updated_at();
drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at before update on contacts for each row execute function set_updated_at();
alter table tasks enable row level security; alter table contacts enable row level security; alter table activity enable row level security;
grant select, insert, update, delete on table tasks, contacts, activity to service_role;
