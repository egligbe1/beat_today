import 'server-only'
import {calendarBookingsQuery,studioDayBounds,pageRange,BOOKING_PAGE_SIZE} from './calendar'
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
export async function bookingWorkspace(userId:string,studioId:string,day:string,timeZone:string,calendarPage=1,requestPage=1) {
 const db=await createClient()
 const bounds=studioDayBounds(day,timeZone),now=new Date().toISOString()
 const calendarQuery=()=>calendarBookingsQuery(db,userId,studioId,bounds)
 const requestsQuery=()=>db.from('studio_bookings').select('*,artist:users_profiles!studio_bookings_artist_id_fkey(display_name,handle)',{count:'exact'})
  .eq('producer_id',userId).eq('studio_id',studioId).eq('status','REQUESTED').order('created_at',{ascending:false}).order('id')
 const cr=pageRange(calendarPage),rr=pageRange(requestPage)
 const [initialCalendar,initialRequests,live,rooms,services,hours,blocks]=await Promise.all([
  calendarQuery().range(cr.from,cr.to),requestsQuery().range(rr.from,rr.to),
  db.from('studio_bookings').select('id',{count:'exact',head:true}).eq('producer_id',userId).eq('studio_id',studioId)
   .or(`status.eq.CONFIRMED,and(status.eq.RESERVED,reserved_until.gt.${now},starts_at.gt.${now})`),
  db.from('studio_rooms').select('*').eq('studio_id',studioId).order('created_at'),
  db.from('studio_session_services').select('*').order('created_at').limit(40),
  db.from('studio_opening_hours').select('*').order('weekday'),
  db.from('studio_time_blocks').select('*').eq('is_active',true).lt('starts_at',bounds.end).gt('ends_at',bounds.start).order('starts_at').limit(1000),
 ])
 const results=[initialCalendar,initialRequests,live,rooms,services,hours,blocks]
 if(results.some(r=>missingStudioSchema(r.error)))return null
 if(results.some(r=>r.error))throw new Error('Bookings could not be loaded')
 const calendarTotal=initialCalendar.count||0,requestTotal=initialRequests.count||0
 const actualCalendarPage=Math.min(calendarPage,Math.max(1,Math.ceil(calendarTotal/BOOKING_PAGE_SIZE)))
 const actualRequestPage=Math.min(requestPage,Math.max(1,Math.ceil(requestTotal/BOOKING_PAGE_SIZE)))
 const calendarRange=pageRange(actualCalendarPage),requestsRange=pageRange(actualRequestPage)
 const [calendar,requests]=await Promise.all([
  actualCalendarPage===calendarPage?Promise.resolve(initialCalendar):calendarQuery().range(calendarRange.from,calendarRange.to),
  actualRequestPage===requestPage?Promise.resolve(initialRequests):requestsQuery().range(requestsRange.from,requestsRange.to),
 ])
 if(calendar.error||requests.error)throw new Error('Bookings could not be loaded')
 return {bookings:calendar.data as StudioBooking[],requests:requests.data as StudioBooking[],rooms:rooms.data as StudioRoom[],services:services.data as StudioSessionService[],hours:hours.data as StudioOpeningHours[],blocks:blocks.data as StudioTimeBlock[],calendarDay:day,calendarPage:actualCalendarPage,requestPage:actualRequestPage,calendarTotal,requestTotal,liveTotal:live.count||0}
}
export async function artistBookings(userId:string,page=1) {
 const db=await createClient()
 const query=()=>db.from('studio_bookings').select('*',{count:'exact'}).eq('artist_id',userId).order('starts_at',{ascending:false}).order('id')
 const range=pageRange(page);let result=await query().range(range.from,range.to)
 if(missingStudioSchema(result.error))return {bookings:[] as StudioBooking[],unavailable:true,total:0,page:1}
 if(result.error)throw new Error('Bookings could not be loaded')
 const total=result.count||0,actualPage=Math.min(page,Math.max(1,Math.ceil(total/BOOKING_PAGE_SIZE)))
 if(actualPage!==page){const next=pageRange(actualPage);result=await query().range(next.from,next.to);if(result.error)throw new Error('Bookings could not be loaded')}
 return {bookings:result.data as StudioBooking[],unavailable:false,total,page:actualPage}
}
