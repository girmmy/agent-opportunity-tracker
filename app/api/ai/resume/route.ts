import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/guard';
import { describeAiError, isAiConfigured, structured } from '@/lib/ai';
import { loadProfile, profileIsUsable, profileToPrompt } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ResumeSchema = z.object({
  filename: z
    .string()
    .describe(
      'Suggested filename: "<Full Name> - <Organization> - <Role>.pdf". Use the applicant\'s real name only if the profile states it; otherwise start with "Resume". Never invent a name or substitute a description of the person.'
    ),
  order: z
    .array(z.string())
    .describe(
      'Which experiences and projects to list, in the order they should appear, most relevant first. Names only.'
    ),
  bullets: z
    .array(
      z.object({
        item: z.string().describe('Which role or project this bullet belongs to.'),
        text: z.string().describe('The rewritten bullet.'),
        why: z
          .string()
          .describe('The specific requirement in the posting this addresses.'),
      })
    )
    .describe('Rewritten bullets, reordered and reworded for this posting.'),
  skills_line: z
    .string()
    .describe(
      'The skills line, reordered so what the posting asks for comes first. Only technologies already in the profile.'
    ),
  drop: z
    .array(z.string())
    .describe(
      'What to cut or shorten to keep it to one page for this posting. May be empty.'
    ),
  honesty_note: z
    .string()
    .nullable()
    .describe(
      'Set when the posting asks for something the profile genuinely lacks, so the applicant knows the gap is real rather than a wording problem. Null if there is no such gap.'
    ),
});

/**
 * The constraint that matters here is that it must not invent anything.
 *
 * A model asked to "tailor a résumé for this job" will happily produce a
 * beautifully matched document describing work the person never did — and
 * that's the one output that could actually harm them, in an interview or
 * afterwards. So the instruction is reorder and reword only, and say plainly
 * when a gap is real rather than papering over it.
 */
const SYSTEM = `You tailor an existing résumé to a specific posting.

You may ONLY reorder, reword, and re-emphasize what is already in the profile.

Absolutely never:
- Invent a technology, role, employer, project, metric, or date
- Imply experience the profile does not state
- Inflate a number, or add one where the profile has none

CROSS-ATTRIBUTION IS THE MAIN RISK. Do not move a technology from one item to
another. If the profile says a person used React Native at Company A and
Next.js on Project B, then A's bullet may mention React Native and B's may
mention Next.js — and neither may mention the other. Knowing a technology
somewhere is not the same as having used it there.

Before writing each bullet, check the profile text for that specific role or
project and use only the technologies named there. If the posting wants
something that item did not use, do not add it; either use a different item
that genuinely did, or leave the gap and record it in honesty_note.

If the posting requires something the applicant does not have, do not disguise
it. Say so in honesty_note. A résumé that wins an interview by implying skills
the person lacks fails at the interview instead, which is worse.

Good bullets: active verb, what was built, the specific technology, and a real
outcome where the profile supplies one. Mirror the posting's own terminology
where it truthfully describes the same work — if they say "distributed systems"
and the profile says "real-time messaging backend", use their words only if it
is genuinely the same thing.

Keep it to one page's worth of material. Be concrete and compact.`;

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          'AI features are off. Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable them.',
      },
      { status: 501 }
    );
  }

  let posting = '';
  let organization = '';
  let role = '';
  try {
    const body = await request.json();
    posting = typeof body?.posting === 'string' ? body.posting.trim() : '';
    organization =
      typeof body?.organization === 'string' ? body.organization : '';
    role = typeof body?.role === 'string' ? body.role : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (posting.length < 40) {
    return NextResponse.json(
      { error: 'Paste more of the posting — there is not enough here to tailor against.' },
      { status: 400 }
    );
  }

  const profile = await loadProfile();
  if (!profileIsUsable(profile)) {
    return NextResponse.json(
      {
        error:
          'Fill in your profile first (Profile tab) — there is nothing to tailor from.',
      },
      { status: 428 }
    );
  }

  try {
    const result = await structured({
      task: 'fit',
      schema: ResumeSchema,
      schemaName: 'tailored_resume',
      system: SYSTEM,
      user: `# Applicant profile — the ONLY source of truth\n\n${profileToPrompt(
        profile
      )}\n\n# The posting${
        organization || role
          ? `\n\n${[organization, role].filter(Boolean).join(' — ')}`
          : ''
      }\n\n${posting}`,
      maxTokens: 6000,
    });

    return NextResponse.json({
      resume: result.data,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
