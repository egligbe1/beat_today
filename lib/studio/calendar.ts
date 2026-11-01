import type {SupabaseClient} from '@supabase/supabase-js'
import {addDateDays,validBookingDay} from './booking'
export const BOOKING_PAGE_SIZE=25
export function bookingPage(value:unknown) {
 if(typeof value!=='string'||!/^\d{1,5}$/.test(value))return 1
 return Math.max(1,Math.min(10000,Number(value)))
}
export function pageRange(page:number,size=BOOKING_PAGE_SIZE) {return {from:(page-1)*size,to:page*size-1}}
/** First instant of each studio-local date, including midnight DST jumps. */
export function studioDayBounds(day:string,timeZone:string) {
 if(!validBookingDay(day))throw new Error('Invalid calendar date')
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'})
 const localDay=(instant:number)=>{
  const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
 }
 function firstInstant(date:string) {
  const target=Date.parse(date+'T00:00:00Z')
  let low=target-36*3600000,high=target+36*3600000
  while(low<high){const middle=Math.floor((low+high)/2);if(localDay(middle)<date)low=middle+1;else high=middle}
  if(localDay(low)!==date)throw new Error('This date does not exist in the studio timezone')
  return new Date(low).toISOString()
 }
 return {start:firstInstant(day),end:firstInstant(addDateDays(day,1))}
}

export function calendarBookingsQuery(db:SupabaseClient,userId:string,studioId:string,bounds:{start:string;end:string}) {
 return db.from('studio_bookings').select('*,artist:users_profiles!studio_bookings_artist_id_fkey(display_name,handle)',{count:'exact'})
  .eq('producer_id',userId).eq('studio_id',studioId).in('status',['REQUESTED','RESERVED','CONFIRMED','COMPLETED'])
  .gte('starts_at',bounds.start).lt('starts_at',bounds.end).order('starts_at').order('id')
}
