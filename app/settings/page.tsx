import { redirect } from 'next/navigation';
import { hasSession } from '@/lib/guard';
import { loadProfile } from '@/lib/profile';
import { isClaudeConfigured } from '@/lib/claude';
import { TopBar } from '@/components/TopBar';
import { ProfileForm } from '@/components/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!(await hasSession())) redirect('/login');

  const profile = await loadProfile();

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 sm:px-6">
      <TopBar />
      <ProfileForm initial={profile} aiEnabled={isClaudeConfigured()} />
    </div>
  );
}
