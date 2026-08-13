import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { agentAuthorized } from '@/lib/agent-auth';
import { EDITABLE_FIELDS } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Endpoint for the weekly job-search agent.
 *
 * Separate from the cookie-authenticated routes because the agent has no
 * browser session — it authenticates with a bearer token instead. middleware.ts
 * deliberately skips this path so the check below is the only gate.
 */

function pickEditable(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) out[field] = body[field];
  }
  return out;
}

export async function GET(request: Request) {
  if (!agentAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

/**
 * Upsert by (organization, role, cycle) so a re-run of the weekly agent
 * updates the existing row instead of creating a duplicate.
 */
export async function POST(request: Request) {
  if (!agentAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rows: Record<string, unknown>[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.opportunities)
        ? body.opportunities
        : [body];

    const cleaned = rows.map(pickEditable).filter((r) => r.organization && r.role);
    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows (organization and role are required).' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin()
      .from('opportunities')
      .upsert(cleaned, { onConflict: 'organization,role,cycle' })
      .select();

    if (error) throw error;
    return NextResponse.json({ upserted: data?.length ?? 0, opportunities: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
