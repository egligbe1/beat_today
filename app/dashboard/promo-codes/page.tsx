import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Tag, Lock } from 'lucide-react'
import PromoCodeManager from './PromoCodeManager'
import Link from 'next/link'

export default async function PromoCodesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'producer') redirect('/dashboard/unauthorized')

  const { data: settings } = await supabase
    .from('producer_settings')
    .select('subscription_tier')
    .eq('user_id', user.id)
    .single()

  const tier = (settings?.subscription_tier || 'free').toLowerCase()
  const canUsePromoCodes = tier === 'starter' || tier === 'pro'

  if (!canUsePromoCodes) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-accent-gold" />
        </div>
        <h1 className="text-3xl font-black text-white">Promo Codes</h1>
        <p className="text-text-muted">
          Create discount codes and run promotions to reward loyal buyers and drive more sales. Available on <strong className="text-accent-gold">STARTER</strong> and above.
        </p>
        <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-3 text-left">
          <p className="text-xs font-black uppercase tracking-widest text-text-muted">Unlock with STARTER</p>
          {['Percentage & fixed-amount discounts', 'Usage limits & expiry dates', 'Minimum order requirements', 'Apply per beat or storewide'].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
              {f}
            </div>
          ))}
        </div>
        <Link href="/dashboard/subscription" className="inline-flex h-12 px-8 bg-accent-orange text-white font-black rounded-2xl items-center justify-center hover:bg-accent-orange/90 transition-colors">
          Upgrade to STARTER — $9.99/yr
        </Link>
      </div>
    )
  }

  const { data: codes } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('producer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">Promo Codes</h1>
          <p className="text-text-muted text-sm mt-1">Create discount codes to drive sales and reward loyal buyers.</p>
        </div>
      </div>

      <PromoCodeManager codes={codes || []} />
    </div>
  )
}
