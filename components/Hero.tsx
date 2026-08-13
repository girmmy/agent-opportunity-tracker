'use client';

import * as React from 'react';
import { CalendarDays, Sparkles } from 'lucide-react';
import { countdownLabel, daysUntil, formatDate, type UpcomingEvent } from '@/lib/dates';
import { cn } from '@/lib/utils';

const KIND_COLOR: Record<UpcomingEvent['kind'], string> = {
  Interview: 'var(--purple)',
  Starts: 'var(--green)',
  Deadline: 'var(--orange)',
};

function greeting(hour: number): string {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Client component on purpose. The greeting and every countdown compare against
 * "now", and on Vercel the server clock is UTC — a server-rendered version would
 * say "Good morning" at 8pm in Atlanta and be a day off on deadlines.
 *
 * Rendering is deferred to after mount so the server and client markup match;
 * otherwise React hydration warns about the text differing.
 */
export function Hero({
  name,
  events,
  activeCount,
  awaitingCount,
}: {
  name: string;
  events: UpcomingEvent[];
  activeCount: number;
  awaitingCount: number;
}) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);

  const upcoming = React.useMemo(
    () =>
      events
        .map((e) => ({ ...e, days: daysUntil(e.date) }))
        .filter((e): e is UpcomingEvent & { days: number } => e.days !== null)
        .filter((e) => e.days >= 0)
        .slice(0, 3),
    [events]
  );

  const next = upcoming[0];

  // Reserve the same vertical space pre-hydration so the page doesn't jump.
  if (!now) {
    return <div className="mb-6 h-[132px] sm:h-[124px]" aria-hidden="true" />;
  }

  const summary = () => {
    if (next && next.days <= 7) {
      const when =
        next.days === 0
          ? 'today'
          : next.days === 1
            ? 'tomorrow'
            : `in ${next.days} days`;
      return `${next.kind === 'Starts' ? `${next.organization} starts` : `${next.organization} ${next.kind.toLowerCase()}`} ${when}.`;
    }
    if (activeCount > 0 && awaitingCount > 0) {
      return `${activeCount} active, ${awaitingCount} awaiting a reply.`;
    }
    if (awaitingCount > 0) return `${awaitingCount} applications awaiting a reply.`;
    return 'Nothing scheduled. Good time to add something.';
  };

  return (
    <section className="mb-6">
      <div className="mb-4">
        <p className="text-[13px] font-medium text-[var(--label-3)]">
          {now.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h2 className="mt-0.5 text-[28px] font-semibold leading-tight tracking-[-0.026em] sm:text-[32px]">
          {greeting(now.getHours())}, {name}
        </h2>
        <p className="mt-1 text-[15px] text-[var(--label-2)]">{summary()}</p>
      </div>

      {upcoming.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {upcoming.map((e) => {
            const color = KIND_COLOR[e.kind];
            const urgent = e.days <= 2;
            return (
              <div
                key={`${e.id}-${e.kind}`}
                className={cn(
                  'flex min-w-[190px] flex-1 items-center gap-3 rounded-[var(--radius-apple-lg)] p-3.5 shadow-[var(--shadow-sm)]'
                )}
                style={{
                  background: urgent
                    ? `color-mix(in srgb, ${color} 12%, var(--surface))`
                    : 'var(--surface)',
                }}
              >
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
                >
                  {e.kind === 'Starts' ? (
                    <Sparkles className="size-4" style={{ color }} strokeWidth={2.2} />
                  ) : (
                    <CalendarDays className="size-4" style={{ color }} strokeWidth={2.2} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em]"
                      style={{ color }}
                    >
                      {e.kind}
                    </span>
                    <span className="tnum whitespace-nowrap text-[11px] text-[var(--label-3)]">
                      {formatDate(e.date)}
                    </span>
                  </div>
                  <div className="truncate text-[14px] font-medium">
                    {e.organization}
                  </div>
                </div>

                <div
                  className="tnum shrink-0 text-[15px] font-semibold"
                  style={{ color: urgent ? color : 'var(--label-2)' }}
                >
                  {countdownLabel(e.days)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
