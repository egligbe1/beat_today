'use client'
import {useEffect,useState,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
import {Field,studioButton,studioInput} from './StudioHome'

export default function CustomServiceRequest({producerId}:{producerId:string}) {
 const router=useRouter()
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [details,setDetails]=useState(''),[schedule,setSchedule]=useState(''),[budget,setBudget]=useState('')
 const key='custom-studio-request:'+producerId
 useEffect(()=>{try{
  const draft=JSON.parse(sessionStorage.getItem(key)||'null')
  if(draft&&Date.now()-draft.savedAt<86400000){setDetails(String(draft.details||'').slice(0,3000));setSchedule(String(draft.schedule||'').slice(0,200));setBudget(String(draft.budget||'').slice(0,100));setOpen(true)}
 }catch{}},[key])
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return
  setBusy(true);setError('')
  try{
   const {data:{user},error:authError}=await createClient().auth.getUser()
   if(!user){
    if(authError&&authError.name!=='AuthSessionMissingError')throw new Error('Sign-in could not be checked. Please try again.')
    try{sessionStorage.setItem(key,JSON.stringify({details,schedule,budget,savedAt:Date.now()}))}catch{}
    router.push('/login?redirect='+encodeURIComponent(window.location.pathname+window.location.search+'#custom-service'));return
   }
   if(user.id===producerId)throw new Error('Open your studio dashboard to manage your services.')
   const content=['Custom studio service request',details.trim(),schedule.trim()?'Preferred schedule: '+schedule.trim():'',budget.trim()?'Budget / currency: '+budget.trim():'','Please discuss scope and availability with me. This is an enquiry, not a confirmed booking.'].filter(Boolean).join('\n\n')
   const response=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient_id:producerId,content})})
   const result=await response.json()
   if(!response.ok||!result.conversation_id)throw new Error(result.error||'Your custom request could not be sent.')
   try{sessionStorage.removeItem(key)}catch{}
   router.push('/messages/'+result.conversation_id)
  }catch(error){setError(error instanceof Error?error.message:'Your request could not be sent. Please try again.')}
  finally{setBusy(false)}
 }
 return <section id="custom-service" className="rounded-2xl border border-white/10 p-5 mt-6 scroll-mt-24">
  <h3 className="font-bold">Need a different studio service?</h3>
  <p className="text-sm text-zinc-400 mt-2">Describe your project and discuss a custom service directly with the producer.</p>
  {!open?<button type="button" onClick={()=>setOpen(true)} className="mt-4 text-sm font-bold text-orange-400">Request a custom service →</button>:<form onSubmit={submit} className="mt-5 space-y-4">
   <Field label="What would you like the producer to do?"><textarea required minLength={20} maxLength={3000} rows={4} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Describe your songs, the work you need and expected deliverables…" className={studioInput}/></Field>
   <Field label="Preferred dates or deadline (optional)"><input value={schedule} maxLength={200} onChange={e=>setSchedule(e.target.value)} className={studioInput} placeholder="Include your timezone if you have a preferred session date."/></Field>
   <Field label="Budget and currency (optional)"><input value={budget} maxLength={100} onChange={e=>setBudget(e.target.value)} className={studioInput} placeholder="For example, GHS 500–800"/></Field>
   <p className="text-xs text-zinc-500">This sends your brief to the producer in Messages. It does not reserve time or take payment. Confirm the final scope and price in your agreement.</p>
   {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
   <div className="flex flex-wrap gap-4 items-center"><button disabled={busy} className={studioButton}>{busy?'Sending…':'Send custom request'}</button><button type="button" disabled={busy} onClick={()=>{setOpen(false);try{sessionStorage.removeItem(key)}catch{}}} className="text-sm text-zinc-400">Cancel</button></div>
  </form>}
 </section>
}
