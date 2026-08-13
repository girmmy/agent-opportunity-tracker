import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireSession } from '@/lib/guard';
import { loadResumeFile } from '@/lib/profile';
import {
  extractResumeText,
  looksUnreadable,
  ResumeTextError,
} from '@/lib/resume-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The canonical master résumé — a distinct thing from the profile's free-text
 * fields. Those are the user's own synthesis and can drift; this is the exact
 * file the user actually sends out, kept so it can be previewed and so any
 * agent reading the profile gets its literal wording.
 */

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  const file = await loadResumeFile();
  if (!file) {
    return NextResponse.json({ error: 'No master résumé uploaded yet.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.contentType,
      // inline, not attachment — this is served into the settings page's
      // preview iframe, not downloaded.
      'Content-Disposition': `inline; filename="${file.filename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

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
  try {
    ({ text } = await extractResumeText(file));
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
    return NextResponse.json(
      {
        error: file.name.toLowerCase().endsWith('.pdf')
          ? 'That PDF has almost no selectable text — it is probably a scan or an image. Upload a PDF exported from the original document.'
          : 'There is barely any text in that file. Check you picked the right one.',
      },
      { status: 422 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const { error } = await supabaseAdmin()
      .from('profile')
      .upsert({
        id: true,
        resume_file: `\\x${bytes.toString('hex')}`,
        resume_filename: file.name,
        resume_content_type: file.type || 'application/octet-stream',
        resume_text: text,
        resume_uploaded_at: new Date().toISOString(),
      });

    if (error) throw error;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    filename: file.name,
    size: bytes.length,
    contentType: file.type || 'application/octet-stream',
    textLength: text.length,
  });
}

export async function DELETE() {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const { error } = await supabaseAdmin()
      .from('profile')
      .update({
        resume_file: null,
        resume_filename: null,
        resume_content_type: null,
        resume_text: null,
        resume_uploaded_at: null,
      })
      .eq('id', true);

    if (error) throw error;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
