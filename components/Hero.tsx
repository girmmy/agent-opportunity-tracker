'use client';

import * as React from 'react';
import { CalendarDays, Sparkles } from 'lucide-react';
import {
  countdownLabel,
  daysUntil,
  formatDate,
  type UpcomingEvent,
} from '@/lib/dates';

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
 * "now", and on Vercel the server clock is UTC — a server-rendered version
 * would say "Good morning" at 8pm in Atlanta and be a day off on deadlines.
 * Rendering waits for mount so server and client markup can't disagree.
 */
export function Hero({
  name,
  events,
  activeCount,
  awaitingCount,
}: {
  /** Optional — set OWNER_NAME to be greeted by name, or leave it unset. */
  name?: string;
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

  if (!now) {
    return <div className="mb-8 h-[188px] sm:h-[206px]" aria-hidden="true" />;
  }

  const summary = () => {
    if (next && next.days <= 7) {
      const when =
        next.days === 0
          ? 'today'
          : next.days === 1
            ? 'tomorrow'
            : `in ${next.days} days`;
      const what =
        next.kind === 'Starts'
          ? `${next.organization} starts`
          : `${next.organization} ${next.kind.toLowerCase()}`;
      return `${what} ${when}.`;
    }
    if (activeCount > 0 && awaitingCount > 0) {
      return `${activeCount} active, ${awaitingCount} awaiting a reply.`;
    }
    if (awaitingCount > 0) return `${awaitingCount} applications awaiting a reply.`;
    return 'Nothing scheduled. Good time to add something.';
  };

  return (
    <section className="mb-8">
      <div className="mb-5">
        <p
          className="rise text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--label-3)]"
          style={{ '--d': '0ms' } as React.CSSProperties}
        >
          {now.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        {/* The one place the display face earns its keep. Italic on the
            greeting, roman on the name — the shift is what makes it feel
            addressed to a person rather than printed by a system. */}
        <h2
          className="rise serif mt-1.5 text-[38px] leading-[1.05] sm:text-[46px]"
          style={{ '--d': '70ms' } as React.CSSProperties}
        >
          <span className="italic text-[var(--label-2)]">
            {greeting(now.getHours())}
            {name ? ',' : ''}
          </span>
          {name && <> <span className="text-[var(--label)]">{name}</span></>}
        </h2>

        <p
          className="rise mt-2.5 max-w-[52ch] text-[15px] text-[var(--label-2)]"
          style={{ '--d': '140ms' } as React.CSSProperties}
        >
          {summary()}
        </p>
      </div>

      {upcoming.length > 0 && (
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {upcoming.map((e, i) => {
            const color = KIND_COLOR[e.kind];
            const urgent = e.days <= 2;
            return (
              <div
                key={`${e.id}-${e.kind}`}
                className="rise flex min-w-[200px] flex-1 items-center gap-3 rounded-[var(--radius-apple-lg)] p-3.5 shadow-[var(--shadow-sm)]"
                style={
                  {
                    '--d': `${200 + i * 70}ms`,
                    background: urgent
                      ? `color-mix(in srgb, ${color} 11%, var(--surface))`
                      : 'var(--surface)',
                  } as React.CSSProperties
                }
              >
                <div
                  className="grid size-10 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                  }}
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
                      className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em]"
                      style={{ color }}
                    >
                      {e.kind}
                    </span>
                    <span className="tnum whitespace-nowrap text-[11px] text-[var(--label-3)]">
                      {formatDate(e.date)}
                    </span>
                  </div>
                  <div className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">
                    {e.organization}
                  </div>
                </div>

                {/* Countdown in the display face — it's the number that
                    actually matters on this screen. */}
                <div
                  className="serif tnum shrink-0 text-[22px] leading-none"
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
