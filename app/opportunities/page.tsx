import { redirect } from 'next/navigation';
import { loadOpportunities } from '@/lib/data';
import { hasSession } from '@/lib/guard';
import { TopBar } from '@/components/TopBar';
import { SetupBanner } from '@/components/SetupBanner';
import { OpportunitiesView } from '@/components/OpportunitiesView';
import { isAiConfigured } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  if (!(await hasSession())) redirect('/login');

  const { opportunities, configured, error } = await loadOpportunities();

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
      <TopBar />
      {(!configured || error) && <SetupBanner error={error} />}
      <OpportunitiesView initial={opportunities} aiEnabled={isAiConfigured()} />
    </div>
  );
}
