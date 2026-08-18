'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, LayoutList, LogOut, Settings2, CheckSquare, Users, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/opportunities', label: 'All', icon: LayoutList },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/contacts', label: 'Contacts', icon: Users, compact: true },
  { href: '/decisions', label: 'Decisions', icon: Scale, compact: true },
  // Icon-only on phones so three tabs still fit at 375px.
  { href: '/settings', label: 'Profile', icon: Settings2, compact: true },
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
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-2 sm:gap-3">
        {/*
          Wordmark only. The badged icon that used to sit here was generic
          app-template furniture — it said nothing this text doesn't, and a
          logo that carries no meaning just takes up the bar's best position.
          Now the name itself is the link home, and it can stay visible at
          375px because it no longer competes with a 36px square.
        */}
        <Link
          href="/"
          aria-label="Go to overview"
          className="flex min-h-11 shrink-0 items-center rounded-[12px] text-[17px] font-semibold tracking-[-0.02em] transition-opacity duration-150 hover:opacity-70 active:scale-[0.98] sm:text-[19px]"
        >
          {/* Three widths. "Agent" is the word that distinguishes this from
              any other tracker, so it survives longest as space shrinks. */}
          <span className="sm:hidden">Tracker</span>
          <span className="hidden sm:inline lg:hidden">Agent Tracker</span>
          <span className="hidden lg:inline">Agent Opportunity Tracker</span>
        </Link>

        <nav
          aria-label="Sections"
          className="ml-auto flex rounded-[12px] bg-[var(--surface-sunken)] p-1"
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
                  'flex min-h-11 items-center gap-1.5 rounded-[9px] px-2 sm:px-3 text-[14.5px] font-medium transition-all duration-200 active:scale-[0.97]',
                  active
                    ? 'bg-[var(--surface)] text-[var(--label)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--label-2)] hover:text-[var(--label)]'
                )}
              >
                <Icon
                  className="size-[17px] shrink-0"
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className={tab.compact ? 'hidden sm:inline' : undefined}>
                  {tab.label}
                </span>
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
