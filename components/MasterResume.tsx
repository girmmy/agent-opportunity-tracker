'use client';

import * as React from 'react';
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ACCEPTED } from '@/lib/resume-text';

interface ResumeState {
  filename: string | null;
  contentType: string | null;
  uploadedAt: string | null;
  text: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The canonical master résumé — one file, previewable, and the exact thing
 * every agent reading the profile gets verbatim (see profileToPrompt).
 *
 * Deliberately separate from the "start from your résumé" uploader above:
 * that one is a quick-fill convenience for the free-text profile fields and
 * nothing is saved until the form itself is submitted. This one persists
 * immediately on upload, because it's the single artifact other tooling
 * depends on — which is exactly why replacing it asks first.
 */
export function MasterResume({ initial }: { initial: ResumeState }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showPreview, setShowPreview] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const hasResume = Boolean(state.filename);
  const isPdf = state.contentType === 'application/pdf';

  function pickFile() {
    inputRef.current?.click();
  }

  function onFileSelected(file: File) {
    if (hasResume) {
      // Something is already relied on by agents and other application
      // materials — don't swap it out from under the user on a stray click.
      setPendingFile(file);
      setConfirmOpen(true);
    } else {
      void upload(file);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/profile/resume', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Upload failed.');
        return;
      }
      setState({
        filename: data.filename,
        contentType: data.contentType,
        uploadedAt: new Date().toISOString(),
        // The route doesn't echo the extracted text back — refetch would be
        // wasteful for a value only used in the preview fallback, so just
        // mark it present; the iframe/preview reloads from the server either way.
        text: state.text,
      });
      setShowPreview(false);
    } catch {
      setError('Network error — nothing was uploaded.');
    } finally {
      setBusy(false);
      setPendingFile(null);
      setConfirmOpen(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/resume', { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not remove it.');
        return;
      }
      setState({ filename: null, contentType: null, uploadedAt: null, text: null });
      setShowPreview(false);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-1.5">
        <FileText className="size-3.5 text-[var(--accent)]" strokeWidth={2.3} />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--label-3)]">
          Master résumé
        </span>
      </div>
      <p className="mb-3 max-w-[62ch] text-[13px] leading-snug text-[var(--label-2)]">
        The exact file you send out. Kept separately from the fields below —
        those are your own summary and can drift over time, while this is
        what every agent reading your profile sees verbatim.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
          e.target.value = '';
        }}
      />

      {!hasResume ? (
        <button
          onClick={pickFile}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-[var(--radius-apple-lg)] border border-dashed border-[var(--separator)] bg-[var(--surface-sunken)] p-4 text-left transition-colors hover:border-[var(--accent)]"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]">
            {busy ? (
              <LoaderCircle className="size-4 animate-spin text-[var(--accent)]" />
            ) : (
              <Upload className="size-4 text-[var(--label-2)]" strokeWidth={2.1} />
            )}
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold">
              {busy ? 'Uploading…' : 'Upload your master résumé'}
            </span>
            <span className="block text-[12px] text-[var(--label-3)]">
              PDF, DOCX, or text
            </span>
          </span>
        </button>
      ) : (
        <div className="rounded-[var(--radius-apple-lg)] bg-[var(--surface-sunken)] p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]">
                <FileText className="size-4 text-[var(--label-2)]" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold">
                  {state.filename}
                </div>
                <div className="text-[12px] text-[var(--label-3)]">
                  Uploaded {formatDate(state.uploadedAt)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? 'Hide preview' : 'Preview'}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <a
                href="/api/profile/resume"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3.5" />
                Open
              </a>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={pickFile}
            >
              <Upload className="size-3.5" />
              Replace
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>

          {showPreview && (
            <div className="mt-3 overflow-hidden rounded-[var(--radius-apple)] border border-[var(--separator)] bg-[var(--surface)]">
              {isPdf ? (
                <iframe
                  src="/api/profile/resume"
                  title="Master résumé preview"
                  className="h-[480px] w-full"
                />
              ) : (
                <div className="max-h-[420px] overflow-y-auto p-4">
                  <p className="mb-2 text-[11.5px] font-medium text-[var(--label-3)]">
                    Extracted text — this file type doesn&rsquo;t preview inline.
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--label-2)]">
                    {state.text || 'No extracted text available.'}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--label-3)]">
            <Sparkles className="size-3 text-[var(--accent)]" />
            Included verbatim when any agent reads your profile
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-snug text-[var(--red)]"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmOpen(false);
            setPendingFile(null);
          }
        }}
      >
        <DialogContent title="Replace master résumé?">
          <DialogTitle className="sr-only">Replace master résumé?</DialogTitle>
          <p className="text-[14px] leading-relaxed text-[var(--label-2)]">
            This replaces{' '}
            <span className="font-semibold text-[var(--label)]">
              {state.filename}
            </span>{' '}
            with{' '}
            <span className="font-semibold text-[var(--label)]">
              {pendingFile?.name}
            </span>
            . Every agent that reads your profile — fit ratings, tailoring,
            the daily digest — will see the new one from now on.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => pendingFile && upload(pendingFile)}
            >
              {busy ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Replace résumé
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
