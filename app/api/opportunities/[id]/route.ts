import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EDITABLE_FIELDS } from '@/lib/types';
import { requireSession } from '@/lib/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickEditable(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) out[field] = body[field];
  }
  return out;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const updates = pickEditable(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ opportunity: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const { id } = await params;
    const { error } = await supabaseAdmin()
      .from('opportunities')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
