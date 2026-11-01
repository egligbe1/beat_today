'use client'
import {useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
export default function PaymentCaseReview({caseId}:{caseId:string}){
 const router=useRouter(),requestId=useRef<string|null>(null)
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 if(!open)return <button onClick={()=>setOpen(true)} className="text-sm text-orange-400 font-bold">Record review & release hold</button>
 return <form className="space-y-4 mt-4" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('')
  const data=new FormData(event.currentTarget);requestId.current??=crypto.randomUUID()
  try{
   const response=await fetch('/api/operations/payment-cases/'+caseId+'/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:requestId.current,resolution:data.get('resolution'),note:data.get('note'),provider_checked:data.get('provider_checked')==='on',accounting_checked:data.get('accounting_checked')==='on'})})
   if(!response.ok)throw new Error((await response.json()).error||'Review could not be saved')
   setOpen(false);router.refresh()
  }catch(error){setError(error instanceof Error?error.message:'Please try again')}finally{setBusy(false)}
 }}>
  <p className="text-sm text-amber-300">Releasing this hold can allow scheduled payouts. Confirm the provider outcome and complete any necessary accounting adjustments first. This screen records your review; it does not refund a customer or adjust balances.</p>
  <label className="block text-sm">Review outcome<select name="resolution" required className="block mt-2 p-3 rounded-lg bg-zinc-900 border border-white/10 w-full"><option value="NO_FINANCIAL_LOSS">No financial loss confirmed</option><option value="ACCOUNTING_REVIEW_COMPLETED">Required accounting review completed</option><option value="UNRELATED_PAYMENT">Unrelated to BeatToday</option></select></label>
  <label className="block text-sm">Evidence and action taken<textarea name="note" required minLength={20} maxLength={1000} rows={3} className="block mt-2 p-3 rounded-lg bg-zinc-900 border border-white/10 w-full" placeholder="Record the provider confirmation reference and the review or adjustments completed."/></label>
  <label className="flex gap-2 text-sm"><input required type="checkbox" name="provider_checked"/>I checked the provider outcome and supporting evidence.</label>
  <label className="flex gap-2 text-sm"><input required type="checkbox" name="accounting_checked"/>I verified the earnings/ledger treatment and that it is safe to release this hold.</label>
  {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  <div className="flex gap-4"><button disabled={busy} className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-sm disabled:opacity-50">{busy?'Recording…':'Confirm review & release hold'}</button><button disabled={busy} type="button" onClick={()=>setOpen(false)} className="text-sm text-zinc-400">Keep hold</button></div>
 </form>
}
