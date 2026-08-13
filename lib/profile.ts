import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export interface Profile {
  headline: string | null;
  summary: string | null;
  skills: string | null;
  experience: string | null;
  projects: string | null;
  education: string | null;
  constraints: string | null;
  updated_at?: string;
}

export const EMPTY_PROFILE: Profile = {
  headline: null,
  summary: null,
  skills: null,
  experience: null,
  projects: null,
  education: null,
  constraints: null,
};

export const PROFILE_FIELDS = [
  'headline',
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'constraints',
] as const;

export async function loadProfile(): Promise<Profile> {
  if (!isSupabaseConfigured()) return EMPTY_PROFILE;

  try {
    const { data, error } = await supabaseAdmin()
      .from('profile')
      .select('*')
      .eq('id', true)
      .maybeSingle();

    if (error) throw error;
    return (data as Profile) ?? EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

/** True when there's enough here for a fit judgement to mean anything. */
export function profileIsUsable(p: Profile): boolean {
  return Boolean(
    (p.skills && p.skills.trim().length > 20) ||
      (p.experience && p.experience.trim().length > 20) ||
      (p.projects && p.projects.trim().length > 20)
  );
}

/**
 * Flatten the profile for a prompt.
 *
 * Empty sections are dropped rather than sent as "Skills: (none)" — a blank
 * labelled section invites the model to invent something to fill it.
 */
export function profileToPrompt(p: Profile): string {
  const parts: [string, string | null][] = [
    ['Current situation', p.headline],
    ['Summary', p.summary],
    ['Skills and technologies', p.skills],
    ['Experience', p.experience],
    ['Projects', p.projects],
    ['Education', p.education],
    ['Eligibility constraints', p.constraints],
  ];

  return parts
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `## ${label}\n${v!.trim()}`)
    .join('\n\n');
}
