import { TriangleAlert } from 'lucide-react';

export function SetupBanner({ error }: { error?: string | null }) {
  return (
    <div className="mb-5 flex gap-3 rounded-[var(--radius-apple)] bg-[color-mix(in_srgb,var(--orange)_10%,transparent)] p-4">
      <TriangleAlert
        className="mt-0.5 size-4 shrink-0 text-[var(--orange)]"
        strokeWidth={2.5}
      />
      <div className="text-[13px] leading-relaxed">
        {error ? (
          <>
            <strong className="font-semibold">
              Couldn&rsquo;t reach the database.
            </strong>{' '}
            {error}
            <br />
            Check <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[12px]">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[12px]">
              SUPABASE_SECRET_KEY
            </code>
            , and that the migrations have run.
          </>
        ) : (
          <>
            <strong className="font-semibold">Supabase isn&rsquo;t connected.</strong>{' '}
            The app works — it just has nowhere to read from. See{' '}
            <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[12px]">
              README.md
            </code>
            .
          </>
        )}
      </div>
    </div>
  );
}
