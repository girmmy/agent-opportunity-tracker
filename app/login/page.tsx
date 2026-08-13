'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { GitHubMark } from '@/components/icons';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setPassword('');
        router.replace(next);
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not sign in.');
      // The iOS passcode shake — communicates failure without reading text.
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-[100dvh] place-items-center p-6">
      <div
        className={
          'w-full max-w-[360px] rounded-[var(--radius-apple-xl)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lg)] ' +
          (shake ? 'animate-[shake_0.45s_ease-in-out]' : '')
        }
      >
        {/* No icon. A tinted rounded square with a padlock in it is the house
            style of every generated login screen — and it says nothing the
            password field doesn't already say. Type carries it instead. */}
        <div className="mb-6 text-center">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.023em]">
            Opportunity Tracker
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--label-2)]">
            Enter your password to continue
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="sr-only">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              placeholder="Password"
              className="h-11 text-center"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy || !password}
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Checking
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          {error && (
            <p
              role="alert"
              className="text-center text-[13px] font-medium text-[var(--red)]"
            >
              {error}
            </p>
          )}
        </form>
      </div>

      {/*
        The login screen is the only surface anyone sees without the password,
        so it's the one place attribution and a source link actually reach
        people. Both sit clear of the home indicator on notched iPhones.

        Forking this? Change or delete these two blocks — they're the only
        hardcoded attribution in the project.
      */}
      <footer
        className="absolute inset-x-0 flex justify-center"
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <p className="text-[13px] text-[var(--label-3)]">
          made by{' '}
          <a
            href="https://gimmy-samson.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-[var(--label-2)] underline decoration-[var(--separator-opaque)] underline-offset-[3px] transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
          >
            gimmy
            <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
          </a>
        </p>
      </footer>

      {/* Source link, for the people who'd want it. Corner-anchored so it never
          competes with the sign-in card or the credit line. */}
      <a
        href="https://github.com/girmmy/agent-opportunity-tracker"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View the source on GitHub"
        title="View the source on GitHub"
        className="absolute grid size-11 place-items-center rounded-full text-[var(--label-3)] transition-all duration-150 hover:bg-[var(--surface)] hover:text-[var(--label)] active:scale-[0.94]"
        style={{
          bottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        <GitHubMark className="size-[19px]" />
      </a>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-7px); }
          40%, 60% { transform: translateX(7px); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <LoginForm />
    </Suspense>
  );
}
