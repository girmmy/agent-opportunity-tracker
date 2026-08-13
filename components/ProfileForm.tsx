'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { ResumeUpload } from '@/components/ResumeUpload';
import { MasterResume } from '@/components/MasterResume';
import { PROFILE_FIELDS, type Profile } from '@/lib/profile';

const SECTIONS: {
  key: keyof Profile;
  label: string;
  placeholder: string;
  /** Rendered as a single-line input rather than a textarea. */
  single?: boolean;
  rows?: number;
}[] = [
  {
    key: 'full_name',
    label: 'Your name',
    placeholder: 'Your full name',
    single: true,
  },
  {
    key: 'headline',
    label: 'Where you are right now',
    placeholder: 'e.g. Incoming CS freshman at Georgia Tech, based in Atlanta',
  },
  {
    key: 'skills',
    label: 'Skills and technologies',
    placeholder:
      'Languages, frameworks, tools. Be specific and honest — only things you could actually be asked about in an interview.',
    rows: 4,
  },
  {
    key: 'experience',
    label: 'Experience',
    placeholder:
      'Roles you have held and what you actually built. Include numbers where they are real.',
    rows: 5,
  },
  {
    key: 'projects',
    label: 'Projects',
    placeholder: 'Notable projects, their stacks, and any usage or results.',
    rows: 5,
  },
  { key: 'education', label: 'Education', placeholder: 'School, program, awards.', rows: 3 },
  {
    key: 'constraints',
    label: 'Eligibility constraints',
    placeholder:
      'Anything that rules roles in or out — class year, graduation window, work authorization, location, enrollment status.',
    rows: 3,
  },
  {
    key: 'summary',
    label: 'Anything else',
    placeholder: 'What you are actually looking for, or context worth knowing.',
    rows: 3,
  },
];

export function ProfileForm({
  initial,
  aiEnabled,
}: {
  initial: Profile;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile>(initial);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState('');

  const hasContent = PROFILE_FIELDS.some((k) => {
    const v = profile[k];
    return typeof v === 'string' && v.trim() !== '';
  });

  /**
   * "fill" is the default because an import that quietly overwrites text you
   * wrote yourself is the one mistake here you can't undo from the UI.
   */
  function applyImport(
    fields: Partial<Record<keyof Profile, string | null>>,
    mode: 'fill' | 'replace'
  ) {
    setProfile((current) => {
      const next = { ...current };
      for (const key of PROFILE_FIELDS) {
        const incoming = fields[key];
        if (typeof incoming !== 'string' || incoming.trim() === '') continue;
        const existing = current[key];
        const empty = typeof existing !== 'string' || existing.trim() === '';
        if (mode === 'replace' || empty) next[key] = incoming;
      }
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Save failed.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch {
      setError('Network error. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-6">
        <h2 className="serif text-[30px] leading-tight">Your profile</h2>
        <p className="mt-2 max-w-[56ch] text-[14.5px] text-[var(--label-2)]">
          {aiEnabled ? (
            <>
              This is what fit analysis is judged against. The more concrete it
              is, the more useful the verdict — and the more willing it is to
              tell you a role is a weak match.
            </>
          ) : (
            <>
              Used by the AI features. They&rsquo;re currently off — set{' '}
              <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[13px]">
                ANTHROPIC_API_KEY
              </code>{' '}
              to turn them on. Filling this in now does no harm.
            </>
          )}
        </p>
      </div>

      {aiEnabled && (
        <div className="mb-6 flex gap-3 rounded-[var(--radius-apple-lg)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] p-4">
          <Sparkles
            className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
            strokeWidth={2.2}
          />
          <p className="text-[13px] leading-relaxed text-[var(--label-2)]">
            Write it the way you&rsquo;d describe yourself to a person, not as
            keywords. Vague profiles produce vague ratings, and a rating you
            can&rsquo;t act on is worse than none.
          </p>
        </div>
      )}

      <MasterResume
        initial={{
          filename: profile.resume_filename,
          contentType: profile.resume_content_type,
          uploadedAt: profile.resume_uploaded_at,
          text: profile.resume_text,
        }}
      />

      <ResumeUpload hasContent={hasContent} onApply={applyImport} />

      <div className="flex flex-col gap-5">
        {SECTIONS.map((s) => (
          <div key={s.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`p-${s.key}`}>{s.label}</Label>
            {s.single ? (
              <Input
                id={`p-${s.key}`}
                placeholder={s.placeholder}
                value={(profile[s.key] as string | null) ?? ''}
                onChange={(e) =>
                  setProfile({ ...profile, [s.key]: e.target.value })
                }
              />
            ) : (
              <Textarea
                id={`p-${s.key}`}
                rows={s.rows ?? 2}
                placeholder={s.placeholder}
                value={(profile[s.key] as string | null) ?? ''}
                onChange={(e) =>
                  setProfile({ ...profile, [s.key]: e.target.value })
                }
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[13px] font-medium text-[var(--red)]">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center gap-3 border-t border-[var(--separator)] bg-[var(--bg)] px-4 py-3.5">
        <Button variant="primary" size="lg" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Saving
            </>
          ) : saved ? (
            <>
              <Check className="size-4" />
              Saved
            </>
          ) : (
            'Save profile'
          )}
        </Button>
      </div>
    </div>
  );
}
