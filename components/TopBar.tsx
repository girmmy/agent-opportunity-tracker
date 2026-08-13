'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, LayoutList, LogOut, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/opportunities', label: 'All', icon: LayoutList },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="glass sticky top-0 z-30 -mx-4 mb-6 border-b border-[var(--separator)] px-4 sm:-mx-6 sm:px-6">
      <div className="mx-auto flex h-[58px] max-w-[1400px] items-center gap-2 sm:gap-3">
        {/*
          The mark is a link home. A clickable logo is the affordance people
          reach for first, and it costs nothing to honor even though the
          Overview tab goes to the same place. The wordmark drops on phones so
          the nav and sign-out never get squeezed at 375px.
        */}
        {/* min-h-11 gives a 44pt touch target per Apple's HIG. The visible mark
            stays 36px — the extra height is invisible padding, not bulk. */}
        <Link
          href="/"
          aria-label="Go to overview"
          className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-[12px] transition-transform active:scale-[0.97]"
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--accent)] shadow-[var(--shadow-sm)]">
            <Target className="size-[18px] text-white" strokeWidth={2.4} />
          </span>
          {/* Sans, not the display face. A serif wordmark next to icon chrome
              reads as a mismatch — the serif belongs to editorial moments, not
              to persistent UI furniture. */}
          <span className="hidden text-[16px] font-semibold tracking-[-0.017em] sm:inline">
            Opportunity Tracker
          </span>
        </Link>

        <nav
          aria-label="Sections"
          className="ml-auto flex rounded-[11px] bg-[var(--surface-sunken)] p-1"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-1.5 rounded-[8px] px-3.5 text-[14px] font-medium transition-all duration-200 active:scale-[0.97]',
                  active
                    ? 'bg-[var(--surface)] text-[var(--label)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--label-2)] hover:text-[var(--label)]'
                )}
              >
                <Icon
                  className="size-4 shrink-0"
                  strokeWidth={active ? 2.4 : 2}
                />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--label-2)] transition-all duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--label)] active:scale-[0.94]"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}
