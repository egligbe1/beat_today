import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validBookingDay } from '@/lib/studio/booking'
import { UUID_RE } from '@/lib/security'
export async function GET(request: Request) {
 const params = new URL(request.url).searchParams
 const service = params.get('service'), day = params.get('day')
 if (!UUID_RE.test(service || '') || !validBookingDay(day || '')) return NextResponse.json({ error: 'Choose a service and date' }, { status: 400 })
 const db = await createClient()
 const { data, error } = await db.rpc('studio_booking_slots', { p_service: service, p_day: day })
 if (error) return NextResponse.json({ error: 'Available times could not be loaded' }, { status: 503 })
 return NextResponse.json({ slots: data }, { headers: { 'Cache-Control': 'private, no-store' } })
}
