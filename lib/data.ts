import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import type { Opportunity } from '@/lib/types';

export interface LoadResult {
  opportunities: Opportunity[];
  configured: boolean;
  error: string | null;
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
