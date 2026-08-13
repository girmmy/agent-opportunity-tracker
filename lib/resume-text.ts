/**
 * Pull plain text out of an uploaded résumé.
 *
 * PDF and DOCX only, plus plain text. Not .doc — the old binary Word format
 * needs a different parser entirely, and telling someone "export as PDF" is a
 * better answer than half-reading it.
 */

export const ACCEPTED = '.pdf,.docx,.txt,.md';

/** Vercel caps a serverless request body at 4.5MB. Stay under it. */
export const MAX_BYTES = 4 * 1024 * 1024;

export class ResumeTextError extends Error {}

export async function extractResumeText(
  file: File
): Promise<{ text: string; pages: number | null }> {
  if (file.size === 0) throw new ResumeTextError('That file is empty.');
  if (file.size > MAX_BYTES) {
    throw new ResumeTextError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 4MB — a résumé should be well under it, so this is probably the wrong file.`
    );
  }

  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(buf);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { text: clean(text), pages: totalPages };
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(buf),
    });
    return { text: clean(value), pages: null };
  }

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return { text: clean(new TextDecoder().decode(buf)), pages: null };
  }

  if (name.endsWith('.doc')) {
    throw new ResumeTextError(
      'Old .doc files can’t be read here. Export it as PDF and upload that.'
    );
  }

  if (name.endsWith('.pages')) {
    throw new ResumeTextError(
      'Pages documents can’t be read here. In Pages: File → Export To → PDF.'
    );
  }

  throw new ResumeTextError(
    `Unsupported file type. Upload a PDF, DOCX, or plain text file.`
  );
}

function clean(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * A scanned résumé is an image — the parser returns almost nothing rather than
 * failing, which would otherwise surface as a mysteriously empty profile.
 */
export function looksUnreadable(text: string): boolean {
  return text.replace(/\s/g, '').length < 120;
}
