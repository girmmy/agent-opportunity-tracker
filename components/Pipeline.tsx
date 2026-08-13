import { type Opportunity } from '@/lib/types';

/**
 * Where everything currently stands, as one bar.
 *
 * A stacked proportional bar answers "how is this going" faster than five
 * separate counters, because the relative widths carry the message — a wide
 * red band next to a thin green one says something a list of numbers doesn't.
 * Counts stay on the legend so nothing is only encoded as color (and so the
 * small segments remain readable).
 */

const BANDS = [
  { key: 'active', label: 'Active', color: 'var(--green)' },
  { key: 'interview', label: 'Interviewing', color: 'var(--purple)' },
  { key: 'waiting', label: 'Awaiting reply', color: 'var(--blue)' },
  { key: 'todo', label: 'Not applied', color: 'var(--label-3)' },
  { key: 'closed', label: 'Closed', color: 'var(--red)' },
] as const;

type BandKey = (typeof BANDS)[number]['key'];

function bandFor(status: Opportunity['status']): BandKey {
  switch (status) {
    case 'Accepted / Active':
    case 'Return Offer':
    case 'Offer Received':
      return 'active';
    case 'Interview in Progress':
      return 'interview';
    case 'Waiting for Response':
    case 'In Progress (Applying)':
      return 'waiting';
    case 'Not Applied Yet':
    case 'Not Yet Open':
      return 'todo';
    default:
      return 'closed';
  }
}

export function Pipeline({ rows }: { rows: Opportunity[] }) {
  if (rows.length === 0) return null;

  const counts = Object.fromEntries(BANDS.map((b) => [b.key, 0])) as Record<
    BandKey,
    number
  >;
  for (const r of rows) counts[bandFor(r.status)] += 1;

  const total = rows.length;
  const present = BANDS.filter((b) => counts[b.key] > 0);

  return (
    <section className="mb-6">
      <div className="rounded-[var(--radius-apple-lg)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--label-3)]">
            Pipeline
          </h2>
          <span className="serif tnum text-[17px] text-[var(--label-2)]">
            {total}
          </span>
        </div>

        <div
          className="flex h-2.5 gap-[3px] overflow-hidden rounded-full"
          role="img"
          aria-label={present
            .map((b) => `${counts[b.key]} ${b.label.toLowerCase()}`)
            .join(', ')}
        >
          {present.map((b) => (
            <div
              key={b.key}
              className="h-full rounded-full transition-[flex-grow] duration-500"
              style={{
                background: b.color,
                // A hard minimum keeps a single-row band from vanishing.
                flexGrow: Math.max(counts[b.key] / total, 0.02),
              }}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {present.map((b) => (
            <div key={b.key} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: b.color }}
                aria-hidden="true"
              />
              <span className="tnum text-[13px] font-semibold">
                {counts[b.key]}
              </span>
              <span className="text-[13px] text-[var(--label-2)]">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
