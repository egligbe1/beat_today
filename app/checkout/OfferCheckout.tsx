'use client'
import {useState} from 'react'
export default function OfferCheckout({offer}:{offer:any}) {
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function pay() {
    setBusy(true)
    try {
      const res=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offer_id:offer.id,items:[{beat_id:offer.beat_id,license_type:offer.license_type}]})})
      const data=await res.json()
      if(!res.ok||!data.url)throw new Error(data.error||'Checkout unavailable')
      window.location.assign(data.url)
    }catch(e){setError((e as Error).message);setBusy(false)}
  }
  return <div className="max-w-xl mx-auto p-8 space-y-5"><h1>Accepted offer</h1><p>${offer.amount} · {offer.license_type}</p><button disabled={busy} onClick={pay}>Continue to payment</button>{error&&<p role="alert">{error}</p>}</div>
}
