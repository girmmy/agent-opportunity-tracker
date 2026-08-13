'use client';

import * as React from 'react';
import {
  Check,
  Copy,
  FileText,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea, Label } from '@/components/ui/input';
import { Pill } from '@/components/Pill';
import { FIT_COLORS, type Fit, type Opportunity } from '@/lib/types';

interface FitAnalysis {
  fit: Fit;
  headline: string;
  matches: string[];
  gaps: string[];
  eligibility_concern: string | null;
  lead_with: string[];
}

interface TailoredResume {
  filename: string;
  order: string[];
  bullets: { item: string; text: string; why: string }[];
  skills_line: string;
  drop: string[];
  honesty_note: string | null;
}

interface ExtractedFields {
  organization: string | null;
  role: string | null;
  opportunity_type: string | null;
  category: string | null;
  cycle: string | null;
  deadline: string | null;
  listing_url: string | null;
  location: string | null;
  notes: string | null;
}

/**
 * Paste-a-posting panel inside the editor.
 *
 * Two actions on the same pasted text: fill the form's blanks, and judge the
 * fit. Both are suggestions — nothing is written to the database until the user
 * hits Save, so a bad extraction costs a glance rather than a bad row.
 */
export function AiPanel({
  draft,
  onApplyFields,
  onApplyFit,
  onApplyResume,
}: {
  draft: Partial<Opportunity>;
  onApplyFields: (fields: Partial<Opportunity>) => void;
  onApplyFit: (fit: Fit, note: string) => void;
  onApplyResume: (filename: string) => void;
}) {
  const [posting, setPosting] = React.useState('');
  const [busy, setBusy] = React.useState<'extract' | 'fit' | 'resume' | null>(
    null
  );
  const [error, setError] = React.useState('');
  const [analysis, setAnalysis] = React.useState<FitAnalysis | null>(null);
  const [resume, setResume] = React.useState<TailoredResume | null>(null);
  const [extracted, setExtracted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function run(kind: 'extract' | 'fit' | 'resume') {
    setBusy(kind);
    setError('');
    try {
      const res = await fetch(`/api/ai/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posting,
          role: draft.role ?? '',
          organization: draft.organization ?? '',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Request failed.');
        return;
      }

      if (kind === 'extract') {
        const f = data.fields as ExtractedFields;
        const patch: Partial<Opportunity> = {};
        // Only fill blanks — never clobber something already typed.
        const assign = <K extends keyof Opportunity>(
          key: K,
          value: unknown
        ) => {
          const current = draft[key];
          if (value && (current === undefined || current === null || current === '')) {
            patch[key] = value as Opportunity[K];
          }
        };
        assign('organization', f.organization);
        assign('role', f.role);
        assign('opportunity_type', f.opportunity_type);
        assign('category', f.category);
        assign('cycle', f.cycle);
        assign('deadline', f.deadline);
        assign('listing_url', f.listing_url);
        if (f.notes && !draft.notes) patch.notes = f.notes;

        onApplyFields(patch);
        setExtracted(true);
        setTimeout(() => setExtracted(false), 2500);
      } else if (kind === 'fit') {
        setAnalysis(data.analysis as FitAnalysis);
      } else {
        setResume(data.resume as TailoredResume);
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(null);
    }
  }

  function applyFit() {
    if (!analysis) return;
    const lines = [
      analysis.headline,
      analysis.gaps.length ? `Gaps: ${analysis.gaps.join('; ')}` : '',
      analysis.eligibility_concern
        ? `Eligibility: ${analysis.eligibility_concern}`
        : '',
      analysis.lead_with.length
        ? `Lead with: ${analysis.lead_with.join('; ')}`
        : '',
    ].filter(Boolean);
    onApplyFit(analysis.fit, lines.join(' · '));
  }

  return (
    <div className="rounded-[var(--radius-apple-lg)] bg-[var(--surface-sunken)] p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-[var(--accent)]" strokeWidth={2.3} />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-3)]">
          Paste the posting
        </span>
      </div>

      <Textarea
        rows={3}
        placeholder="Paste the job description here, then fill the blanks or rate the fit."
        value={posting}
        onChange={(e) => setPosting(e.target.value)}
        className="bg-[var(--surface)]"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => run('extract')}
          disabled={busy !== null || posting.trim().length < 25}
        >
          {busy === 'extract' ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <Wand2 className="size-3.5" />
          )}
          {extracted ? 'Filled' : 'Fill the blanks'}
        </Button>

        <Button
          variant="tinted"
          size="sm"
          onClick={() => run('fit')}
          disabled={busy !== null || posting.trim().length < 40}
        >
          {busy === 'fit' ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Rate the fit
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => run('resume')}
          disabled={busy !== null || posting.trim().length < 40}
        >
          {busy === 'resume' ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <FileText className="size-3.5" />
          )}
          Tailor résumé
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-1.5 text-[12.5px] text-[var(--red)]"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {analysis && (
        <div className="mt-3 rounded-[var(--radius-apple)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Pill label={analysis.fit} color={FIT_COLORS[analysis.fit]} />
            <span className="text-[13px] font-medium">{analysis.headline}</span>
          </div>

          {analysis.eligibility_concern && (
            <p className="mb-2 rounded-md bg-[color-mix(in_srgb,var(--orange)_12%,transparent)] px-2 py-1.5 text-[12.5px] text-[var(--orange)]">
              {analysis.eligibility_concern}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.matches.length > 0 && (
              <List title="Matches" items={analysis.matches} color="var(--green)" />
            )}
            {analysis.gaps.length > 0 && (
              <List title="Gaps" items={analysis.gaps} color="var(--orange)" />
            )}
          </div>

          {analysis.lead_with.length > 0 && (
            <div className="mt-2">
              <List title="Lead with" items={analysis.lead_with} color="var(--accent)" />
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={applyFit}>
              Use this rating
            </Button>
            {/* Labelled so it's always clear which text a machine wrote. */}
            <span className="text-[11px] text-[var(--label-3)]">
              AI-generated · review before saving
            </span>
          </div>
        </div>
      )}

      {resume && (
        <div className="mt-3 rounded-[var(--radius-apple)] bg-[var(--surface)] p-3">
          {/* Surfaced first and in warning colour: a real gap is the one thing
              you must not let a tailored résumé paper over. */}
          {resume.honesty_note && (
            <p className="mb-2.5 rounded-md bg-[color-mix(in_srgb,var(--orange)_12%,transparent)] px-2 py-1.5 text-[12.5px] leading-snug text-[var(--orange)]">
              {resume.honesty_note}
            </p>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--label-3)]">
              Save as
            </span>
            <code className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[12px]">
              {resume.filename}
            </code>
          </div>

          {resume.order.length > 0 && (
            <p className="mb-2.5 text-[12.5px] text-[var(--label-2)]">
              <span className="font-semibold">Order:</span>{' '}
              {resume.order.join(' → ')}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {resume.bullets.map((b, i) => (
              <div key={i} className="rounded-md bg-[var(--surface-sunken)] p-2">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--label-3)]">
                  {b.item}
                </div>
                <p className="mt-1 text-[12.5px] leading-snug">{b.text}</p>
                <p className="mt-1 text-[11.5px] italic text-[var(--label-3)]">
                  {b.why}
                </p>
              </div>
            ))}
          </div>

          {resume.skills_line && (
            <div className="mt-2.5">
              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--label-3)]">
                Skills line
              </div>
              <p className="text-[12.5px] leading-snug text-[var(--label-2)]">
                {resume.skills_line}
              </p>
            </div>
          )}

          {resume.drop.length > 0 && (
            <div className="mt-2.5">
              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--orange)]">
                Cut to fit one page
              </div>
              <ul className="flex flex-col gap-0.5">
                {resume.drop.map((d, i) => (
                  <li key={i} className="text-[12.5px] text-[var(--label-2)]">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const text = [
                  `# ${resume.filename}`,
                  '',
                  `Order: ${resume.order.join(' → ')}`,
                  '',
                  ...resume.bullets.map((b) => `[${b.item}] ${b.text}`),
                  '',
                  `Skills: ${resume.skills_line}`,
                  resume.drop.length ? `\nCut: ${resume.drop.join('; ')}` : '',
                  resume.honesty_note ? `\nGap: ${resume.honesty_note}` : '',
                ].join('\n');
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setError('Clipboard unavailable — select the text manually.');
                }
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => onApplyResume(resume.filename)}
            >
              Record as résumé used
            </Button>

            <span className="text-[11px] text-[var(--label-3)]">
              AI-generated · reorders your profile, never invents
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function List({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <div>
      <div
        className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {title}
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((t, i) => (
          <li key={i} className="text-[12.5px] leading-snug text-[var(--label-2)]">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
