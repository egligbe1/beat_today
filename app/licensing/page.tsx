import Link from 'next/link'
import { Check, X, Shield, Music, FileText, Mic2 } from 'lucide-react'

export const metadata = {
  title: 'Beat License Info — BeatToday',
  description: 'Understand beat licenses on BeatToday. Learn what each license type allows.',
}

const LICENSE_TYPES = [
  {
    name: 'Basic',
    subtitle: 'MP3 License',
    icon: Music,
    iconColor: 'text-text-muted',
    iconBg: 'bg-white/5',
    border: 'border-white/10',
    description: 'Great for independent releases, mixtapes, and projects with limited distribution.',
    rights: [
      { text: 'Non-exclusive use (beat stays on sale)', included: true },
      { text: 'MP3 audio file (320kbps)', included: true },
      { text: 'Up to 100,000 audio streams', included: true },
      { text: 'Up to 10,000 paid digital sales', included: true },
      { text: 'Up to 1 music video (YouTube/socials)', included: true },
      { text: 'Non-profit live performances', included: true },
      { text: 'WAV audio file', included: false },
      { text: 'Stem/Trackout files', included: false },
      { text: 'Radio broadcast rights', included: false },
      { text: 'Full commercial rights', included: false },
    ],
    credit: 'Prod. by [Producer Name]',
    note: 'The beat may be licensed to other artists simultaneously.'
  },
  {
    name: 'Premium',
    subtitle: 'WAV License',
    icon: FileText,
    iconColor: 'text-accent-gold',
    iconBg: 'bg-accent-gold/10',
    border: 'border-accent-gold/30',
    description: 'For serious releases on major streaming platforms and commercial distribution.',
    rights: [
      { text: 'Non-exclusive use (beat stays on sale)', included: true },
      { text: 'High-quality WAV audio file (24-bit)', included: true },
      { text: 'Unlimited audio streams', included: true },
      { text: 'Up to 50,000 paid digital sales', included: true },
      { text: 'Unlimited music videos', included: true },
      { text: 'Radio broadcast rights', included: true },
      { text: 'Paid live performances', included: true },
      { text: 'Stem/Trackout files', included: false },
      { text: 'Exclusive rights', included: false },
      { text: 'Full copyright transfer', included: false },
    ],
    credit: 'Prod. by [Producer Name]',
    note: 'The beat may be licensed to other artists simultaneously.'
  },
  {
    name: 'Trackout',
    subtitle: 'Stems License',
    icon: Mic2,
    iconColor: 'text-accent-orange',
    iconBg: 'bg-accent-orange/10',
    border: 'border-accent-orange/30',
    description: 'Full studio flexibility — get every individual track for a clean professional mix.',
    rights: [
      { text: 'Non-exclusive use (beat stays on sale)', included: true },
      { text: 'WAV audio file (24-bit)', included: true },
      { text: 'All individual stem/trackout files', included: true },
      { text: 'Unlimited audio streams', included: true },
      { text: 'Unlimited paid digital sales', included: true },
      { text: 'Unlimited music videos', included: true },
      { text: 'Radio broadcast rights', included: true },
      { text: 'Paid live performances', included: true },
      { text: 'Professional mixing session use', included: true },
      { text: 'Exclusive rights', included: false },
    ],
    credit: 'Prod. by [Producer Name]',
    note: 'The beat may be licensed to other artists simultaneously. Stems give you full mixing control.'
  },
  {
    name: 'Exclusive',
    subtitle: 'Full Ownership',
    icon: Shield,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-400/10',
    border: 'border-purple-400/30',
    description: 'The beat is yours alone. It\'s removed from sale permanently after your purchase.',
    rights: [
      { text: 'Exclusive ownership (beat removed from marketplace)', included: true },
      { text: 'WAV + Stems/Trackout files', included: true },
      { text: 'Unlimited streams, sales, and distribution', included: true },
      { text: 'Unlimited music videos', included: true },
      { text: 'Full radio and sync licensing rights', included: true },
      { text: 'TV, film, and commercial placements', included: true },
      { text: 'Full commercial rights', included: true },
      { text: 'No other artist can use this beat', included: true },
      { text: 'Copyright transfer (negotiated separately)', included: false },
      { text: 'Producer waives songwriting credit', included: false },
    ],
    credit: 'Prod. by [Producer Name] (unless waived)',
    note: 'Once purchased exclusively, the beat is permanently removed from BeatToday. Producer retains songwriting/composition royalties unless a separate copyright transfer agreement is signed.'
  },
]

const FAQS = [
  {
    q: 'Do I own the beat after I buy it?',
    a: 'No — you own a license to use the beat. The producer retains copyright of the composition and melody. With an Exclusive license, you get full commercial rights but the producer typically still holds songwriting credits for performance royalties (PRO/ASCAP/BMI).'
  },
  {
    q: 'What happens if another artist buys the same beat?',
    a: 'With Basic, Premium, or Trackout licenses, the beat is non-exclusive — multiple artists can license the same beat. This is standard practice in the beat industry. Only an Exclusive purchase removes the beat from sale.'
  },
  {
    q: 'Do I need to credit the producer?',
    a: 'Yes. All licenses require you to credit the producer as "Prod. by [Producer Name]" in streaming metadata, YouTube descriptions, and where commercially practical. Failure to credit may violate your license terms.'
  },
  {
    q: 'Can I use a beat for a YouTube video without buying a license?',
    a: 'No. Streaming a beat on YouTube without a license violates the producer\'s copyright. Your video can be claimed or taken down. Always purchase at least a Basic license before releasing publicly.'
  },
  {
    q: 'What is a stem / trackout file?',
    a: 'Stems (also called trackouts) are the individual audio layers of a beat — kick, snare, hi-hats, melody, bass, etc. — as separate WAV files. This lets your mixing engineer work with each element independently for a cleaner, more professional mix.'
  },
  {
    q: 'Can I negotiate a custom license?',
    a: 'Yes. If you need sync rights, a TV placement, or terms not covered by standard licenses, contact the producer directly or reach out to us at support@beattoday.com. Producers on STARTER and PRO plans can also create custom license templates.'
  },
  {
    q: 'What happens if I exceed my stream/sales limits?',
    a: 'You should upgrade to a higher license tier before exceeding your limits. Exceeding the limits puts you in breach of your license agreement. Contact the producer to negotiate an upgrade — most are happy to accommodate growing artists.'
  },
]

export default function LicensingPage() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center space-y-5 mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-text-muted">
            <Shield className="w-3.5 h-3.5" />
            License Information
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white">Beat License Types</h1>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Understand exactly what rights you get with each license before you buy.
          </p>
        </div>

        {/* License Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {LICENSE_TYPES.map((license) => {
            const Icon = license.icon
            return (
              <div key={license.name} className={`bg-bg-surface border ${license.border} rounded-3xl p-8 flex flex-col gap-5`}>
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl ${license.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${license.iconColor}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{license.name}</h2>
                    <div className="text-xs font-black uppercase tracking-widest text-text-muted">{license.subtitle}</div>
                  </div>
                </div>

                <p className="text-text-muted text-sm">{license.description}</p>

                <ul className="space-y-2.5">
                  {license.rights.map((right) => (
                    <li key={right.text} className="flex items-start gap-2.5 text-sm">
                      {right.included ? (
                        <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-green-400" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X className="w-3 h-3 text-text-muted/40" />
                        </div>
                      )}
                      <span className={right.included ? 'text-text-primary' : 'text-text-muted/50'}>
                        {right.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="bg-white/5 rounded-xl px-4 py-3 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-muted">Required Credit</div>
                  <div className="text-sm font-bold text-white font-mono">{license.credit}</div>
                </div>

                <p className="text-xs text-text-muted/70 italic">{license.note}</p>
              </div>
            )
          })}
        </div>

        {/* Comparison Note */}
        <div className="bg-bg-surface border border-white/5 rounded-3xl p-8 mb-16 text-center">
          <h3 className="text-xl font-black text-white mb-3">Not Sure Which License to Choose?</h3>
          <p className="text-text-muted text-sm max-w-2xl mx-auto mb-6">
            For most independent releases, <strong className="text-accent-gold">Premium (WAV)</strong> is the best balance of quality, rights, and cost. Choose <strong className="text-accent-orange">Exclusive</strong> only if this is a flagship single or if you need to prevent other artists from using the same sound.
          </p>
          <Link href="/search" className="inline-flex items-center justify-center h-11 px-8 bg-accent-orange text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-accent-orange/90 transition-all shadow-[0_10px_20px_rgba(255,85,0,0.2)]">
            Browse Beats
          </Link>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-black text-white mb-8 text-center uppercase tracking-widest">License FAQ</h2>
          <div className="space-y-5">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-bg-surface border border-white/5 rounded-2xl p-6">
                <h3 className="font-black text-white mb-2">{faq.q}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-16 pt-10 border-t border-white/5 flex flex-wrap gap-4 text-xs text-text-muted">
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <a href="mailto:support@beattoday.com" className="hover:text-white transition-colors">Contact Support</a>
        </div>
      </div>
    </div>
  )
}
