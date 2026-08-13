import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, ChevronRight, Inbox } from 'lucide-react';
import { loadOpportunities } from '@/lib/data';
import { hasSession } from '@/lib/guard';
import { collectEvents } from '@/lib/dates';
import { TopBar } from '@/components/TopBar';
import { SetupBanner } from '@/components/SetupBanner';
import { Hero } from '@/components/Hero';
import { Pipeline } from '@/components/Pipeline';
import { StaleNudge } from '@/components/StaleNudge';
import { Pill } from '@/components/Pill';
import {
  ACTIVE_STATUSES,
  FIT_COLORS,
  OPPORTUNITY_TYPES,
  STATUS_COLORS,
  TYPE_COLORS,
  type Opportunity,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Prominent card — used for the handful of things that are actually live. */
function FeatureCard({ o }: { o: Opportunity }) {
  const accent = STATUS_COLORS[o.status];
  return (
    <div
      className="rounded-[var(--radius-apple-lg)] p-4 shadow-[var(--shadow-sm)]"
      style={{ background: `color-mix(in srgb, ${accent} 8%, var(--surface))` }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold leading-snug tracking-[-0.019em]">
            {o.role}
          </div>
          <div className="mt-0.5 text-[14px] text-[var(--label-2)]">
            {o.organization}
            {o.cycle ? ` · ${o.cycle}` : ''}
          </div>
        </div>
        {o.listing_url && (
          <a
            href={o.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open listing"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--label-2)] transition-colors hover:text-[var(--accent)]"
          >
            <ArrowUpRight className="size-4" />
          </a>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill label={o.status} color={accent} />
        <Pill label={o.opportunity_type} color={TYPE_COLORS[o.opportunity_type]} />
        {o.fit !== 'Unknown' && (
          <Pill label={`${o.fit} fit`} color={FIT_COLORS[o.fit]} />
        )}
      </div>
    </div>
  );
}

/** Compact row — used for the long tail, so it reads as secondary. */
function CompactRow({ o }: { o: Opportunity }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: STATUS_COLORS[o.status] }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{o.organization}</div>
        <div className="truncate text-[12.5px] text-[var(--label-3)]">{o.role}</div>
      </div>
      {o.fit !== 'Unknown' && (
        <Pill label={o.fit} color={FIT_COLORS[o.fit]} dot={false} />
      )}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  href,
}: {
  title: string;
  count?: number;
  href?: string;
}) {
  const inner = (
    <>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--label-3)]">
        {title}
      </h2>
      {count !== undefined && (
        <span className="tnum text-[13px] text-[var(--label-3)]">{count}</span>
      )}
      {href && <ChevronRight className="ml-auto size-4 text-[var(--label-3)]" />}
    </>
  );

  return href ? (
    <Link href={href} className="mb-2 flex items-center gap-2 px-1">
      {inner}
    </Link>
  ) : (
    <div className="mb-2 flex items-baseline gap-2 px-1">{inner}</div>
  );
}

export default async function OverviewPage() {
  if (!(await hasSession())) redirect('/login');

  const { opportunities, configured, error } = await loadOpportunities();

  const active = opportunities.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const interviewing = opportunities.filter(
    (o) => o.status === 'Interview in Progress'
  );
  const awaiting = opportunities.filter(
    (o) => o.status === 'Waiting for Response'
  );
  const notApplied = opportunities.filter((o) => o.status === 'Not Applied Yet');

  const events = collectEvents(opportunities);

  const byType = OPPORTUNITY_TYPES.map((t) => ({
    type: t,
    count: opportunities.filter((o) => o.opportunity_type === t).length,
  })).filter((r) => r.count > 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
      <TopBar />

      {(!configured || error) && <SetupBanner error={error} />}

      <Hero
        name="Gimmy"
        events={events}
        activeCount={active.length}
        awaitingCount={awaiting.length}
      />

      <StaleNudge rows={opportunities} />

      <Pipeline rows={opportunities} />

      {/* Live things get the prominent treatment; everything else is secondary. */}
      {(active.length > 0 || interviewing.length > 0) && (
        <section className="mb-6">
          <SectionHeader title="Happening now" count={active.length + interviewing.length} />
          <div className="grid gap-2.5 sm:grid-cols-2 [&>*]:min-w-0">
            {[...active, ...interviewing].map((o) => (
              <FeatureCard key={o.id} o={o} />
            ))}
          </div>
        </section>
      )}

      {/* min-w-0 on the children is load-bearing: grid items default to
          min-width:auto, so a long role name would refuse to shrink and push
          the whole page into horizontal scroll instead of truncating. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <SectionHeader
            title="Awaiting a reply"
            count={awaiting.length}
            href="/opportunities"
          />
          <div className="overflow-hidden rounded-[var(--radius-apple-lg)] bg-[var(--surface)] shadow-[var(--shadow-sm)] [&>*+*]:border-t [&>*+*]:border-[var(--separator)]">
            {awaiting.length ? (
              awaiting.slice(0, 6).map((o) => <CompactRow key={o.id} o={o} />)
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8">
                <Inbox className="size-5 text-[var(--label-3)]" strokeWidth={1.5} />
                <p className="text-[13px] text-[var(--label-2)]">
                  Nothing pending.
                </p>
              </div>
            )}
            {awaiting.length > 6 && (
              <Link
                href="/opportunities"
                className="block px-4 py-2.5 text-[13px] font-medium text-[var(--accent)]"
              >
                {awaiting.length - 6} more
              </Link>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <SectionHeader title="On the radar" count={notApplied.length} />
          <div className="overflow-hidden rounded-[var(--radius-apple-lg)] bg-[var(--surface)] shadow-[var(--shadow-sm)] [&>*+*]:border-t [&>*+*]:border-[var(--separator)]">
            {notApplied.length ? (
              notApplied.slice(0, 6).map((o) => <CompactRow key={o.id} o={o} />)
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8">
                <Inbox className="size-5 text-[var(--label-3)]" strokeWidth={1.5} />
                <p className="text-[13px] text-[var(--label-2)]">
                  Nothing queued up.
                </p>
              </div>
            )}
            {notApplied.length > 6 && (
              <Link
                href="/opportunities"
                className="block px-4 py-2.5 text-[13px] font-medium text-[var(--accent)]"
              >
                {notApplied.length - 6} more
              </Link>
            )}
          </div>
        </section>
      </div>

      {byType.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="By type" />
          <div className="flex flex-wrap gap-2">
            {byType.map((r) => (
              <div
                key={r.type}
                className="flex items-center gap-2 rounded-full bg-[var(--surface)] py-1.5 pl-2.5 pr-3.5 shadow-[var(--shadow-sm)]"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: TYPE_COLORS[r.type] }}
                  aria-hidden="true"
                />
                <span className="text-[13px] font-medium">{r.type}</span>
                <span className="tnum text-[13px] text-[var(--label-3)]">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
