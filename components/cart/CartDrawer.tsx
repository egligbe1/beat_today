'use client'

import { useCartStore } from '@/lib/stores/cartStore'
import { X, Trash2, ShoppingBag, Tag, CheckCircle2, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/lib/providers/CurrencyProvider'

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, getTotal } = useCartStore()
  const { convertAndFormat } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_amount: number; label: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()
  
  // Close on esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    globalThis.addEventListener('keydown', handleEsc)
    return () => globalThis.removeEventListener('keydown', handleEsc)
  }, [setIsOpen])

  if (!isOpen) return null

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/promo?code=${encodeURIComponent(promoCode.trim())}&amount=${getTotal()}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setAppliedPromo({
        code: data.code,
        discount_amount: data.discount_amount,
        label: data.discount_type === 'percentage' ? `-${data.discount_value}%` : `-$${data.discount_value}`
      })
    } catch {
      setError('Failed to apply promo code')
    } finally {
      setPromoLoading(false)
    }
  }

  const finalTotal = Math.max(0, getTotal() - (appliedPromo?.discount_amount || 0))

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      setIsOpen(false)
      router.push('/login?redirect=checkout')
      return
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, promo_code: appliedPromo?.code, discount_amount: appliedPromo?.discount_amount })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize checkout')
      }
      
      if (data.url) {
        globalThis.location.href = data.url
      }
      
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-bg-surface/95 backdrop-blur-2xl border-l border-white/5 z-[101] flex flex-col animate-slide-left shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-accent-orange" />
            Your Cart <span className="text-text-muted">({items.length})</span>
          </h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 hover:text-accent-orange transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
               <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                   <ShoppingBag className="w-10 h-10 text-text-muted" />
               </div>
               <p className="text-text-muted font-bold text-lg tracking-tight">Your cart is empty.</p>
               <button onClick={() => setIsOpen(false)} className="h-12 px-8 bg-white/5 hover:bg-white/10 rounded-full text-white text-sm font-bold uppercase tracking-widest transition-colors">Find Beats</button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.beat_id} className="flex gap-4 p-4 rounded-3xl border border-white/5 bg-black/20 hover:bg-black/40 transition-colors group">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-bg-elevated flex-shrink-0 shadow-lg">
                  {item.cover_url && <Image src={item.cover_url} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                  <div>
                    <h4 className="font-bold text-lg leading-tight text-white truncate">{item.title}</h4>
                    <p className="text-sm text-text-muted mt-1">@{item.producer_name}</p>
                  </div>
                  <div className="flex items-end justify-between">
                     <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#FF5500] bg-[#FF5500]/10 px-2 py-1 rounded-md">
                            {item.license_type}
                        </span>
                        <p className="font-black text-xl mt-2">{convertAndFormat(item.price)}</p>
                     </div>
                     <button 
                        onClick={() => removeItem(item.beat_id)}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
            <div className="p-5 border-t border-white/5 bg-black/40 backdrop-blur-2xl space-y-4" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
               {error && <p className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-xl text-center">{error}</p>}

               {/* Promo code */}
               {!appliedPromo ? (
                 <div className="flex gap-2">
                   <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 focus-within:border-accent-orange transition-colors">
                     <Tag className="w-4 h-4 text-text-muted flex-shrink-0" />
                     <input
                       type="text"
                       value={promoCode}
                       onChange={e => setPromoCode(e.target.value.toUpperCase())}
                       onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                       placeholder="Promo code"
                       className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none py-2.5 font-mono"
                     />
                   </div>
                   <button
                     onClick={handleApplyPromo}
                     disabled={promoLoading || !promoCode.trim()}
                     className="px-4 h-11 bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-white hover:bg-white/20 transition-colors disabled:opacity-40"
                   >
                     {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                   </button>
                 </div>
               ) : (
                 <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                   <div className="flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4 text-green-500" />
                     <span className="text-sm font-bold text-green-400">{appliedPromo.code} ({appliedPromo.label})</span>
                   </div>
                   <button onClick={() => setAppliedPromo(null)} className="text-text-muted hover:text-white">
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               )}

               <div className="space-y-2">
                 <div className="flex items-center justify-between text-sm text-text-muted">
                   <span className="font-bold uppercase tracking-widest">Subtotal</span>
                   <span>{convertAndFormat(getTotal())}</span>
                 </div>
                 {appliedPromo && (
                   <div className="flex items-center justify-between text-sm">
                     <span className="font-bold uppercase tracking-widest text-green-400">Discount</span>
                     <span className="text-green-400 font-bold">-{convertAndFormat(appliedPromo.discount_amount)}</span>
                   </div>
                 )}
                 <div className="flex items-center justify-between pt-2 border-t border-white/5">
                   <span className="font-black text-text-muted uppercase tracking-widest text-sm">Total Due</span>
                   <span className="text-3xl font-black tracking-tighter text-white">{convertAndFormat(finalTotal)}</span>
                 </div>
               </div>

               <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full h-14 bg-[#FF5500] text-white rounded-full font-black uppercase tracking-widest text-base flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(255,85,0,0.3)] disabled:opacity-50"
               >
                 {loading ? 'Processing...' : 'Checkout Now'}
               </button>
               <p className="text-center text-[10px] text-text-muted font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse shadow-[0_0_10px_#00E676]" />
                  {' '}Secure 256-bit Encryption
               </p>
            </div>
        )}
      </div>
    </>
  )
}
