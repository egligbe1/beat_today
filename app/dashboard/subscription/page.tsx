import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Check, Zap, Crown, Sparkles, CheckCircle2 } from 'lucide-react'
import UpgradeButton from './UpgradeButton'

const TIERS = [
  {
    name: 'FREE',
    price: '$0',
    period: 'forever',
    description: 'Get started with BeatToday',
    color: 'border-border-subtle',
    badge: null,
    features: [
      'Upload up to 20 beats',
      'MP3 uploads only',
      '20% platform fee per sale',
      'Basic producer profile (no badge)',
      'Standard license terms only',
      'Community support',
    ],
    cta: null,
  },
  {
    name: 'STARTER',
    price: '$9.99',
    period: 'per year',
    description: 'For producers building their brand',
    color: 'border-accent-gold/40',
    badge: { text: 'Popular', color: 'bg-accent-gold text-black' },
    features: [
      'Upload up to 100 beats',
      'MP3 + WAV uploads',
      '10% platform fee per sale',
      'Custom license templates',
      'Promo codes & discounts',
      'Full sales analytics dashboard',
      'Priority placement in search',
      'Email support',
    ],
    cta: 'STARTER',
  },
  {
    name: 'PRO',
    price: '$59.99',
    period: 'per year',
    description: 'For serious producers',
    color: 'border-accent-orange/40',
    badge: { text: 'Best Value', color: 'bg-accent-orange text-white' },
    features: [
      'Unlimited beat uploads',
      'MP3 + WAV + Stems (trackouts)',
      '0% platform fee — keep 100%',
      'Featured in homepage producer showcase',
      'Verified PRO badge on profile',
      'Boosted in charts & trending',
      'Top placement in search results',
      'Priority support',
      'Early access to new features',
    ],
    cta: 'PRO',
  },
]

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: { subscription?: string; error?: string; tier?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'producer') redirect('/dashboard/unauthorized')

  const { data: settings } = await supabase
    .from('producer_settings')
    .select('subscription_tier, subscription_expires_at')
    .eq('user_id', user.id)
    .single()

  const currentTier = (settings?.subscription_tier || 'FREE').toUpperCase()
  const expiresAt = settings?.subscription_expires_at
    ? new Date(settings.subscription_expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
      {searchParams.subscription === 'success' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-white">Upgrade successful! Welcome to {searchParams.tier}.</p>
            {expiresAt && <p className="text-xs text-text-muted mt-0.5">Your subscription renews on {expiresAt}.</p>}
          </div>
        </div>
      )}
      {searchParams.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm font-bold">
          Payment could not be processed ({searchParams.error.replace(/_/g, ' ')}). Please try again or contact support.
        </div>
      )}
      {currentTier !== 'FREE' && expiresAt && !searchParams.subscription && (
        <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-2xl p-4 text-sm text-text-muted">
          <span className="text-accent-gold font-bold">{currentTier}</span> plan — active until <span className="text-white font-bold">{expiresAt}</span>
        </div>
      )}

      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-accent-orange/10 border border-accent-orange/20 rounded-full px-4 py-2">
          <Sparkles className="w-4 h-4 text-accent-orange" />
          <span className="text-xs font-black uppercase tracking-widest text-accent-orange">Upgrade Your Store</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">Choose Your Plan</h1>
        <p className="text-text-muted max-w-lg mx-auto">The lower your platform fee, the more you keep. Upgrade to unlock maximum earnings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map(tier => {
          const isActive = currentTier === tier.name
          const isDowngrade = (
            (currentTier === 'PRO' && tier.name !== 'PRO') ||
            (currentTier === 'STARTER' && tier.name === 'FREE')
          )

          return (
            <div
              key={tier.name}
              className={`relative bg-bg-surface rounded-2xl sm:rounded-[32px] border-2 ${tier.color} p-5 sm:p-8 space-y-5 sm:space-y-6 flex flex-col ${isActive ? 'ring-2 ring-accent-orange ring-offset-2 ring-offset-bg-primary' : ''}`}
            >
              {tier.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tier.badge.color}`}>
                  {tier.badge.text}
                </div>
              )}

              <div>
                {tier.name === 'FREE' && <Zap className="w-6 h-6 text-text-muted mb-3" />}
                {tier.name === 'STARTER' && <Crown className="w-6 h-6 text-accent-gold mb-3" />}
                {tier.name === 'PRO' && <Sparkles className="w-6 h-6 text-accent-orange mb-3" />}
                <h2 className="text-2xl font-black text-white">{tier.name}</h2>
                <p className="text-text-muted text-sm mt-1">{tier.description}</p>
              </div>

              <div>
                <span className="text-4xl font-black text-white">{tier.price}</span>
                <span className="text-text-muted text-sm ml-2">/ {tier.period}</span>
              </div>

              <ul className="space-y-3 flex-1">
                {tier.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <Check className="w-4 h-4 text-accent-orange flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div>
                {isActive ? (
                  <div className="w-full h-12 rounded-2xl bg-accent-orange/10 border border-accent-orange/20 text-accent-orange font-black text-sm uppercase tracking-widest flex items-center justify-center">
                    Current Plan
                  </div>
                ) : tier.cta ? (
                  <UpgradeButton tier={tier.cta} isDowngrade={isDowngrade} />
                ) : (
                  <div className="w-full h-12 rounded-2xl bg-white/5 text-text-muted font-black text-sm uppercase tracking-widest flex items-center justify-center">
                    Downgrade
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-bg-surface rounded-2xl sm:rounded-3xl border border-border-subtle p-5 sm:p-8 text-center space-y-3">
        <h3 className="font-bold text-white">How Platform Fees Work</h3>
        <p className="text-sm text-text-muted max-w-2xl mx-auto">
          When you sell a beat, BeatToday takes a small cut. On <strong className="text-white">FREE</strong> that&apos;s 20%, on <strong className="text-accent-gold">STARTER</strong> it&apos;s 10%, and on <strong className="text-accent-orange">PRO</strong> it&apos;s 0% — you keep every cent.
          Subscriptions are billed annually and can be cancelled anytime.
        </p>
      </div>
    </div>
  )
}
