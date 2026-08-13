import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/guard';
import { describeAiError, isAiConfigured, structured } from '@/lib/ai';
import {
  extractResumeText,
  looksUnreadable,
  ResumeTextError,
} from '@/lib/resume-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ImportSchema = z.object({
  full_name: z.string().nullable().describe('The applicant name, exactly as written.'),
  headline: z
    .string()
    .nullable()
    .describe(
      'One line on where they are right now — school and year, or current role. Only if the résumé says.'
    ),
  skills: z
    .string()
    .nullable()
    .describe(
      'Languages, frameworks, and tools, grouped the way the résumé groups them. Verbatim technologies — never add a related one.'
    ),
  experience: z
    .string()
    .nullable()
    .describe(
      'Each role as: Title, Organization (dates) — then what they did, keeping every number exactly as written. Most recent first.'
    ),
  projects: z
    .string()
    .nullable()
    .describe('Each project, its stack, and any usage or results stated.'),
  education: z
    .string()
    .nullable()
    .describe('School, degree, graduation date, GPA and awards if present.'),
  constraints: z
    .string()
    .nullable()
    .describe(
      'Anything bearing on eligibility that the résumé states outright — graduation year, work authorization, location. Null if it does not say. Never infer this.'
    ),
});

/**
 * Résumés are dense and abbreviated; the profile wants prose a model can reason
 * against. That rewrite is the whole job, and it's also where a model will
 * cheerfully round 22% up to 25%, turn "React" into "React and Redux", or
 * decide a Georgia Tech student must be a US citizen.
 *
 * Eligibility is called out specifically because a wrong guess there is the one
 * that follows someone onto a legal form.
 */
const SYSTEM = `You convert a résumé into a structured profile.

Copy what the résumé says. Expand abbreviations into readable prose, but every
fact must be traceable to the text you were given.

Never:
- Add a technology, employer, title, date, or metric that is not in the text
- Change a number, even slightly
- Infer seniority, citizenship, work authorization, or visa status
- Fill a section from general knowledge because it looks empty

Use null for anything the résumé does not cover. A null section is correct and
useful; an invented one silently corrupts every fit rating built on top of it.

Keep the applicant's own phrasing for their accomplishments. Write in plain
sentences, not résumé shorthand — this text is read by a model later, not
printed.`;

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          'Résumé import needs an AI key. Set ANTHROPIC_API_KEY or OPENAI_API_KEY, or fill the profile in by hand.',
      },
      { status: 501 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json(
      { error: 'Upload failed before it reached the server. Try a smaller file.' },
      { status: 400 }
    );
  }

  if (!file) {
    return NextResponse.json({ error: 'No file was attached.' }, { status: 400 });
  }

  let text: string;
  let pages: number | null;
  try {
    ({ text, pages } = await extractResumeText(file));
  } catch (err) {
    if (err instanceof ResumeTextError) {
      return NextResponse.json({ error: err.message }, { status: 415 });
    }
    return NextResponse.json(
      {
        error:
          'Could not read that file. If it opens fine elsewhere, re-export it as a PDF and try again.',
      },
      { status: 422 }
    );
  }

  if (looksUnreadable(text)) {
    // A PDF with no text is almost always a scan; any other format that comes
    // back empty is just an empty file, and saying "scan" there sends someone
    // off re-exporting a document that was never the problem.
    return NextResponse.json(
      {
        error: file.name.toLowerCase().endsWith('.pdf')
          ? 'That PDF has almost no selectable text — it is probably a scan or an image. Upload a PDF exported from the original document rather than photographed or scanned.'
          : 'There is barely any text in that file. Check you picked the right one.',
      },
      { status: 422 }
    );
  }

  try {
    const result = await structured({
      task: 'extract',
      schema: ImportSchema,
      schemaName: 'profile_from_resume',
      system: SYSTEM,
      user: `# Résumé\n\n${text}`,
      maxTokens: 4000,
    });

    return NextResponse.json({
      fields: result.data,
      source: { filename: file.name, pages, characters: text.length },
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    const { message, status } = describeAiError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
