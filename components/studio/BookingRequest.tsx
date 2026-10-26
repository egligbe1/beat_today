'use client'
import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock3, ArrowRight, MapPin, Music2 } from 'lucide-react'
import type { StudioBookingCatalog } from '@/lib/types'
import { Field, studioButton, studioInput } from './StudioHome'
import { studioMoney } from '@/lib/studio/domain'
import { addDateDays, bookingDate, bookingAction } from '@/lib/studio/booking'
export default function BookingRequest({ catalog, signedIn, owner = false, manual = false }: { catalog: StudioBookingCatalog; signedIn: boolean; owner?: boolean; manual?: boolean }) {
 const router = useRouter()
 const [serviceId, setServiceId] = useState(catalog.services[0]?.id || '')
 const [day, setDay] = useState(catalog.today)
 const [slots, setSlots] = useState<string[]>([])
 const [selected, setSelected] = useState('')
 const [loading, setLoading] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [sent, setSent] = useState(false)
 const service = catalog.services.find(s => s.id === serviceId)
 useEffect(() => {
  setSelected(''); setSlots([])
  if (!serviceId || !day) { setLoading(false); return }
  const controller = new AbortController(); setLoading(true); setError('')
  fetch(`/api/studio/bookings/slots?service=${encodeURIComponent(serviceId)}&day=${encodeURIComponent(day)}`,{signal:controller.signal})
   .then(async r => { const result = await r.json(); if(!r.ok) throw new Error(result.error); return result })
   .then(data => { if (!controller.signal.aborted) setSlots(Array.isArray(data.slots) ? data.slots : []) })
   .catch(e => { if(!controller.signal.aborted) setError(e.message || 'Available times could not be loaded') })
   .finally(() => { if(!controller.signal.aborted) setLoading(false) })
  return () => controller.abort()
 }, [serviceId, day])
 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault(); if(!selected || !service) return
  const form = new FormData(e.currentTarget); setBusy(true); setError('')
  try {
   const result = await bookingAction(manual ? 'manual_booking' : 'request',{service_id:service.id,starts_at:selected,notes:form.get('notes'),...(manual ? {artist_handle:form.get('artist_handle')} : {})})
   if(manual && result.project_id) router.push(`/dashboard/projects/${result.project_id}`)
   else setSent(true)
  } catch(e) { setError(e instanceof Error ? e.message : 'Please try again') }
  finally { setBusy(false) }
 }
 if(sent) return <div className="rounded-3xl border border-emerald-500/20 bg-[#111] p-8 md:p-12 text-center"><CheckCircle2 className="text-emerald-400 w-12 h-12 mx-auto mb-6"/><h2 className="text-3xl font-bold">Your session request is in.</h2><p className="text-zinc-400 text-sm leading-relaxed max-w-md mx-auto mt-4">The producer will review your requested time. Once reserved, you’ll confirm the agreement together to finalise your session. No payment has been taken.</p><Link href="/dashboard/bookings" className={studioButton+' mt-7'}>View my bookings<ArrowRight className="w-4 h-4"/></Link></div>
 return <div className="space-y-7">
  {!manual && <header className="p-7 md:p-10 rounded-3xl border border-white/10 bg-[#111] relative overflow-hidden"><span className="text-orange-400 text-[10px] uppercase font-bold tracking-[.25em]">Book a studio session</span><h1 className="text-3xl md:text-5xl font-black tracking-tight mt-5">{catalog.name}</h1><p className="text-zinc-400 text-sm mt-4">Choose your service and time. Create something worth hearing.</p><div className="flex flex-wrap gap-5 mt-6 text-xs text-zinc-500"><span className="flex gap-2 items-center"><MapPin className="w-3.5 h-3.5"/>{catalog.city || 'Studio session'}</span><span>{catalog.producer_name}</span><span>{catalog.timezone.replaceAll('_',' ')}</span></div></header>}
  {error && <p role="alert" className="p-4 rounded-xl bg-red-500/10 text-red-300 text-sm">{error}</p>}
  <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"><div className="space-y-7 min-w-0">
   <section><h2 className="text-lg font-bold mb-4"><span className="text-orange-400 mr-3">01</span>Choose a service</h2><div className="grid sm:grid-cols-2 gap-3">{catalog.services.map(s=><button key={s.id} onClick={()=>{setServiceId(s.id);setSelected('')}} aria-pressed={serviceId===s.id} className={`text-left p-5 rounded-2xl border transition-colors ${serviceId===s.id?'border-orange-500/50 bg-orange-500/[.06]':'border-white/10 bg-[#111] hover:border-white/20'}`}><Music2 className="w-5 h-5 text-orange-400 mb-4"/><h3 className="font-bold text-sm">{s.title}</h3><p className="text-xs text-zinc-500 mt-2 line-clamp-3">{s.description}</p><p className="text-[11px] text-zinc-500 mt-4">{s.duration_minutes} minutes · {s.room_name}</p><p className="font-bold mt-3">{studioMoney(s.price_minor)}</p></button>)}</div>{!catalog.services.length&&<p className="text-sm text-zinc-500 p-6 border border-dashed border-white/10 rounded-xl">{manual ? 'Add an active session service in studio settings.' : 'This studio has no sessions available to request right now.'}</p>}</section>
   <section className="rounded-2xl bg-[#111] border border-white/10 p-5 md:p-6"><h2 className="text-lg font-bold mb-5"><span className="text-orange-400 mr-3">02</span>Choose your time</h2><Field label={`Session date · ${catalog.timezone}`}><input type="date" value={day} onChange={e=>{setDay(e.target.value);setSelected('');setSlots([])}} min={catalog.today} max={addDateDays(catalog.today,catalog.horizon_days)} className={studioInput}/></Field><p className="text-xs text-zinc-500 mt-3">All session times are shown in {catalog.timezone}. {manual?'Choose an available studio time.':`${catalog.notice_hours} hours’ advance notice.`}</p><div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-5">{slots.map(slot=><button key={slot} onClick={()=>setSelected(slot)} aria-pressed={selected===slot} className={`rounded-xl py-3 px-2 text-sm font-semibold border ${selected===slot?'bg-[#FF5500] text-white border-orange-500':'border-white/10 text-zinc-400 hover:text-white hover:border-orange-500/30'}`}>{bookingDate(slot,catalog.timezone,true)}</button>)}</div>{loading?<p role="status" className="text-sm text-zinc-500 mt-5">Finding available times…</p>:!slots.length&&<p className="text-sm text-zinc-500 mt-5">{day ? 'No available times on this date. Try another date or service.' : 'Choose a session date to see available times.'}</p>}</section>
   <form onSubmit={submit} className="rounded-2xl bg-[#111] border border-white/10 p-5 md:p-6 space-y-4"><h2 className="text-lg font-bold"><span className="text-orange-400 mr-3">03</span>{manual?'Add the artist':'Tell the producer about your session'}</h2>{manual&&<Field label="Artist’s BeatToday handle"><input name="artist_handle" required maxLength={100} className={studioInput} placeholder="@artist" autoCapitalize="none"/></Field>}<Field label="Session notes"><textarea name="notes" required minLength={10} maxLength={3000} rows={4} className={studioInput} placeholder="What are you working on? Include the number of songs, session goals and any preparation needs."/></Field>
    <p className="text-xs text-zinc-500 leading-relaxed">{manual?'The time will be reserved while you prepare the agreement. The artist’s acceptance confirms the session.':'Sending a request does not hold the time. The producer reserves it before you confirm an agreement together. No payment is taken here.'}</p>
    {!signedIn?<Link className={studioButton} href={`/login?redirect=${encodeURIComponent('/studio/'+catalog.handle)}`}>Sign in to request a session<ArrowRight className="w-4 h-4"/></Link>:owner&&!manual?<Link className={studioButton} href="/dashboard/studio">Manage studio calendar</Link>:<button disabled={busy||!selected||!service} className={studioButton}>{busy?'Saving…':manual?'Reserve & prepare agreement':'Request session'}<ArrowRight className="w-4 h-4"/></button>}
   </form>
  </div><aside className="rounded-2xl bg-[#111] border border-white/10 p-6 lg:sticky lg:top-6"><CalendarDays className="w-5 h-5 text-orange-400 mb-5"/><h2 className="font-bold">Your session</h2><div className="mt-5 space-y-4 text-sm"><p className="text-zinc-300 font-bold">{service?.title||'Choose a service'}</p><p className="text-xs text-zinc-500 flex gap-2 items-center"><Clock3 className="w-3.5 h-3.5"/>{service?`${service.duration_minutes} minutes · ${service.room_name}`:'Select a duration'}</p><p className="text-zinc-400">{selected?bookingDate(selected,catalog.timezone):'Choose an available time'}</p><div className="flex justify-between border-t border-white/10 pt-5"><span className="text-zinc-500">Service quote</span><strong>{service?studioMoney(service.price_minor):'—'}</strong></div><p className="text-xs text-zinc-600 leading-relaxed">Final scope, price, payment and cancellation terms are confirmed in your agreement. No charge is made by this request.</p></div></aside></div>
 </div>
}
