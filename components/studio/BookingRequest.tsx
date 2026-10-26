'use client'
import CustomServiceRequest from './CustomServiceRequest'
import DateInput from '@/components/ui/DateInput'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, Clock3, ArrowRight, MapPin, Music2 } from 'lucide-react'
import type { StudioBookingCatalog } from '@/lib/types'
import { Field, studioButton, studioInput } from './StudioHome'
import { studioMoney } from '@/lib/studio/domain'
import { addDateDays, bookingDate, bookingAction, validBookingDay, nextBookingDay } from '@/lib/studio/booking'
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
 const [notes, setNotes] = useState('')
 const [ready, setReady] = useState(false)
 const [reload, setReload] = useState(0)
 const [searching, setSearching] = useState(false)
 const [availabilityNote, setAvailabilityNote] = useState('')
 const restoredSlot = useRef('')
 const searchController = useRef<AbortController | null>(null)
 const draftKey = 'studio-booking-draft:' + catalog.id
 useEffect(() => {
  try {
   const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null')
   if (!manual && draft && Date.now()-draft.savedAt<86400000 && catalog.services.some(s=>s.id===draft.serviceId)) {
    setServiceId(draft.serviceId)
    if (validBookingDay(draft.day) && draft.day>=catalog.today && draft.day<=addDateDays(catalog.today,catalog.horizon_days)) {
     setDay(draft.day); restoredSlot.current=typeof draft.selected==='string'?draft.selected:''
    }
    setNotes(typeof draft.notes==='string'?draft.notes.slice(0,3000):'')
   }
  } catch { /* Booking remains available when browser storage is disabled. */ }
  setReady(true)
 }, [draftKey, manual, catalog])
 function rememberDraft() {
  try { sessionStorage.setItem(draftKey,JSON.stringify({serviceId,day,selected,notes,savedAt:Date.now()})) } catch {}
 }
 async function loadSlots(forDay:string, signal:AbortSignal) {
  const response=await fetch(`/api/studio/bookings/slots?service=${encodeURIComponent(serviceId)}&day=${encodeURIComponent(forDay)}`,{signal,cache:'no-store'})
  const result=await response.json()
  if(!response.ok) throw new Error(result.error || 'Available times could not be loaded')
  if(!Array.isArray(result.slots)) throw new Error('Available times could not be loaded')
  return result.slots as string[]
 }
 async function findNextDay() {
  searchController.current?.abort()
  const controller=new AbortController();searchController.current=controller
  setSearching(true);setError('');setAvailabilityNote('')
  try {
   const next=await nextBookingDay(day,addDateDays(catalog.today,catalog.horizon_days),d=>loadSlots(d,controller.signal),controller.signal)
   if(!controller.signal.aborted) {
    if(next) { setDay(next);setSelected('');setAvailabilityNote('Showing the next available day. Choose a time below.') }
    else setAvailabilityNote('No available times in the next 7 days within the booking window. Try a later date, another service or contact the producer.')
   }
  } catch(e) { if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Available times could not be loaded') }
  finally { if(searchController.current===controller)setSearching(false) }
 }
 useEffect(()=>{setSearching(false);return()=>searchController.current?.abort()},[serviceId,day])
 const service = catalog.services.find(s => s.id === serviceId)
 useEffect(() => {
  setSelected(''); setSlots([])
  if (!ready || !serviceId || !validBookingDay(day)) { setLoading(false); return }
  const controller = new AbortController(); setLoading(true)
  loadSlots(day,controller.signal)
   .then(times => { if (!controller.signal.aborted) {
    setSlots(times)
    if(restoredSlot.current && times.includes(restoredSlot.current)) setSelected(restoredSlot.current)
    restoredSlot.current=''
   } })
   .catch(e => { if(!controller.signal.aborted) setError(e.message || 'Available times could not be loaded') })
   .finally(() => { if(!controller.signal.aborted) setLoading(false) })
  return () => controller.abort()
 }, [serviceId, day, ready, reload])
 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault(); if(busy || loading || !selected || !service || !slots.includes(selected)) return
  const form = new FormData(e.currentTarget); setBusy(true); setError('')
  try {
   const result = await bookingAction(manual ? 'manual_booking' : 'request',{service_id:service.id,starts_at:selected,notes,...(manual ? {artist_handle:form.get('artist_handle')} : {})})
   if(manual && result.project_id) router.push(`/dashboard/projects/${result.project_id}`)
   else { try { sessionStorage.removeItem(draftKey) } catch {}; setSent(true) }
  } catch(e) { setError(e instanceof Error ? e.message : 'Please try again');setSelected('');setReload(n=>n+1) }
  finally { setBusy(false) }
 }
 if(sent) return <div className="rounded-3xl border border-emerald-500/20 bg-[#111] p-8 md:p-12 text-center"><CheckCircle2 className="text-emerald-400 w-12 h-12 mx-auto mb-6"/><h2 className="text-3xl font-bold">Your session request is in.</h2><p className="text-zinc-400 text-sm leading-relaxed max-w-md mx-auto mt-4">The producer will review your requested time. Once reserved, you’ll confirm the agreement together to finalise your session. No payment has been taken.</p><Link href="/dashboard/bookings" className={studioButton+' mt-7'}>View my bookings<ArrowRight className="w-4 h-4"/></Link></div>
 return <div className="space-y-7">
  {!manual && <Link href={`/${encodeURIComponent(catalog.handle)}`} className="inline-flex text-sm text-zinc-400 hover:text-white">Back to producer profile / contact</Link>}
  {!manual && <header className="p-7 md:p-10 rounded-3xl border border-white/10 bg-[#111] relative overflow-hidden"><span className="text-orange-400 text-[10px] uppercase font-bold tracking-[.25em]">Book a studio session</span><h1 className="text-3xl md:text-5xl font-black tracking-tight mt-5">{catalog.name}</h1><p className="text-zinc-400 text-sm mt-4">Choose your service and time. Create something worth hearing.</p><div className="flex flex-wrap gap-5 mt-6 text-xs text-zinc-500"><span className="flex gap-2 items-center"><MapPin className="w-3.5 h-3.5"/>{catalog.city || 'Studio session'}</span><span>{catalog.producer_name}</span><span>{catalog.timezone.replaceAll('_',' ')}</span></div></header>}
  {error && <div role="alert" className="p-4 rounded-xl bg-red-500/10 text-red-300 text-sm space-y-3"><p>{error}</p><button disabled={loading||busy} onClick={()=>{setError('');setReload(n=>n+1)}} className="font-bold underline">Refresh available times</button><Link href="/dashboard/bookings" className="block underline">Check my existing requests</Link></div>}
  <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"><div className="space-y-7 min-w-0">
   <section><h2 className="text-lg font-bold mb-4"><span className="text-orange-400 mr-3">01</span>Choose a service</h2><div className="grid sm:grid-cols-2 gap-3">{catalog.services.map(s=><button key={s.id} onClick={()=>{setServiceId(s.id);setSelected('');restoredSlot.current='';setAvailabilityNote('');setError('')}} disabled={busy} aria-pressed={serviceId===s.id} className={`text-left p-5 rounded-2xl border transition-colors ${serviceId===s.id?'border-orange-500/50 bg-orange-500/[.06]':'border-white/10 bg-[#111] hover:border-white/20'}`}><Music2 className="w-5 h-5 text-orange-400 mb-4"/><h3 className="font-bold text-sm">{s.title}</h3><p className="text-xs text-zinc-500 mt-2 line-clamp-3">{s.description}</p><p className="text-[11px] text-zinc-500 mt-4">{s.duration_minutes} minutes · {s.room_name}</p><p className="font-bold mt-3">{studioMoney(s.price_minor)}</p></button>)}</div>{!catalog.services.length&&<p className="text-sm text-zinc-500 p-6 border border-dashed border-white/10 rounded-xl">{manual ? 'Add an active session service in studio settings.' : 'This studio has no sessions available to request right now.'}</p>}{!manual&&!owner&&<CustomServiceRequest producerId={catalog.owner_id}/>}</section>
   <section className="rounded-2xl bg-[#111] border border-white/10 p-5 md:p-6"><h2 className="text-lg font-bold mb-5"><span className="text-orange-400 mr-3">02</span>Choose your time</h2><Field label={`Session date · ${catalog.timezone}`}><DateInput aria-label="Session date" disabled={busy||searching} value={day} onChange={e=>{setDay(e.target.value);setSelected('');setSlots([]);restoredSlot.current='';setAvailabilityNote('');setError('')}} min={catalog.today} max={addDateDays(catalog.today,catalog.horizon_days)} className={studioInput}/></Field><p className="text-xs text-zinc-500 mt-3">All session times are shown in {catalog.timezone}. {manual?'Choose an available studio time.':`${catalog.notice_hours} hours’ advance notice.`}</p><div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-5">{slots.map(slot=><button key={slot} disabled={busy} onClick={()=>setSelected(slot)} aria-pressed={selected===slot} className={`rounded-xl py-3 px-2 text-sm font-semibold border ${selected===slot?'bg-[#FF5500] text-white border-orange-500':'border-white/10 text-zinc-400 hover:text-white hover:border-orange-500/30'}`}>{bookingDate(slot,catalog.timezone,true)}</button>)}</div>{loading?<p role="status" className="text-sm text-zinc-500 mt-5">Finding available times…</p>:!slots.length&&<p className="text-sm text-zinc-500 mt-5">{day ? 'No available times on this date. Try another date or service, or contact the producer from their profile.' : 'Choose a session date to see available times.'}</p>}{!loading&&validBookingDay(day)&&day<addDateDays(catalog.today,catalog.horizon_days)&&<button type="button" disabled={busy||searching} onClick={findNextDay} className="text-sm font-bold text-orange-400 mt-4 disabled:opacity-40">{searching?'Checking the next 7 days…':'Find next available day'}</button>}{availabilityNote&&<p role="status" className="text-sm text-zinc-400 mt-3">{availabilityNote}</p>}</section>
   <form onSubmit={submit} className="rounded-2xl bg-[#111] border border-white/10 p-5 md:p-6 space-y-4"><h2 className="text-lg font-bold"><span className="text-orange-400 mr-3">03</span>{manual?'Add the artist':'Tell the producer about your session'}</h2>{manual&&<Field label="Artist’s BeatToday handle"><input name="artist_handle" required maxLength={100} className={studioInput} placeholder="@artist" autoCapitalize="none"/></Field>}<Field label="Session notes"><textarea name="notes" value={notes} onChange={e=>setNotes(e.target.value)} required minLength={10} maxLength={3000} rows={4} className={studioInput} placeholder="What are you working on? Include the number of songs, session goals and any preparation needs."/></Field>
    <p className="text-xs text-zinc-500 leading-relaxed">{manual?'The time will be reserved while you prepare the agreement. The artist’s acceptance confirms the session.':'Sending a request does not hold the time. The producer reserves it before you confirm an agreement together. No payment is taken here.'}</p>
    {!signedIn?<Link onClick={rememberDraft} className={studioButton} href={`/login?redirect=${encodeURIComponent('/studio/'+catalog.handle)}`}>Sign in to request a session<ArrowRight className="w-4 h-4"/></Link>:owner&&!manual?<Link className={studioButton} href="/dashboard/studio">Manage studio calendar</Link>:<button disabled={busy||loading||searching||!selected||!service||!slots.includes(selected)} className={studioButton}>{busy?'Saving…':manual?'Reserve & prepare agreement':'Request session'}<ArrowRight className="w-4 h-4"/></button>}
   </form>
  </div><aside className="rounded-2xl bg-[#111] border border-white/10 p-6 lg:sticky lg:top-6"><CalendarDays className="w-5 h-5 text-orange-400 mb-5"/><h2 className="font-bold">Your session</h2><div className="mt-5 space-y-4 text-sm"><p className="text-zinc-300 font-bold">{service?.title||'Choose a service'}</p><p className="text-xs text-zinc-500 flex gap-2 items-center"><Clock3 className="w-3.5 h-3.5"/>{service?`${service.duration_minutes} minutes · ${service.room_name}`:'Select a duration'}</p><p className="text-zinc-400">{selected?bookingDate(selected,catalog.timezone):'Choose an available time'}</p><div className="flex justify-between border-t border-white/10 pt-5"><span className="text-zinc-500">Service quote</span><strong>{service?studioMoney(service.price_minor):'—'}</strong></div><p className="text-xs text-zinc-600 leading-relaxed">Final scope, price, payment and cancellation terms are confirmed in your agreement. No charge is made by this request.</p></div></aside></div>
 </div>
}
