import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export interface Profile {
  full_name: string | null;
  headline: string | null;
  summary: string | null;
  skills: string | null;
  experience: string | null;
  projects: string | null;
  education: string | null;
  constraints: string | null;
  /** Metadata about the master résumé file. The bytes themselves are fetched
   *  separately (loadResumeFile) so a normal profile load never drags a PDF
   *  along with it. */
  resume_filename: string | null;
  resume_content_type: string | null;
  resume_text: string | null;
  resume_uploaded_at: string | null;
  updated_at?: string;
}

export const EMPTY_PROFILE: Profile = {
  full_name: null,
  headline: null,
  summary: null,
  skills: null,
  experience: null,
  projects: null,
  education: null,
  constraints: null,
  resume_filename: null,
  resume_content_type: null,
  resume_text: null,
  resume_uploaded_at: null,
};

export const PROFILE_FIELDS = [
  'full_name',
  'headline',
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'constraints',
] as const;

/** Columns for a normal profile load — everything except the résumé's raw bytes. */
const PROFILE_COLUMNS =
  'full_name, headline, summary, skills, experience, projects, education, constraints, ' +
  'resume_filename, resume_content_type, resume_text, resume_uploaded_at, updated_at';

export async function loadProfile(): Promise<Profile> {
  if (!isSupabaseConfigured()) return EMPTY_PROFILE;

  try {
    const { data, error } = await supabaseAdmin()
      .from('profile')
      .select(PROFILE_COLUMNS)
      .eq('id', true)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as Profile) ?? EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

/** The master résumé's raw bytes, fetched only when actually serving the file. */
export async function loadResumeFile(): Promise<{
  bytes: Buffer;
  filename: string;
  contentType: string;
} | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseAdmin()
      .from('profile')
      .select('resume_file, resume_filename, resume_content_type')
      .eq('id', true)
      .maybeSingle();

    if (error) throw error;
    if (!data?.resume_file) return null;

    // The client returns bytea as a hex string ("\x...") over the REST API
    // rather than a Buffer — decode it explicitly.
    const hex = (data.resume_file as string).replace(/^\\x/, '');
    return {
      bytes: Buffer.from(hex, 'hex'),
      filename: data.resume_filename ?? 'resume.pdf',
      contentType: data.resume_content_type ?? 'application/octet-stream',
    };
  } catch {
    return null;
  }
}

/** True when there's enough here for a fit judgement to mean anything. */
export function profileIsUsable(p: Profile): boolean {
  return Boolean(
    (p.skills && p.skills.trim().length > 20) ||
      (p.experience && p.experience.trim().length > 20) ||
      (p.projects && p.projects.trim().length > 20) ||
      // A master résumé with no text fields filled in is still real content —
      // it ends up in the prompt either way (profileToPrompt appends it).
      (p.resume_text && p.resume_text.trim().length > 60)
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
    ['Full name', p.full_name],
    ['Current situation', p.headline],
    ['Summary', p.summary],
    ['Skills and technologies', p.skills],
    ['Experience', p.experience],
    ['Projects', p.projects],
    ['Education', p.education],
    ['Eligibility constraints', p.constraints],
  ];

  const sections = parts
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => `## ${label}\n${v!.trim()}`);

  // Appended last and labelled as verbatim: the fields above are the user's
  // own synthesis and can drift from whatever's in the actual résumé file, so
  // this is deliberately kept separate rather than merged into them.
  if (p.resume_text?.trim()) {
    sections.push(
      `## Master résumé (verbatim text of the file the user actually sends out)\n${p.resume_text.trim()}`
    );
  }

  return sections.join('\n\n');
}
