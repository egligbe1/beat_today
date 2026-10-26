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
