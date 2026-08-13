import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, CalendarClock, Inbox } from 'lucide-react';
import { loadOpportunities } from '@/lib/data';
import { hasSession } from '@/lib/guard';
import { TopBar } from '@/components/TopBar';
import { SetupBanner } from '@/components/SetupBanner';
import { Pill } from '@/components/Pill';
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  IN_FLIGHT_STATUSES,
  FIT_COLORS,
  OPPORTUNITY_TYPES,
  STATUS_COLORS,
  TYPE_COLORS,
  type Opportunity,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function friendlyDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3])
  ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Stat({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="rounded-[var(--radius-apple)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
      <div
        className="tnum text-[27px] font-semibold leading-none tracking-[-0.022em]"
        style={color ? { color } : undefined}
      >
        {n}
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-[var(--label-2)]">
        {label}
      </div>
    </div>
  );
}

function Row({ o, showDeadline }: { o: Opportunity; showDeadline?: boolean }) {
  const d = showDeadline ? daysUntil(o.deadline) : null;
  const urgent = d !== null && d <= 7;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium tracking-[-0.01em]">
          {o.role}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-[var(--label-2)]">
          {o.organization}
          {o.cycle ? ` · ${o.cycle}` : ''}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill label={o.status} color={STATUS_COLORS[o.status]} />
          <Pill
            label={o.opportunity_type}
            color={TYPE_COLORS[o.opportunity_type]}
          />
          {o.fit !== 'Unknown' && (
            <Pill label={`${o.fit} fit`} color={FIT_COLORS[o.fit]} />
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {d !== null && (
          <span
            className="tnum whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
            style={{
              color: urgent ? 'var(--red)' : 'var(--label-2)',
              background: urgent
                ? 'color-mix(in srgb, var(--red) 12%, transparent)'
                : 'var(--surface-sunken)',
            }}
          >
            {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d}d`}
          </span>
        )}
        {o.listing_url && (
          <a
            href={o.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--label-3)] transition-colors hover:text-[var(--accent)]"
            aria-label="Open listing"
          >
            <ArrowUpRight className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--label-3)]">
          {title}
        </h2>
        {count !== undefined && (
          <span className="tnum text-[13px] text-[var(--label-3)]">{count}</span>
        )}
      </div>
      <div className="overflow-hidden rounded-[var(--radius-apple-lg)] bg-[var(--surface)] shadow-[var(--shadow-sm)] [&>*+*]:border-t [&>*+*]:border-[var(--separator)]">
        {children}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Inbox className="size-6 text-[var(--label-3)]" strokeWidth={1.5} />
      <p className="text-[13px] text-[var(--label-2)]">{text}</p>
    </div>
  );
}

export default async function OverviewPage() {
  if (!(await hasSession())) redirect('/login');

  const { opportunities, configured, error } = await loadOpportunities();

  const active = opportunities.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const interviewing = opportunities.filter(
    (o) => o.status === 'Interview in Progress'
  );
  const inFlight = opportunities.filter((o) =>
    IN_FLIGHT_STATUSES.includes(o.status)
  );
  const open = opportunities.filter((o) => !CLOSED_STATUSES.includes(o.status));

  // Anything already surfaced above doesn't repeat here — the same card twice
  // on one screen reads as a rendering bug, not as emphasis.
  const alreadyShown = new Set([
    ...active.map((o) => o.id),
    ...interviewing.map((o) => o.id),
  ]);

  const upcoming = open
    .filter((o) => {
      if (alreadyShown.has(o.id)) return false;
      const d = daysUntil(o.deadline);
      return d !== null && d >= 0 && d <= 30;
    })
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));

  const byType = OPPORTUNITY_TYPES.map((t) => ({
    type: t,
    total: opportunities.filter((o) => o.opportunity_type === t).length,
    live: open.filter((o) => o.opportunity_type === t).length,
  })).filter((r) => r.total > 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
      <TopBar />

      {(!configured || error) && <SetupBanner error={error} />}

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat n={active.length} label="Active" color="var(--green)" />
        <Stat
          n={interviewing.length}
          label="Interviewing"
          color="var(--purple)"
        />
        <Stat n={inFlight.length} label="In flight" color="var(--blue)" />
        <Stat n={opportunities.length} label="Tracked" />
      </div>

      <Section title="Active right now" count={active.length || undefined}>
        {active.length ? (
          active.map((o) => <Row key={o.id} o={o} />)
        ) : (
          <Empty text="Nothing accepted or active yet." />
        )}
      </Section>

      {interviewing.length > 0 && (
        <Section title="Interviewing" count={interviewing.length}>
          {interviewing.map((o) => (
            <Row key={o.id} o={o} showDeadline />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Next 30 days" count={upcoming.length}>
          {upcoming.map((o) => (
            <Row key={o.id} o={o} showDeadline />
          ))}
        </Section>
      )}

      {byType.length > 0 && (
        <Section title="By type">
          {byType.map((r) => (
            <div key={r.type} className="flex items-center gap-3 px-4 py-3">
              <Pill label={r.type} color={TYPE_COLORS[r.type]} />
              <div className="flex-1" />
              <span className="tnum text-[13px]">
                <span className="font-semibold">{r.live}</span>
                <span className="text-[var(--label-3)]"> live</span>
              </span>
              <span className="tnum w-16 text-right text-[13px] text-[var(--label-3)]">
                {r.total} total
              </span>
            </div>
          ))}
        </Section>
      )}

      {opportunities.length > 0 && (
        <Link
          href="/opportunities"
          className="flex items-center justify-center gap-1.5 rounded-[var(--radius-apple)] bg-[var(--surface)] px-4 py-3.5 text-[14px] font-medium text-[var(--accent)] shadow-[var(--shadow-sm)] transition-transform active:scale-[0.99]"
        >
          <CalendarClock className="size-4" />
          See all {opportunities.length} opportunities
        </Link>
      )}
    </div>
  );
}

export { friendlyDate };
