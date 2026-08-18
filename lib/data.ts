import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import type { Opportunity } from '@/lib/types';
import type { Task, Contact, Activity } from '@/lib/workspace';

export interface LoadResult {
  opportunities: Opportunity[];
  configured: boolean;
  error: string | null;
}

export async function loadWorkspace() {
  if (!isSupabaseConfigured()) return { tasks: [] as Task[], contacts: [] as Contact[], activity: [] as Activity[] };
  const db = supabaseAdmin();
  const [tasks, contacts, activity] = await Promise.all([
    db.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
    db.from('contacts').select('*').order('name'),
    db.from('activity').select('*').order('occurred_at', { ascending: false, nullsFirst: false }),
  ]);
  return { tasks: (tasks.data ?? []) as Task[], contacts: (contacts.data ?? []) as Contact[], activity: (activity.data ?? []) as Activity[] };
}

/**
 * Server-side load used by page components. Returns a shaped result rather than
 * throwing, so a missing/misconfigured database renders a setup hint instead of
 * a crash screen — the app is useful to look at before Supabase is wired up.
 */
export async function loadOpportunities(): Promise<LoadResult> {
  if (!isSupabaseConfigured()) {
    return { opportunities: [], configured: false, error: null };
  }

  try {
    const { data, error } = await supabaseAdmin()
      .from('opportunities')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return {
      opportunities: (data ?? []) as Opportunity[],
      configured: true,
      error: null,
    };
  } catch (err) {
    return {
      opportunities: [],
      configured: true,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
