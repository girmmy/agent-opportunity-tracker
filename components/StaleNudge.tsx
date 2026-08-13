'use client';

import Link from 'next/link';
import * as React from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { daysSince } from '@/lib/dates';
import type { Opportunity } from '@/lib/types';

const STALE_AFTER_DAYS = 21;

/**
 * Applications that have gone quiet.
 *
 * The point of a tracker is to surface the thing you'd otherwise forget, and
 * "applied seven weeks ago, never heard back" is exactly that — it looks
 * identical to a healthy row in a list, but it's the one worth a follow-up.
 *
 * Client-side because it compares dates to today; see lib/dates.ts.
 */
export function StaleNudge({ rows }: { rows: Opportunity[] }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const stale = React.useMemo(
    () =>
      rows
        .filter((r) => r.status === 'Waiting for Response' && r.date_applied)
        .map((r) => ({ row: r, days: daysSince(r.date_applied) ?? 0 }))
        .filter((x) => x.days >= STALE_AFTER_DAYS)
        .sort((a, b) => b.days - a.days),
    [rows]
  );

  if (!mounted || stale.length === 0) return null;

  const longest = stale[0]!;

  return (
    <Link
      href="/opportunities"
      className="mb-6 flex items-center gap-3 rounded-[var(--radius-apple-lg)] p-4 shadow-[var(--shadow-sm)] transition-transform active:scale-[0.99]"
      style={{ background: 'color-mix(in srgb, var(--orange) 10%, var(--surface))' }}
    >
      <div
        className="grid size-9 shrink-0 place-items-center rounded-full"
        style={{ background: 'color-mix(in srgb, var(--orange) 18%, transparent)' }}
      >
        <Clock className="size-4 text-[var(--orange)]" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">
          {stale.length} application{stale.length === 1 ? '' : 's'} gone quiet
        </p>
        <p className="mt-0.5 truncate text-[13px] text-[var(--label-2)]">
          {longest.row.organization} — no reply in {longest.days} days
          {stale.length > 1 ? ` · ${stale.length - 1} more` : ''}
        </p>
      </div>

      <ChevronRight className="size-4 shrink-0 text-[var(--label-3)]" />
    </Link>
  );
}
