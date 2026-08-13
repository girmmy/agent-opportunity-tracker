'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { CalendarIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';

/**
 * Dates are stored as plain `YYYY-MM-DD` (Postgres `date`, no time or zone).
 *
 * Parsing that with `new Date('2026-08-18')` is a trap: the ISO form is read as
 * UTC midnight, which renders as the *previous day* anywhere west of Greenwich
 * — pick Aug 18 in a US timezone and you see Aug 17. Constructing from
 * explicit parts keeps everything in local time.
 */
function parseISODate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "in 6 days" / "3 days ago" — the thing you actually want to know at a glance. */
export function relativeDay(value: string | null | undefined): string | null {
  const d = parseISODate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  id,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseISODate(value);
  const rel = relativeDay(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(
              'flex h-10 w-full items-center gap-2 rounded-[10px] bg-[var(--surface-sunken)] px-3 text-left text-base tracking-[-0.01em] transition-shadow duration-150 sm:text-[14px]',
              'border border-transparent focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]',
              !selected && 'text-[var(--label-3)]'
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-[var(--label-3)]" />
            {selected ? (
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate">{formatDisplay(selected)}</span>
                {rel && (
                  <span className="shrink-0 text-[12px] text-[var(--label-3)]">
                    {rel}
                  </span>
                )}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
          </button>
        </PopoverTrigger>

        {selected && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => onChange(null)}
            className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-[var(--label-3)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--label)]"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      <PopoverContent className="w-auto p-3">
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={selected}
          showOutsideDays
          onSelect={(d) => {
            onChange(d ? toISODate(d) : null);
            setOpen(false);
          }}
        />
        <div className="mt-2 flex gap-1.5 border-t border-[var(--separator)] pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => {
              onChange(toISODate(new Date()));
              setOpen(false);
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { parseISODate, toISODate, formatDisplay };
