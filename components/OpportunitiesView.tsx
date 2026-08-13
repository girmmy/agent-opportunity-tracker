'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  ArrowUpDown,
  Check,
  Columns3,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Pill } from '@/components/Pill';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker, relativeDay } from '@/components/ui/date-picker';
import { AiPanel } from '@/components/AiPanel';
import { cn } from '@/lib/utils';
import {
  CATEGORIES,
  CLOSED_STATUSES,
  COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  FITS,
  FIT_COLORS,
  OPPORTUNITY_TYPES,
  STATUSES,
  STATUS_COLORS,
  TYPE_COLORS,
  type Fit,
  type Opportunity,
  type OpportunityType,
  type Status,
} from '@/lib/types';

type Draft = Partial<Opportunity> & { id?: string };

const EMPTY_DRAFT: Draft = {
  organization: '',
  role: '',
  opportunity_type: 'Internship',
  category: 'SWE',
  cycle: '',
  status: 'Not Applied Yet',
  fit: 'Unknown',
  date_applied: null,
  deadline: null,
  listing_url: '',
  resume_used: '',
  source: '',
  notes: '',
};

const COLS_STORAGE_KEY = 'got.visibleColumns';

function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3])
  ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export function OpportunitiesView({
  initial,
  aiEnabled,
}: {
  initial: Opportunity[];
  aiEnabled: boolean;
}) {
  const router = useRouter();

  const [rows, setRows] = React.useState<Opportunity[]>(initial);
  const [typeTab, setTypeTab] = React.useState<OpportunityType | 'All'>('All');
  const [statusFilter, setStatusFilter] = React.useState<Set<Status>>(new Set());
  const [fitFilter, setFitFilter] = React.useState<Set<Fit>>(new Set());
  const [cycleFilter, setCycleFilter] = React.useState<Set<string>>(new Set());
  const [hideClosed, setHideClosed] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string>('updated_at');
  const [sortDir, setSortDir] = React.useState<1 | -1>(-1);

  const [visibleCols, setVisibleCols] = React.useState<string[]>(
    DEFAULT_VISIBLE_COLUMNS
  );

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');

  // Column choices are a per-device preference, not shared state — localStorage
  // rather than the database. Read after mount so SSR and client markup match.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(COLS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length) setVisibleCols(parsed);
      }
    } catch {
      /* corrupt or unavailable storage — defaults are fine */
    }
  }, []);

  function toggleColumn(key: string) {
    setVisibleCols((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      try {
        localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function resetColumns() {
    setVisibleCols(DEFAULT_VISIBLE_COLUMNS);
    try {
      localStorage.removeItem(COLS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const cycles = React.useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.cycle).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (typeTab !== 'All' && r.opportunity_type !== typeTab) return false;
      if (hideClosed && CLOSED_STATUSES.includes(r.status)) return false;
      if (statusFilter.size && !statusFilter.has(r.status)) return false;
      if (fitFilter.size && !fitFilter.has(r.fit)) return false;
      if (cycleFilter.size && !cycleFilter.has(r.cycle ?? '')) return false;
      if (q) {
        const hay = `${r.organization} ${r.role} ${r.notes ?? ''} ${r.cycle ?? ''} ${r.source ?? ''}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    return out.sort((a, b) => {
      const av = (a[sortKey as keyof Opportunity] ?? '') as string;
      const bv = (b[sortKey as keyof Opportunity] ?? '') as string;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [
    rows,
    typeTab,
    hideClosed,
    statusFilter,
    fitFilter,
    cycleFilter,
    search,
    sortKey,
    sortDir,
  ]);

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = { All: rows.length };
    for (const t of OPPORTUNITY_TYPES) {
      counts[t] = rows.filter((r) => r.opportunity_type === t).length;
    }
    return counts;
  }, [rows]);

  const activeFilterCount =
    statusFilter.size + fitFilter.size + cycleFilter.size + (hideClosed ? 0 : 1);

  function clearFilters() {
    setStatusFilter(new Set());
    setFitFilter(new Set());
    setCycleFilter(new Set());
    setHideClosed(true);
    setSearch('');
  }

  function toggleIn<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setter(next);
  }

  async function save() {
    if (!draft) return;
    if (!draft.organization?.trim() || !draft.role?.trim()) {
      setSaveError('Organization and role are both required.');
      return;
    }

    setSaving(true);
    setSaveError('');

    const payload: Record<string, unknown> = { ...draft };
    for (const k of [
      'date_applied',
      'deadline',
      'cycle',
      'listing_url',
      'resume_used',
      'source',
      'notes',
    ]) {
      if (payload[k] === '') payload[k] = null;
    }
    delete payload.id;

    try {
      const res = draft.id
        ? await fetch(`/api/opportunities/${draft.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/opportunities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || 'Save failed.');
        return;
      }

      const saved: Opportunity = data.opportunity;
      setRows((prev) =>
        draft.id
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [saved, ...prev]
      );
      setDraft(null);
      router.refresh();
    } catch {
      setSaveError('Network error. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    const res = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDraft(null);
      router.refresh();
    }
  }

  /** Inline status change — by far the most common edit, so it skips the sheet. */
  async function quickStatus(row: Opportunity, status: Status) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status } : r)));

    const res = await fetch(`/api/opportunities/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) setRows(prev);
    else router.refresh();
  }

  const shown = COLUMNS.filter((c) => visibleCols.includes(c.key));

  function cellFor(r: Opportunity, key: string) {
    switch (key) {
      case 'organization':
        return <span className="font-medium">{r.organization}</span>;
      case 'role':
        return <span className="text-[var(--label-2)]">{r.role}</span>;
      case 'opportunity_type':
        return (
          <Pill
            label={r.opportunity_type}
            color={TYPE_COLORS[r.opportunity_type]}
          />
        );
      case 'status':
        return (
          <Select
            value={r.status}
            onValueChange={(v) => quickStatus(r, v as Status)}
          >
            <SelectTrigger className="h-7 w-[186px] border-0 bg-transparent px-2 text-[12.5px] font-medium hover:bg-[var(--surface-sunken)]">
              <span
                className="truncate whitespace-nowrap"
                style={{ color: STATUS_COLORS[r.status] }}
              >
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'fit':
        return <Pill label={r.fit} color={FIT_COLORS[r.fit]} />;
      case 'category':
        return <span className="text-[13px]">{r.category}</span>;
      case 'cycle':
        return <span className="whitespace-nowrap text-[13px]">{r.cycle ?? '—'}</span>;
      case 'date_applied':
        return <span className="tnum whitespace-nowrap text-[13px]">{shortDate(r.date_applied)}</span>;
      case 'deadline': {
        const rel = relativeDay(r.deadline);
        return (
          <span className="tnum whitespace-nowrap text-[13px]">
            {shortDate(r.deadline)}
            {rel && (
              <span className="ml-1 text-[11.5px] text-[var(--label-3)]">
                {rel}
              </span>
            )}
          </span>
        );
      }
      case 'resume_used':
        return (
          <span className="text-[12.5px] text-[var(--label-2)]">
            {r.resume_used ?? '—'}
          </span>
        );
      case 'source':
        return (
          <span className="text-[12.5px] text-[var(--label-2)]">
            {r.source ?? '—'}
          </span>
        );
      case 'listing_url':
        return r.listing_url ? (
          <a
            href={r.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[13px] text-[var(--accent)]"
          >
            Open <ArrowUpRight className="size-3.5" />
          </a>
        ) : (
          <span className="text-[var(--label-3)]">—</span>
        );
      case 'notes':
        return (
          <span className="line-clamp-2 text-[12.5px] text-[var(--label-2)]">
            {r.notes ?? '—'}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <>
      {/* Type segmented control — horizontally scrollable on phones */}
      <div className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex gap-1 rounded-[10px] bg-[var(--surface-sunken)] p-1">
          {(['All', ...OPPORTUNITY_TYPES] as const).map((t) => {
            const active = typeTab === t;
            return (
              <button
                key={t}
                onClick={() => setTypeTab(t as OpportunityType | 'All')}
                className={cn(
                  'whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-all duration-200',
                  active
                    ? 'bg-[var(--surface)] text-[var(--label)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--label-2)] hover:text-[var(--label)]'
                )}
              >
                {t}
                {typeCounts[t] ? (
                  <span className="tnum ml-1.5 text-[var(--label-3)]">
                    {typeCounts[t]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      {/* Search gets its own row on phones; cramming it beside three controls
          pushed the Add button onto a line of its own. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:flex-1 sm:max-w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--label-3)]" />
          <Input
            type="search"
            placeholder="Search"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={activeFilterCount ? 'tinted' : 'secondary'}>
              <Filter />
              Filter
              {activeFilterCount > 0 && (
                <span className="tnum ml-0.5 rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-[70vh] overflow-y-auto">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statusFilter.has(s)}
                onCheckedChange={() =>
                  toggleIn(statusFilter, s, setStatusFilter)
                }
                onSelect={(e) => e.preventDefault()}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: STATUS_COLORS[s] }}
                />
                {s}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Fit</DropdownMenuLabel>
            {FITS.map((f) => (
              <DropdownMenuCheckboxItem
                key={f}
                checked={fitFilter.has(f)}
                onCheckedChange={() => toggleIn(fitFilter, f, setFitFilter)}
                onSelect={(e) => e.preventDefault()}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: FIT_COLORS[f] }}
                />
                {f}
              </DropdownMenuCheckboxItem>
            ))}

            {cycles.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Cycle</DropdownMenuLabel>
                {cycles.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c}
                    checked={cycleFilter.has(c)}
                    onCheckedChange={() =>
                      toggleIn(cycleFilter, c, setCycleFilter)
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={!hideClosed}
              onCheckedChange={() => setHideClosed((v) => !v)}
              onSelect={(e) => e.preventDefault()}
            >
              Show closed &amp; rejected
            </DropdownMenuCheckboxItem>

            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters}>
                  <X className="size-4" />
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="hidden lg:inline-flex">
              <Columns3 />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            {COLUMNS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.key}
                checked={visibleCols.includes(c.key)}
                disabled={c.locked}
                onCheckedChange={() => toggleColumn(c.key)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.label}
                {c.locked && (
                  <span className="ml-auto pr-4 text-[11px] text-[var(--label-3)]">
                    always
                  </span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetColumns}>
              Reset to default
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <ArrowUpDown />
              <span className="hidden sm:inline">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {[
              { key: 'updated_at', label: 'Recently updated' },
              { key: 'organization', label: 'Organization' },
              { key: 'date_applied', label: 'Date applied' },
              { key: 'deadline', label: 'Deadline' },
              { key: 'fit', label: 'Fit' },
              { key: 'status', label: 'Status' },
            ].map((s) => (
              <DropdownMenuItem
                key={s.key}
                onClick={() => {
                  if (sortKey === s.key) setSortDir((d) => (d === 1 ? -1 : 1));
                  else {
                    setSortKey(s.key);
                    setSortDir(1);
                  }
                }}
              >
                {sortKey === s.key && (
                  <Check className="size-4 text-[var(--accent)]" />
                )}
                <span className={cn(sortKey !== s.key && 'ml-6')}>
                  {s.label}
                </span>
                {sortKey === s.key && (
                  <span className="ml-auto text-[11px] text-[var(--label-3)]">
                    {sortDir === 1 ? 'asc' : 'desc'}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="primary"
          className="ml-auto sm:ml-0"
          onClick={() => {
            setSaveError('');
            setDraft({ ...EMPTY_DRAFT });
          }}
        >
          <Plus />
          Add
        </Button>
      </div>

      {visible.length !== rows.length && (
        <p className="mb-2 px-1 text-[12.5px] text-[var(--label-3)]">
          Showing {visible.length} of {rows.length}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[var(--radius-apple-lg)] bg-[var(--surface)] px-4 py-14 text-center shadow-[var(--shadow-sm)]">
          <p className="text-[14px] text-[var(--label-2)]">
            {rows.length === 0
              ? 'Nothing tracked yet.'
              : 'No results match these filters.'}
          </p>
          {activeFilterCount > 0 && (
            <Button variant="ghost" className="mt-3" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-apple-lg)] bg-[var(--surface)] shadow-[var(--shadow-sm)] lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--separator)]">
                    {shown.map((c) => (
                      <th
                        key={c.key}
                        className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--label-3)]"
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--separator)] transition-colors last:border-0 hover:bg-[var(--surface-sunken)]"
                    >
                      {shown.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            'px-3 py-2.5 align-middle text-[13.5px]',
                            c.key === 'role' && 'min-w-[200px] max-w-[280px]',
                            c.key === 'notes' && 'max-w-[280px]'
                          )}
                        >
                          {cellFor(r, c.key)}
                        </td>
                      ))}
                      <td className="px-2">
                        <button
                          onClick={() => {
                            setSaveError('');
                            setDraft({ ...r });
                          }}
                          className="rounded-md px-2 py-1 text-[12.5px] font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / tablet cards */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {visible.map((r) => {
              const rel = relativeDay(r.deadline);
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSaveError('');
                    setDraft({ ...r });
                  }}
                  className="rounded-[var(--radius-apple-lg)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-sm)] transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium leading-snug tracking-[-0.01em]">
                        {r.role}
                      </div>
                      <div className="mt-0.5 text-[13px] text-[var(--label-2)]">
                        {r.organization}
                        {r.cycle ? ` · ${r.cycle}` : ''}
                      </div>
                    </div>
                    {r.listing_url && (
                      <span
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(r.listing_url!, '_blank', 'noopener');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            window.open(r.listing_url!, '_blank', 'noopener');
                          }
                        }}
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--label-2)]"
                        aria-label="Open listing"
                      >
                        <ArrowUpRight className="size-4" />
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Pill label={r.status} color={STATUS_COLORS[r.status]} />
                    <Pill
                      label={r.opportunity_type}
                      color={TYPE_COLORS[r.opportunity_type]}
                    />
                    {r.fit !== 'Unknown' && (
                      <Pill label={`${r.fit} fit`} color={FIT_COLORS[r.fit]} />
                    )}
                  </div>

                  {(r.date_applied || r.deadline || r.resume_used) && (
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--label-3)]">
                      {r.date_applied && (
                        <span>Applied {shortDate(r.date_applied)}</span>
                      )}
                      {r.deadline && (
                        <span>
                          Due {shortDate(r.deadline)}
                          {rel ? ` · ${rel}` : ''}
                        </span>
                      )}
                      {r.resume_used && <span>Résumé: {r.resume_used}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Editor */}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        {draft && (
          <DialogContent title={draft.id ? 'Edit' : 'Add opportunity'}>
            {aiEnabled && (
              <div className="mb-4">
                <AiPanel
                  draft={draft}
                  onApplyFields={(patch) => setDraft({ ...draft, ...patch })}
                  onApplyFit={(fit, note) =>
                    setDraft({
                      ...draft,
                      fit,
                      notes: draft.notes ? `${draft.notes}\n\n${note}` : note,
                    })
                  }
                />
              </div>
            )}

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-org">Organization</Label>
                <Input
                  id="f-org"
                  value={draft.organization ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, organization: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-role">Role / program</Label>
                <Input
                  id="f-role"
                  value={draft.role ?? ''}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <Select
                  value={draft.opportunity_type}
                  onValueChange={(v) =>
                    setDraft({ ...draft, opportunity_type: v as OpportunityType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) =>
                    setDraft({ ...draft, category: v as Opportunity['category'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) =>
                    setDraft({ ...draft, status: v as Status })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Fit</Label>
                <Select
                  value={draft.fit}
                  onValueChange={(v) => setDraft({ ...draft, fit: v as Fit })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FITS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-cycle">Cycle</Label>
                <Input
                  id="f-cycle"
                  placeholder="Summer 2027 / Ongoing"
                  value={draft.cycle ?? ''}
                  onChange={(e) => setDraft({ ...draft, cycle: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-resume">Résumé used</Label>
                <Input
                  id="f-resume"
                  placeholder="master, or a filename"
                  value={draft.resume_used ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, resume_used: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-applied">Date applied</Label>
                <DatePicker
                  id="f-applied"
                  value={draft.date_applied}
                  onChange={(v) => setDraft({ ...draft, date_applied: v })}
                  placeholder="Not applied"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-deadline">Deadline</Label>
                <DatePicker
                  id="f-deadline"
                  value={draft.deadline}
                  onChange={(v) => setDraft({ ...draft, deadline: v })}
                  placeholder="No deadline"
                />
              </div>
            </div>

            <div className="mt-3.5 grid gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-url">Listing URL</Label>
                <Input
                  id="f-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={draft.listing_url ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, listing_url: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-source">Source</Label>
                <Input
                  id="f-source"
                  placeholder="email, referral, target list…"
                  value={draft.source ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, source: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-notes">Notes</Label>
                <Textarea
                  id="f-notes"
                  value={draft.notes ?? ''}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>

            {saveError && (
              <p role="alert" className="mt-3 text-[13px] font-medium text-[var(--red)]">
                {saveError}
              </p>
            )}

            <div className="mt-5 flex items-center gap-2">
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              {draft.id && (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={() => remove(draft.id!)}
                  aria-label="Delete"
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
