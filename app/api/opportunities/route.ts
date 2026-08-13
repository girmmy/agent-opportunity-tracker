import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EDITABLE_FIELDS } from '@/lib/types';
import { requireSession } from '@/lib/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Keep only the fields a client may write, so no request can set id/timestamps. */
function pickEditable(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) out[field] = body[field];
  }
  return out;
}

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const { data, error } = await supabaseAdmin()
      .from('opportunities')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ opportunities: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const body = await request.json();
    const row = pickEditable(body);

    if (!row.organization || !row.role) {
      return NextResponse.json(
        { error: 'organization and role are required.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin()
      .from('opportunities')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ opportunity: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
