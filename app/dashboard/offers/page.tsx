'use client'
import { useEffect,useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
export default function OffersPage() {
  const { user } = useAuth()
  const [offers,setOffers]=useState<any[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [amount,setAmount]=useState<Record<string,string>>({})
  async function refresh() {
    const response=await fetch('/api/negotiations')
    const result=await response.json()
    if(!response.ok)throw new Error(result.error)
    setOffers(result.offers)
  }
  useEffect(()=>{refresh().catch(e=>setError(e.message))},[])
  async function change(id:string,status:string) {
    setBusy(true);setError('')
    try {
      const response=await fetch(`/api/negotiations/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,amount:status==='COUNTERED'?amount[id]:undefined})})
      if(!response.ok)throw new Error('This action is not available for your account or the current offer state.')
      await refresh()
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <section className="space-y-6"><h1 className="text-3xl font-bold">Offers</h1>
    {error&&<p role="alert">{error}</p>}
    {offers.map(offer=><article key={offer.id} className="rounded-2xl border border-white/10 p-5 space-y-3">
      <h2>{offer.beats?.title || 'Beat'} · {offer.license_type}</h2><p>${offer.amount} · {offer.status}</p>
      {offer.status==='ACCEPTED'&&offer.buyer_id===user?.id&&<Link href={`/checkout?offer_id=${offer.id}`}>Pay accepted offer</Link>}
      {['PENDING','COUNTERED'].includes(offer.status)&&(offer.producer_id===user?.id ? offer.last_actor_id!==user?.id : offer.status==='COUNTERED'&&offer.last_actor_id!==user?.id)&&<div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={()=>change(offer.id,'ACCEPTED')}>Accept</button>
        <button disabled={busy} onClick={()=>change(offer.id,'DECLINED')}>Decline</button>
        <input aria-label="Counter offer amount" type="number" min=".01" step=".01" value={amount[offer.id]||''} onChange={e=>setAmount({...amount,[offer.id]:e.target.value})}/>
        <button disabled={busy||!amount[offer.id]} onClick={()=>change(offer.id,'COUNTERED')}>Counter</button>
      </div>}
    </article>)}
    {!offers.length&&<p>No offers yet.</p>}
  </section>
}
