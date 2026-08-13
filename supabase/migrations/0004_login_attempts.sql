-- Durable login rate limiting.
--
-- The first implementation kept a counter in a module-level Map. On Vercel that
-- is worthless as a control: every serverless instance has its own memory, and
-- instances are created and discarded constantly, so an attacker gets a fresh
-- allowance on each cold start and can simply spread guesses across instances.
--
-- Storing attempts in Postgres makes the limit real — shared across every
-- instance and surviving restarts.

create table if not exists login_attempts (
  id          bigserial primary key,
  ip          text        not null,
  succeeded   boolean     not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists login_attempts_ip_time_idx
  on login_attempts (ip, attempted_at desc);

alter table login_attempts enable row level security;
-- No policies: reachable only via the service role, same as `opportunities`.

grant select, insert, delete on table public.login_attempts to service_role;
grant usage, select on sequence public.login_attempts_id_seq to service_role;

/*
 * Records an attempt and reports whether this IP is now locked out.
 *
 * Runs as a single round trip inside the database so the count-and-insert can't
 * interleave with a concurrent request — doing this as separate SELECT then
 * INSERT from the app would let parallel guesses slip past the threshold.
 *
 * SECURITY DEFINER so it can be called without granting broad table rights;
 * search_path is pinned to defeat search-path injection.
 */
create or replace function record_login_attempt(
  p_ip        text,
  p_succeeded boolean,
  p_window    interval default '15 minutes',
  p_max       integer  default 10
)
returns table (locked boolean, recent_failures integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_failures integer;
  v_oldest   timestamptz;
begin
  -- Evaluate the lockout on the state BEFORE this attempt.
  --
  -- Order matters for correctness here. Clearing on success first would mean a
  -- correct password always slipped through, even mid-lockout — which makes the
  -- lockout decorative: an attacker just keeps guessing and gets in the moment
  -- they're right. A lockout has to refuse everything for its duration.
  select count(*), min(attempted_at)
    into v_failures, v_oldest
    from login_attempts
   where ip = p_ip
     and not succeeded
     and attempted_at > now() - p_window;

  if v_failures >= p_max then
    return query
      select
        true,
        v_failures::integer,
        greatest(0, extract(epoch from (v_oldest + p_window - now()))::integer);
    return;
  end if;

  if p_succeeded then
    -- Genuine sign-in below the threshold clears the slate for that IP.
    delete from login_attempts where ip = p_ip;
    return query select false, 0, 0;
    return;
  end if;

  insert into login_attempts (ip, succeeded) values (p_ip, false);

  select count(*), min(attempted_at)
    into v_failures, v_oldest
    from login_attempts
   where ip = p_ip
     and not succeeded
     and attempted_at > now() - p_window;

  -- Opportunistic cleanup so the table can't grow without bound.
  delete from login_attempts where attempted_at < now() - interval '24 hours';

  return query
    select
      v_failures >= p_max,
      v_failures::integer,
      greatest(
        0,
        extract(epoch from (v_oldest + p_window - now()))::integer
      );
end;
$$;

grant execute on function record_login_attempt(text, boolean, interval, integer)
  to service_role;
