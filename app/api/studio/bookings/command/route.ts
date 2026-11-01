import { readRequestText, safeRequestError } from '@/lib/http'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { missingStudioSchema } from '@/lib/studio/domain'
const actions = new Set(['create_room','create_service','save_hours','publish','toggle_service','block_time','unblock_time','request','manual_booking','reserve','decline','cancel','withdraw','complete'])
export async function POST(request: Request) {
 const db = await createClient()
 const { data: { user } } = await db.auth.getUser()
 if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
 let raw
 try{raw=await readRequestText(request,20000)}catch(error){const e=safeRequestError(error);return NextResponse.json({error:e.message},{status:e.status})}
 let body
 try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid booking request' }, { status: 400 }) }
 if (!body || !actions.has(body.action) || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) return NextResponse.json({ error: 'Invalid booking request' }, { status: 400 })
 const { data, error } = await db.rpc('studio_booking_command', { p_action: body.action, p_payload: body.payload })
 if (error) {
  if (missingStudioSchema(error)) return NextResponse.json({ error: 'Studio bookings are not available yet' }, { status: 503 })
  const known = ['P0001','42501'].includes(error.code)
  if (!known) console.error('Studio booking command failed', { code: error.code, action: body.action })
  return NextResponse.json({ error: known ? error.message : error.code === '23505' ? 'You already have a request for this time.' : 'Check the booking details and try again.' }, { status: error.code === '42501' ? 403 : 400 })
 }
 return NextResponse.json(data)
}
