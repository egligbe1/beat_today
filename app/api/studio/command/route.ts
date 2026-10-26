import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/security'
import { missingStudioSchema } from '@/lib/studio/domain'

const ACTIONS = new Set(['create_studio','create_project','publish_agreement','accept_agreement','request_changes','message','add_milestone','complete_milestone','set_status'])
export async function POST(request: Request) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
  if (Number(request.headers.get('content-length') || 0) > 60000) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > 60000) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  let body: { action?: string; project_id?: string; payload?: unknown }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
  if (!body || !ACTIONS.has(body.action || '') || !body.payload || Array.isArray(body.payload) || typeof body.payload !== 'object'
    || (!['create_studio','create_project'].includes(body.action!) && !UUID_RE.test(body.project_id || ''))) {
    return NextResponse.json({ error: 'Invalid studio request' }, { status: 400 })
  }
  // Request-scoped auth is deliberate: the database derives the actor from auth.uid().
  const { data, error } = await db.rpc('studio_command', { p_action: body.action, p_project: body.project_id || null, p_payload: body.payload })
  if (error) {
    if (missingStudioSchema(error)) return NextResponse.json({ error: 'Studio workspace is not available yet' }, { status: 503 })
    const known = error.code === 'P0001' || error.code === '42501'
    if (!known) console.error('Studio command failed', { code: error.code, action: body.action })
    return NextResponse.json({ error: known ? error.message : 'Could not save this change. Check the fields and try again.' }, { status: error.code === '42501' ? 403 : 400 })
  }
  return NextResponse.json(data)
}
