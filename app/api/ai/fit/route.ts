import { NextResponse } from 'next/server';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { requireSession } from '@/lib/guard';
import {
  CLAUDE_MODEL,
  claude,
  describeClaudeError,
  isClaudeConfigured,
} from '@/lib/claude';
import { loadProfile, profileIsUsable, profileToPrompt } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FitSchema = z.object({
  fit: z.enum(['Strong', 'Good', 'Weak', 'Unknown']),
  headline: z
    .string()
    .describe('One sentence, under 25 words, stating the verdict and why.'),
  matches: z
    .array(z.string())
    .describe('Specific overlaps between the posting and the profile. May be empty.'),
  gaps: z
    .array(z.string())
    .describe('Requirements the profile does not meet. May be empty.'),
  eligibility_concern: z
    .string()
    .nullable()
    .describe(
      'A hard eligibility barrier such as class year, graduation window, clearance, or work authorization. Null if none is stated.'
    ),
  lead_with: z
    .array(z.string())
    .describe('Which of their specific projects or roles to foreground. May be empty.'),
});

/**
 * The prompt is the product here.
 *
 * A fit rater that flatters is worse than none: it costs real applications
 * aimed at roles that were never going to land. So the instructions push
 * against the model's default helpfulness — Weak is a valid and useful answer,
 * Unknown is correct when the input is thin, and inference from company
 * prestige is explicitly ruled out.
 */
const SYSTEM = `You assess how well a candidate matches a specific job posting.

You are talking to the candidate about their own job search. They need an
accurate read, not an encouraging one. An inflated rating costs them a real
application slot and their time.

Rules:
- Judge ONLY against the profile you are given. Never assume unstated skills.
- "Weak" is a legitimate and useful verdict. Use it when the posting's core
  requirements are not in the profile.
- "Unknown" is correct when the text provided is too thin to judge — a bare
  title with no requirements, for example. Do not guess to seem useful.
- Never infer fit from the company's reputation, size, or how desirable the role
  sounds. A famous company with a mismatched stack is a Weak fit.
- Name specific technologies and requirements. "Good culture fit" is noise;
  "requires PyTorch, which is not in the profile" is signal.
- Flag hard eligibility barriers (graduation year, clearance, work
  authorization, enrollment status) separately from skill fit. A perfect skill
  match that the candidate is ineligible for is still not worth applying to.
- Be concise. Short, concrete phrases, not paragraphs.`;

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      { error: 'AI features are off. Set ANTHROPIC_API_KEY to enable them.' },
      { status: 501 }
    );
  }

  let posting = '';
  let role = '';
  let organization = '';
  try {
    const body = await request.json();
    posting = typeof body?.posting === 'string' ? body.posting.trim() : '';
    role = typeof body?.role === 'string' ? body.role : '';
    organization =
      typeof body?.organization === 'string' ? body.organization : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (posting.length < 40) {
    return NextResponse.json(
      { error: 'Paste more of the posting — there is not enough here to judge.' },
      { status: 400 }
    );
  }

  const profile = await loadProfile();
  if (!profileIsUsable(profile)) {
    return NextResponse.json(
      {
        error:
          'Fill in your profile first (Settings) — a fit rating against an empty profile is meaningless.',
      },
      { status: 428 }
    );
  }

  try {
    const response = await claude().messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `# Candidate profile\n\n${profileToPrompt(profile)}\n\n# The posting\n\n${
            organization || role
              ? `Known so far: ${[organization, role].filter(Boolean).join(' — ')}\n\n`
              : ''
          }${posting}`,
        },
      ],
      output_config: { format: zodOutputFormat(FitSchema) },
    });

    return NextResponse.json({
      analysis: response.parsed_output,
      model: CLAUDE_MODEL,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
      },
    });
  } catch (err) {
    const { message, status } = describeClaudeError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
