import 'server-only'
import { addDateDays } from './booking'
import { createClient } from '@/lib/supabase/server'
import { missingStudioSchema } from './domain'
import type { StudioBooking, StudioBookingCatalog, StudioRoom, StudioSessionService, StudioOpeningHours, StudioTimeBlock } from '@/lib/types'
export async function bookingCatalog(handle: string) {
 const db = await createClient()
 const result = await db.rpc('studio_booking_catalog', { p_handle: handle })
 if (missingStudioSchema(result.error)) return null
 if (result.error) throw new Error('Studio booking page could not be loaded')
 return result.data as StudioBookingCatalog | null
}
// Keep the public producer profile usable if studio intake is unavailable.
export async function profileBookingCatalog(handle: string) {
 try { return await bookingCatalog(handle) }
 catch (error) {
  console.error('Public studio catalog unavailable', error)
  return null
 }
}
export async function bookingWorkspace(userId: string, studioId: string, today: string) {
 const db = await createClient()
 const [bookings, rooms, services, hours, blocks] = await Promise.all([
  db.from('studio_bookings').select('*,artist:users_profiles!studio_bookings_artist_id_fkey(display_name,handle)').eq('producer_id', userId).order('starts_at', { ascending: false }).limit(200),
  db.from('studio_rooms').select('*').eq('studio_id', studioId).order('created_at'),
  db.from('studio_session_services').select('*').order('created_at').limit(40),
  db.from('studio_opening_hours').select('*').order('weekday'),
  db.from('studio_time_blocks').select('*').eq('is_active',true).gte('ends_at',addDateDays(today,-1)).order('starts_at').limit(200),
 ])
 if ([bookings, rooms, services, hours, blocks].some(r => missingStudioSchema(r.error))) return null
 if ([bookings, rooms, services, hours, blocks].some(r => r.error)) throw new Error('Bookings could not be loaded')
 return { bookings: bookings.data as StudioBooking[], rooms: rooms.data as StudioRoom[], services: services.data as StudioSessionService[], hours: hours.data as StudioOpeningHours[], blocks: blocks.data as StudioTimeBlock[] }
}
export async function artistBookings(userId: string) {
 const db = await createClient()
 const result = await db.from('studio_bookings').select('*').eq('artist_id', userId).order('starts_at', { ascending: false }).limit(200)
 if (missingStudioSchema(result.error)) return { bookings: [] as StudioBooking[], unavailable: true }
 if (result.error) throw new Error('Bookings could not be loaded')
 return { bookings: result.data as StudioBooking[], unavailable: false }
}
