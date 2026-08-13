import { NextResponse } from 'next/server';
import { agentAuthorized } from '@/lib/agent-auth';
import { loadProfile, profileIsUsable, profileToPrompt } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lets a headless agent read who the user is.
 *
 * This is the seam that keeps a shareable skill free of personal data. Without
 * it, any skill that judges fit or tailors a résumé has to carry the user's
 * background inside itself — which makes the skill unshareable, and makes every
 * fork of it a copy of someone's private profile. Here the skill ships as pure
 * logic and fetches its subject from the user's own deployment at runtime.
 *
 * Read-only on purpose. An agent sweeping an inbox has business updating
 * application rows; it has no business rewriting who the person is. Editing the
 * profile stays behind the browser session, where a human is present.
 */
export async function GET(request: Request) {
  if (!agentAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await loadProfile();

  return NextResponse.json({
    profile,
    /* Pre-flattened for prompting, so every consumer doesn't reimplement it
       and drift in how sections are labelled. */
    prompt: profileToPrompt(profile),
    usable: profileIsUsable(profile),
    hint: profileIsUsable(profile)
      ? undefined
      : 'This profile is too thin to judge fit against. Ask the user to fill it in at /settings — or to upload their résumé there — rather than guessing at their background.',
  });
}
