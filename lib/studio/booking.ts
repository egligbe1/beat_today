import type { StudioBooking } from '@/lib/types'
export const BOOKING_LABELS: Record<StudioBooking['status'], string> = { REQUESTED: 'New request', RESERVED: 'Awaiting agreement', CONFIRMED: 'Confirmed', DECLINED: 'Declined', CANCELLED: 'Cancelled', COMPLETED: 'Session complete' }
export const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
export function bookingDate(value: string, timezone: string, timeOnly = false) {
 return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeZoneName: 'short', ...(timeOnly ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }).format(new Date(value))
}
export function addDateDays(date: string, count: number) {
 const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0,10)
}
export async function bookingAction(action: string, payload: Record<string, unknown>) {
 const response = await fetch('/api/studio/bookings/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload }) })
 const result = await response.json()
 if (!response.ok) throw new Error(result.error || 'Could not save this booking change')
 return result as { id: string; project_id?: string }
}

export function validBookingDay(value: string): boolean {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
 const date = new Date(value + 'T12:00:00Z')
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function reservationExpired(booking: StudioBooking, now = Date.now()) {
 return booking.status === 'RESERVED' && (!booking.reserved_until || Date.parse(booking.reserved_until) <= now || Date.parse(booking.starts_at) <= now)
}
export function bookingSetup(rooms: {id:string}[], services: {room_id:string;is_active:boolean;duration_minutes:number;buffer_minutes:number}[], hours: {room_id:string;opens:string;closes:string;closed:boolean}[]) {
 const minutes = (v:string) => Number(v.slice(0,2))*60 + Number(v.slice(3,5))
 const active = services.filter(s=>s.is_active && rooms.some(r=>r.id===s.room_id))
 const fitting = active.filter(s=>hours.some(h=>h.room_id===s.room_id&&!h.closed&&minutes(h.closes)-minutes(h.opens)>=s.duration_minutes+2*s.buffer_minutes))
 return { hasRoom: rooms.length>0, hasService: active.length>0, hasHours: fitting.length>0, ready: fitting.length>0 }
}
// A bounded, user-requested search. Availability stays authoritative on submission.
export async function nextBookingDay(start:string, last:string, load:(day:string)=>Promise<string[]>, signal:AbortSignal) {
 for (let offset=1; offset<=7; offset++) {
  if (signal.aborted) return null
  const day=addDateDays(start,offset)
  if(day>last) break
  const slots=await load(day)
  if(signal.aborted) return null
  if(slots.length) return day
 }
 return null
}
