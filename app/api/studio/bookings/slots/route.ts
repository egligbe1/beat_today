import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/security'
export async function GET(request: Request) {
 const params = new URL(request.url).searchParams
 const service = params.get('service'), day = params.get('day')
 if (!UUID_RE.test(service || '') || !/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return NextResponse.json({ error: 'Choose a service and date' }, { status: 400 })
 const db = await createClient()
 const { data, error } = await db.rpc('studio_booking_slots', { p_service: service, p_day: day })
 if (error) return NextResponse.json({ error: 'Available times could not be loaded' }, { status: 503 })
 return NextResponse.json({ slots: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
