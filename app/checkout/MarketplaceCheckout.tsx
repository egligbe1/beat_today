'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {ArrowRight,Mail,ShieldCheck,ShoppingBag} from 'lucide-react'
import {useCartStore} from '@/lib/stores/cartStore'
import {useCurrency} from '@/lib/providers/CurrencyProvider'
export default function MarketplaceCheckout({signedIn,email,promo}:{signedIn:boolean;email:string;promo:string}){
 const {items,removeItem,getTotal}=useCartStore(),{convertAndFormat}=useCurrency()
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [name,setName]=useState(''),[deliveryEmail,setEmail]=useState(''),[code,setCode]=useState(promo)
 useEffect(()=>setReady(true),[])
 if(!ready)return <p className="p-10 text-zinc-400">Loading your checkout…</p>
 if(!items.length)return <div className="max-w-xl mx-auto px-5 py-20 text-center"><ShoppingBag className="w-10 h-10 mx-auto text-orange-400"/><h1 className="text-3xl font-bold mt-5">Your cart is empty</h1><p className="text-zinc-400 mt-3">Choose a beat and license to get started.</p><Link href="/search" className="inline-block text-orange-400 mt-6">Find your next beat →</Link></div>
 return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20"><header className="mb-9"><p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Your next release starts here</p><h1 className="text-4xl font-black mt-4">Complete your purchase</h1><p className="text-zinc-400 mt-3">{signedIn?'Your licenses will be saved in your library and emailed to you.':'No account needed. Your license and secure downloads will be delivered by email.'}</p></header><div className="grid lg:grid-cols-[1fr_380px] gap-7 items-start">
  <section className="rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-7"><h2 className="font-bold text-lg">Your licenses</h2><div className="divide-y divide-white/10">{items.map(item=><article key={item.beat_id} className="py-5 flex gap-4"><div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-zinc-900">{item.cover_url&&<Image src={item.cover_url} alt="" fill sizes="64px" className="object-cover"/>}</div><div className="min-w-0 flex-1"><h3 className="font-bold truncate">{item.title}</h3><p className="text-xs text-zinc-400 mt-1">{item.producer_name} · {item.license_type.toUpperCase()} license</p><button type="button" disabled={busy} onClick={()=>removeItem(item.beat_id)} className="text-xs text-zinc-500 underline mt-3">Remove</button></div><p className="font-bold text-sm">{convertAndFormat(item.price)}</p></article>)}</div><p className="text-xs text-zinc-500">Your selected license controls how you may use the beat. Studio services are booked separately.</p></section>
  <form className="rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-7 space-y-5" onSubmit={async event=>{
   event.preventDefault();if(busy)return;setBusy(true);setError('')
   try{
    const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items.map(item=>({beat_id:item.beat_id,license_type:item.license_type})),promo_code:code.trim()||undefined,...(!signedIn?{guest:{name,email:deliveryEmail,accepted_terms:new FormData(event.currentTarget).get('terms')==='on'}}:{})})})
    const result=await response.json();if(!response.ok||!result.url)throw new Error(result.error||'Checkout could not be started')
    window.location.assign(result.url)
   }catch(error){setError(error instanceof Error?error.message:'Please try again');setBusy(false)}
  }}>
   <h2 className="font-bold text-lg flex items-center gap-2"><Mail className="w-5 h-5 text-orange-400"/>License delivery</h2>
   {signedIn?<p className="text-sm text-zinc-300 break-all">{email}</p>:<><label className="block text-sm text-zinc-300">Full name for the license<input autoComplete="name" required minLength={2} maxLength={150} value={name} onChange={event=>setName(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm"/></label><label className="block text-sm text-zinc-300">Delivery email<input autoComplete="email" type="email" required maxLength={254} value={deliveryEmail} onChange={event=>setEmail(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm"/></label><p className="text-xs text-zinc-500">Double-check your email. We’ll send your license and a private link to your files there.</p><p className="text-sm text-zinc-400">Already have an account? <Link href="/login?redirect=%2Fcheckout" className="text-orange-400">Sign in for your library</Link></p></>}
   <label className="block text-sm text-zinc-300">Promo code <span className="text-zinc-500">(optional)</span><input value={code} onChange={event=>setCode(event.target.value.toUpperCase())} maxLength={80} disabled={busy} className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-sm"/></label>
   <div className="border-t border-white/10 pt-5 flex justify-between items-center"><span className="text-sm text-zinc-400">Subtotal</span><strong className="text-2xl">{convertAndFormat(getTotal())}</strong></div><p className="text-xs text-zinc-500">Any valid promotion is applied at checkout. Paystack shows the final amount in GHS before you pay.</p>
   {!signedIn&&<label className="flex gap-3 items-start text-xs text-zinc-400 leading-relaxed"><input type="checkbox" name="terms" required disabled={busy} className="mt-1 accent-orange-500"/><span>I accept the <Link href="/terms" target="_blank" className="underline">terms</Link> and the conditions of my selected <Link href="/licensing" target="_blank" className="underline">license</Link>. I confirm the name and email above are correct.</span></label>}
   {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}<button disabled={busy} className="flex gap-2 items-center justify-center w-full py-4 rounded-full bg-orange-500 font-bold disabled:opacity-50">{busy?'Preparing secure checkout…':'Continue to payment'}<ArrowRight className="w-4 h-4"/></button><p className="flex items-center justify-center gap-2 text-xs text-zinc-500"><ShieldCheck className="w-4 h-4"/>Payment securely processed by Paystack</p>
   {!signedIn&&<p className="text-xs text-zinc-500 text-center">You can create an account after payment to keep purchases together and collaborate with producers.</p>}
  </form>
 </div></div>
}
