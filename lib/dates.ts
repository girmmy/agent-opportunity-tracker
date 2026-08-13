/**
 * Date helpers for plain `YYYY-MM-DD` values (Postgres `date` — no time, no zone).
 *
 * Everything here builds Date objects from explicit parts. `new Date('2026-08-18')`
 * parses ISO as UTC midnight, which renders as the previous day anywhere west of
 * Greenwich — so in Atlanta a deadline would read one day early.
 *
 * Anything that compares against "now" must run in the browser: on Vercel the
 * server clock is UTC, so a server-rendered countdown is wrong for several hours
 * every evening. Callers of `daysUntil` should be client components.
 */

export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntil(value: string | null | undefined): number | null {
  const d = parseISODate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function daysSince(value: string | null | undefined): number | null {
  const n = daysUntil(value);
  return n === null ? null : -n;
}

export function formatDate(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string | null {
  const d = parseISODate(value);
  return d ? d.toLocaleDateString(undefined, opts) : null;
}

export function countdownLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days}d`;
}

/**
 * A dated thing worth showing on the dashboard.
 *
 * Dates live in more than one place depending on the kind of opportunity —
 * an application deadline in `deadline`, an interview or a contract start in
 * `details` — so the dashboard has to look in all of them or it silently
 * misses the events that matter most.
 */
export interface UpcomingEvent {
  id: string;
  organization: string;
  role: string;
  kind: 'Deadline' | 'Interview' | 'Starts';
  date: string;
}

export function collectEvents(
  rows: {
    id: string;
    organization: string;
    role: string;
    deadline: string | null;
    details: Record<string, unknown>;
  }[]
): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];

  for (const r of rows) {
    const base = { id: r.id, organization: r.organization, role: r.role };

    const interview = r.details?.interview_date;
    if (typeof interview === 'string') {
      events.push({ ...base, kind: 'Interview', date: interview });
    }

    const start = r.details?.start_date;
    if (typeof start === 'string') {
      events.push({ ...base, kind: 'Starts', date: start });
    }

    // Don't double-count a deadline that just mirrors the interview date.
    if (r.deadline && r.deadline !== interview) {
      events.push({ ...base, kind: 'Deadline', date: r.deadline });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
