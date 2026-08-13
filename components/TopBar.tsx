'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: 'Overview' },
  { href: '/opportunities', label: 'All' },
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
    <header className="glass sticky top-0 z-30 -mx-4 mb-5 border-b border-[var(--separator)] px-4 py-2.5 sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.019em]">
            Opportunity Tracker
          </h1>
        </div>

        {/* iOS segmented control */}
        <nav
          aria-label="Sections"
          className="ml-auto flex rounded-[9px] bg-[var(--surface-sunken)] p-0.5"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-[7px] px-3 py-1 text-[13px] font-medium transition-all duration-200',
                  active
                    ? 'bg-[var(--surface)] text-[var(--label)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--label-2)] hover:text-[var(--label)]'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          aria-label="Sign out"
          className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--label-2)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--label)]"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
