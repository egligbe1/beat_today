'use client'
import { useStudioRefresh } from './useStudioRefresh'
import { useBookingClock } from './useBookingClock'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, CheckCircle2, Clock3 } from 'lucide-react'
import type { StudioBooking } from '@/lib/types'
import { BOOKING_LABELS, bookingAction, bookingDate, reservationExpired } from '@/lib/studio/booking'
import { studioMoney } from '@/lib/studio/domain'
import { studioButton, studioInput } from './StudioHome'
export default function BookingList({ bookings, producer = false, autoRefresh = false }: { bookings: StudioBooking[]; producer?: boolean; autoRefresh?: boolean }) {
 const router = useRouter()
 const now = useBookingClock()
 const [busy, setBusy] = useState<string | null>(null)
 const [error, setError] = useState('')
 const [reasonFor, setReasonFor] = useState<{id:string;action:string}|null>(null)
 useStudioRefresh(autoRefresh && !busy && !reasonFor)
 async function run(b: StudioBooking, action: string, reason = '') {
  setBusy(b.id); setError('')
  try { const result=await bookingAction(action,{booking_id:b.id,reason});setReasonFor(null);if(action==='reserve'&&result.project_id)router.push(`/dashboard/projects/${result.project_id}`);else router.refresh() }
  catch(e){setError(e instanceof Error?e.message:'Please try again')}
  finally{setBusy(null)}
 }
 return <div className="space-y-3">{error&&<p role="alert" className="text-sm p-4 bg-red-500/10 rounded-xl text-red-300">{error}</p>}{bookings.map(b=><article key={b.id} className="rounded-2xl border border-white/10 bg-[#111] p-5">
  <div className="flex flex-col sm:flex-row justify-between gap-4"><div><p className="text-[10px] uppercase tracking-widest text-orange-400 mb-2">{b.service_snapshot.room_name} · {b.service_snapshot.studio_name}</p><h3 className="font-bold">{b.service_snapshot.title}</h3><p className="text-sm text-zinc-400 mt-2">{bookingDate(b.starts_at,b.service_snapshot.timezone)} – {bookingDate(b.ends_at,b.service_snapshot.timezone,true)}</p><p className="text-[11px] text-zinc-600 mt-2">{b.service_snapshot.timezone} · {studioMoney(b.service_snapshot.price_minor)} service quote{producer&&b.artist?` · ${b.artist.display_name||'@'+b.artist.handle}`:''}</p></div><span className={`self-start inline-flex gap-2 items-center text-[10px] font-bold uppercase tracking-wide rounded-lg px-3 py-2 ${b.status==='CONFIRMED'?'text-emerald-400 bg-emerald-500/10':b.status==='REQUESTED'||b.status==='RESERVED'?'text-orange-300 bg-orange-500/10':'text-zinc-500 bg-white/5'}`}>{b.status==='CONFIRMED'?<CheckCircle2 className="w-3 h-3"/>:<Clock3 className="w-3 h-3"/>}{reservationExpired(b,now)?'Reservation expired':b.status==='REQUESTED'&&Date.parse(b.starts_at)<=now?'Request time passed':BOOKING_LABELS[b.status]}</span></div>
  {b.notes&&<p className="text-sm text-zinc-500 whitespace-pre-wrap break-words mt-4">{b.notes}</p>}
  {b.status==='RESERVED'&&!reservationExpired(b,now)&&b.reserved_until&&<p className="text-xs text-amber-400/80 mt-3">Time reserved until {bookingDate(b.reserved_until,b.service_snapshot.timezone)}. Agreement acceptance confirms the session; expired reservations must be renewed.</p>}
  {reservationExpired(b,now)&&<p className="text-xs text-amber-300 mt-3">This time is no longer held. {Date.parse(b.starts_at)<=now?'The session time has passed; arrange a new booking.':producer?'Renew the reservation if the time is still free before the artist accepts.':'Ask the producer to renew the reservation before confirming the agreement.'}</p>}
  {b.outcome_reason&&<p className="text-xs text-zinc-500 mt-3">Update: {b.outcome_reason}</p>}
  <div className="mt-5 flex flex-wrap gap-3 items-center">{b.project_id&&<Link className="text-xs text-orange-400 font-bold inline-flex gap-1.5 items-center" href={`/dashboard/projects/${b.project_id}`}>Agreement & project<ArrowUpRight className="w-3.5 h-3.5"/></Link>}
   {producer&&b.status==='REQUESTED'&&<><button disabled={!!busy||Date.parse(b.starts_at)<=now} className={studioButton+' !py-2 !text-xs'} onClick={()=>run(b,'reserve')}>Reserve & prepare agreement</button><button disabled={!!busy} className="text-xs text-zinc-500" onClick={()=>setReasonFor({id:b.id,action:'decline'})}>Decline</button></>}
   {producer&&reservationExpired(b,now)&&Date.parse(b.starts_at)>now&&<button disabled={!!busy} onClick={()=>run(b,'reserve')} className="text-xs text-zinc-400">Renew expired reservation</button>}
   {producer&&['RESERVED','CONFIRMED'].includes(b.status)&&<button disabled={!!busy} className="text-xs text-zinc-500" onClick={()=>setReasonFor({id:b.id,action:'cancel'})}>Cancel reservation</button>}
   {producer&&b.status==='CONFIRMED'&&Date.parse(b.ends_at)<=now&&<button disabled={!!busy} onClick={()=>run(b,'complete')} className="text-xs text-zinc-400">Mark session complete</button>}
   {!producer&&b.status==='REQUESTED'&&<button disabled={!!busy} className="text-xs text-zinc-400" onClick={()=>setReasonFor({id:b.id,action:'withdraw'})}>Withdraw request</button>}
  </div>
  {reasonFor?.id===b.id&&<form className="mt-4 space-y-3 border-t border-white/10 pt-4" onSubmit={e=>{e.preventDefault();run(b,reasonFor.action,String(new FormData(e.currentTarget).get('reason')||''))}}><p className="text-xs text-zinc-500">This updates the booking and releases any reserved time. The agreement and project history are retained; no payment or refund is processed.</p><textarea name="reason" aria-label="Reason for booking update" required minLength={5} maxLength={1000} rows={2} placeholder="Explain the change to the other party…" className={studioInput}/><div className="flex gap-4 items-center"><button disabled={!!busy} className={studioButton+' !py-2 !text-xs'}>Confirm update</button><button type="button" onClick={()=>setReasonFor(null)} className="text-xs text-zinc-500">Keep booking</button></div></form>}
 </article>)}{!bookings.length&&<div className="text-center p-10 border border-dashed border-white/10 rounded-2xl"><Clock3 className="w-8 h-8 text-zinc-600 mx-auto mb-4"/><h3 className="font-bold">No sessions here yet</h3><p className="text-sm text-zinc-500 mt-2">{producer?'Share your booking page or add a session for an artist.':'Your studio requests and confirmed sessions will appear here.'}</p></div>}</div>
}
