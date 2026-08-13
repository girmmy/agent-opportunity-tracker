import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireSession } from '@/lib/guard';
import { PROFILE_FIELDS } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  try {
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (field in body) {
        const v = body[field];
        updates[field] = typeof v === 'string' && v.trim() ? v : null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    // Upsert rather than update: the singleton row is seeded by the migration,
    // but this keeps the route working if it was ever cleared.
    const { data, error } = await supabaseAdmin()
      .from('profile')
      .upsert({ id: true, ...updates })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
