import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/guard';
import { describeAiError, isAiConfigured, structured } from '@/lib/ai';
import { CATEGORIES, OPPORTUNITY_TYPES } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Every field is nullable on purpose.
 *
 * This fills a form the user is about to review, so a wrong guess is worse than
 * a blank: they'd have to notice and correct it, which is more work than typing
 * it. Null means "not stated in the text" and the field simply stays empty.
 */
const ExtractSchema = z.object({
  organization: z.string().nullable(),
  role: z.string().nullable(),
  opportunity_type: z.enum(OPPORTUNITY_TYPES).nullable(),
  category: z.enum(CATEGORIES).nullable(),
  cycle: z
    .string()
    .nullable()
    .describe('Term the posting is for, e.g. "Summer 2027" or "Ongoing".'),
  deadline: z
    .string()
    .nullable()
    .describe('Application deadline as YYYY-MM-DD. Null unless an explicit date is stated.'),
  listing_url: z.string().nullable(),
  location: z.string().nullable(),
  notes: z
    .string()
    .nullable()
    .describe(
      'One or two sentences of genuinely useful detail — eligibility requirements, required stack, compensation. Null if nothing is worth noting.'
    ),
});

const SYSTEM = `You extract structured fields from a job or program posting so a
tracker form can be pre-filled.

The user reviews everything before saving, so a blank field costs them nothing
and a wrong one costs them attention. Therefore:

- Return null for anything not clearly stated in the text. Never infer.
- Never invent a deadline. Only return one if an explicit date appears. If the
  text says something relative like "applications close in two weeks", return
  null — you do not know today's date.
- Never invent a URL. Only return one that literally appears in the text.
- opportunity_type: Internship, Contract (paid gig or freelance), Program
  (fellowship, cohort, ambassador scheme), Research, Hackathon, Scholarship,
  or Full-time.
- category: the domain of the work — SWE, AI/ML, Product, Data, Research,
  Other, or Unclear when the posting does not make it obvious.
- Keep role as the actual posted title, including any requisition number if one
  is part of it. Do not tidy it up.`;

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
  try {
    const body = await request.json();
    posting = typeof body?.posting === 'string' ? body.posting.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (posting.length < 25) {
    return NextResponse.json(
      { error: 'Paste the posting text first.' },
      { status: 400 }
    );
  }

  try {
    const result = await structured({
      task: 'extract',
      schema: ExtractSchema,
      schemaName: 'posting_fields',
      system: SYSTEM,
      user: posting,
      maxTokens: 2048,
    });

    return NextResponse.json({
      fields: result.data,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
