import { Check, X, Shield, Zap, Crown, Sparkles, RefreshCw } from 'lucide-react'
import Link from 'next/link'

const TIERS = [
  {
    name: 'FREE',
    description: 'Get started with BeatToday at zero cost.',
    price: '$0',
    period: 'forever',
    icon: Zap,
    iconColor: 'text-text-muted',
    border: 'border-white/10',
    badge: null,
    features: [
      { text: 'Upload up to 20 beats', included: true },
      { text: 'MP3 uploads only', included: true },
      { text: '20% platform fee per sale', included: true },
      { text: 'Basic producer profile', included: true },
      { text: 'Community support', included: true },
      { text: 'WAV / Stem uploads', included: false },
      { text: 'Custom license templates', included: false },
      { text: 'Promo codes & discounts', included: false },
      { text: 'Sales analytics dashboard', included: false },
      { text: 'Priority placement in search', included: false },
      { text: 'Verified PRO badge', included: false },
    ],
    cta: 'Start for Free',
    ctaHref: '/signup?role=producer',
    ctaStyle: 'bg-white/5 text-white hover:bg-white/10 border border-white/10',
    recommended: false,
  },
  {
    name: 'STARTER',
    description: 'For producers building a serious beat business.',
    price: '$9.99',
    period: 'per year',
    icon: Crown,
    iconColor: 'text-accent-gold',
    border: 'border-accent-gold/40',
    badge: { text: 'Most Popular', color: 'bg-accent-gold text-black' },
    features: [
      { text: 'Upload up to 100 beats', included: true },
      { text: 'MP3 + WAV uploads', included: true },
      { text: '10% platform fee per sale', included: true },
      { text: 'Custom license templates', included: true },
      { text: 'Promo codes & discounts', included: true },
      { text: 'Full sales analytics dashboard', included: true },
      { text: 'Priority placement in search', included: true },
      { text: 'Email support', included: true },
      { text: 'Stem / Trackout uploads', included: false },
      { text: 'Homepage producer showcase', included: false },
      { text: 'Verified PRO badge', included: false },
    ],
    cta: 'Get Starter',
    ctaHref: '/signup?role=producer',
    ctaStyle: 'bg-accent-gold text-black hover:bg-accent-gold/90 shadow-[0_10px_20px_rgba(255,176,0,0.2)]',
    recommended: true,
  },
  {
    name: 'PRO',
    description: 'For serious producers who want maximum earnings.',
    price: '$59.99',
    period: 'per year',
    icon: Sparkles,
    iconColor: 'text-accent-orange',
    border: 'border-accent-orange/40',
    badge: { text: 'Best Value', color: 'bg-accent-orange text-white' },
    features: [
      { text: 'Unlimited beat uploads', included: true },
      { text: 'MP3 + WAV + Stems (trackouts)', included: true },
      { text: '0% platform fee — keep 100%', included: true },
      { text: 'Custom license templates', included: true },
      { text: 'Promo codes & discounts', included: true },
      { text: 'Full sales analytics dashboard', included: true },
      { text: 'Top placement in search results', included: true },
      { text: 'Featured in homepage showcase', included: true },
      { text: 'Verified PRO badge on profile', included: true },
      { text: 'Boosted in charts & trending', included: true },
      { text: 'Priority support + early access', included: true },
    ],
    cta: 'Go Pro',
    ctaHref: '/signup?role=producer',
    ctaStyle: 'bg-accent-orange text-white hover:bg-accent-orange/90 shadow-[0_10px_20px_rgba(255,85,0,0.2)]',
    recommended: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 text-center space-y-6 mb-20">
        <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold backdrop-blur-3xl mx-auto">
          <Shield className="w-4 h-4" />
          Clear, Transparent Pricing
        </div>
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white max-w-4xl mx-auto leading-tight">
          Keep more of<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5500] to-[#FFB000]">what you earn.</span>
        </h1>
        <p className="text-text-muted text-lg font-medium max-w-2xl mx-auto">
          The lower your platform fee, the more you keep. Upgrade once a year — no surprises.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {TIERS.map((tier) => {
          const Icon = tier.icon
          return (
            <div
              key={tier.name}
              className={`relative bg-bg-surface border-2 ${tier.border} rounded-[32px] p-8 flex flex-col gap-6 ${tier.recommended ? 'ring-2 ring-accent-orange ring-offset-2 ring-offset-bg-primary scale-[1.03] z-10' : ''}`}
            >
              {tier.badge && (
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${tier.badge.color}`}>
                  {tier.badge.text}
                </div>
              )}

              <div>
                <Icon className={`w-6 h-6 ${tier.iconColor} mb-3`} />
                <h2 className="text-2xl font-black text-white">{tier.name}</h2>
                <p className="text-text-muted text-sm mt-1">{tier.description}</p>
              </div>

              <div className="flex items-end gap-2">
                <span className="text-5xl font-black text-white">{tier.price}</span>
                <span className="text-text-muted text-sm mb-1">/ {tier.period}</span>
              </div>

              <ul className="space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2.5 text-sm">
                    {feature.included ? (
                      <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-400" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="w-3 h-3 text-text-muted/40" />
                      </div>
                    )}
                    <span className={feature.included ? 'text-text-primary font-medium' : 'text-text-muted/50'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`h-14 w-full rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center transition-all ${tier.ctaStyle}`}
              >
                {tier.cta}
              </Link>
            </div>
          )
        })}
      </div>

      {/* Fee Comparison Table */}
      <div className="max-w-4xl mx-auto px-6 mt-24">
        <div className="bg-bg-surface rounded-3xl border border-white/5 p-8">
          <h3 className="text-xl font-black text-white text-center mb-8 uppercase tracking-widest">How Platform Fees Work</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-4xl font-black text-text-muted">20%</div>
              <div className="text-xs font-black uppercase tracking-widest text-text-muted">FREE Plan</div>
              <div className="text-xs text-text-muted/60">We keep $20 on a $100 sale</div>
            </div>
            <div className="space-y-2 border-x border-white/5 px-4">
              <div className="text-4xl font-black text-accent-gold">10%</div>
              <div className="text-xs font-black uppercase tracking-widest text-accent-gold">STARTER Plan</div>
              <div className="text-xs text-text-muted/60">We keep $10 on a $100 sale</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-black text-accent-orange">0%</div>
              <div className="text-xs font-black uppercase tracking-widest text-accent-orange">PRO Plan</div>
              <div className="text-xs text-text-muted/60">You keep every cent</div>
            </div>
          </div>
          <p className="text-center text-sm text-text-muted mt-8 max-w-lg mx-auto">
            Platform fees apply to each beat sale. Subscriptions are billed annually. Cancel any time — your beats stay live until the period ends.
          </p>
        </div>
      </div>

      {/* Payout Banner */}
      <div className="max-w-4xl mx-auto px-6 mt-8">
        <div className="p-8 rounded-3xl bg-black/40 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h4 className="font-black uppercase tracking-widest text-white mb-2 flex items-center justify-center md:justify-start gap-2">
              <RefreshCw className="w-5 h-5 text-accent-gold" />
              Automatic Bi-Weekly Payouts
            </h4>
            <p className="text-sm text-text-muted max-w-md">
              Earnings are automatically deposited to your bank account on the 1st and 15th of every month. Supports Ghana, Nigeria, Kenya, South Africa, and more.
            </p>
          </div>
          <Link href="/signup?role=producer" className="px-8 h-12 rounded-full bg-white/5 text-white font-bold hover:bg-white/10 transition-colors flex items-center justify-center whitespace-nowrap border border-white/10">
            Start Selling
          </Link>
        </div>
      </div>
    </div>
  )
}
