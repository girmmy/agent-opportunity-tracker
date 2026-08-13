'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

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
    <div className="grid min-h-[100dvh] place-items-center p-6">
      <div
        className={
          'w-full max-w-[360px] rounded-[var(--radius-apple-xl)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lg)] ' +
          (shake ? 'animate-[shake_0.45s_ease-in-out]' : '')
        }
      >
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3.5 grid size-12 place-items-center rounded-[14px] bg-[var(--accent)] shadow-[var(--shadow-md)]">
            <Lock className="size-5 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-[20px] font-semibold tracking-[-0.022em]">
            Opportunity Tracker
          </h1>
          <p className="mt-1 text-[13px] text-[var(--label-2)]">
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
