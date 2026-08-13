'use client';

import * as React from 'react';
import {
  FileUp,
  LoaderCircle,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCEPTED } from '@/lib/resume-text';
import { type Profile } from '@/lib/profile';

/**
 * The sections a résumé can actually supply.
 *
 * `summary` is deliberately absent: it holds what you're looking for and what's
 * worth knowing about you, which no résumé states. Counting it as "not found"
 * would report a missing section as a flaw in the document.
 */
const IMPORTABLE = [
  'full_name',
  'headline',
  'skills',
  'experience',
  'projects',
  'education',
  'constraints',
] as const satisfies readonly (keyof Profile)[];

const LABELS: Record<string, string> = {
  full_name: 'Name',
  headline: 'Current situation',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  constraints: 'Eligibility',
};

type Extracted = Partial<Record<keyof Profile, string | null>>;

/**
 * Upload a résumé to fill the profile.
 *
 * Nothing is written on upload. The extraction lands in the form as a draft the
 * user can read and edit before saving, because a parsed résumé is a guess about
 * a document, and this profile is what every fit rating is later judged against.
 */
export function ResumeUpload({
  hasContent,
  onApply,
}: {
  /** Whether the profile already holds anything — decides if replacing is offered. */
  hasContent: boolean;
  onApply: (fields: Extracted, mode: 'fill' | 'replace') => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState<{
    fields: Extracted;
    filename: string;
    pages: number | null;
  } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/profile/import', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Import failed.');
        return;
      }
      setResult({
        fields: data.fields as Extracted,
        filename: data.source?.filename ?? file.name,
        pages: data.source?.pages ?? null,
      });
    } catch {
      setError('Network error — nothing was uploaded.');
    } finally {
      setBusy(false);
    }
  }

  const found = result
    ? IMPORTABLE.filter((k) => {
        const v = result.fields[k];
        return typeof v === 'string' && v.trim() !== '';
      })
    : [];
  const missing = result
    ? IMPORTABLE.filter((k) => !found.includes(k as (typeof found)[number]))
    : [];

  return (
    <div className="mb-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={[
          'rounded-[var(--radius-apple-lg)] border border-dashed p-5 text-center transition-colors duration-200',
          dragging
            ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]'
            : 'border-[var(--separator)] bg-[var(--surface-sunken)]',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            // Reset so re-picking the same file fires change again.
            e.target.value = '';
          }}
        />

        <div className="mx-auto mb-2.5 grid size-10 place-items-center rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          {busy ? (
            <LoaderCircle className="size-[18px] animate-spin text-[var(--accent)]" />
          ) : (
            <FileUp className="size-[18px] text-[var(--label-2)]" strokeWidth={2.1} />
          )}
        </div>

        <p className="text-[14.5px] font-semibold tracking-[-0.01em]">
          {busy ? 'Reading your résumé' : 'Start from your résumé'}
        </p>
        <p className="mx-auto mt-1 max-w-[42ch] text-[13px] leading-snug text-[var(--label-2)]">
          {busy
            ? 'Extracting the text, then structuring it.'
            : 'Upload it and the sections below fill themselves in. PDF, DOCX, or text.'}
        </p>

        {!busy && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            Choose a file
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-snug text-[var(--red)]"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-[var(--radius-apple)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold">
                {result.filename}
              </div>
              <div className="text-[12px] text-[var(--label-3)]">
                {found.length} of {IMPORTABLE.length} sections found
                {result.pages ? ` · ${result.pages} page${result.pages > 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <button
              onClick={() => setResult(null)}
              aria-label="Discard this import"
              className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--label-3)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--label)]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {found.map((k) => (
              <span
                key={k}
                className="rounded-full bg-[color-mix(in_srgb,var(--green)_13%,transparent)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--green)]"
              >
                {LABELS[k] ?? k}
              </span>
            ))}
            {missing.map((k) => (
              <span
                key={k}
                className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11.5px] text-[var(--label-3)]"
              >
                {LABELS[k] ?? k} — not found
              </span>
            ))}
          </div>

          {missing.length > 0 && (
            <p className="mt-2 text-[12px] leading-snug text-[var(--label-2)]">
              Nothing was invented for the sections it couldn&rsquo;t find. Write
              those in yourself — eligibility especially, since a résumé rarely
              states it.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onApply(result.fields, 'fill');
                setResult(null);
              }}
            >
              {hasContent ? 'Fill what’s empty' : 'Use this'}
            </Button>

            {hasContent && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onApply(result.fields, 'replace');
                  setResult(null);
                }}
              >
                Replace everything
              </Button>
            )}

            <span className="text-[11px] text-[var(--label-3)]">
              Goes into the form — nothing saves until you do
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
