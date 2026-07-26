import Link from 'next/link'
import { BookOpen, TrendingUp, DollarSign, Share2, Music2, Tag, Users, Zap } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Producer Guides & Resources',
  description: 'Practical guides for music producers: how to price beats, grow your audience, license your work, and maximize revenue on BeatToday.',
  openGraph: {
    title: 'Producer Guides & Resources | BeatToday',
    description: 'Practical guides for music producers: pricing, audience growth, licensing, and revenue.',
  },
}

const GUIDES = [
  {
    icon: DollarSign,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-400/10',
    category: 'Pricing Strategy',
    title: 'How to Price Your Beats and Maximize Revenue',
    readTime: '5 min read',
    summary: 'Pricing your beats can make or break your business. Learn the tiered licensing model, how to set competitive prices, and when to offer exclusives.',
    body: [
      {
        heading: 'Use Tiered Licensing',
        text: 'Offer 3 tiers: Basic (MP3 only, limited streams/sales), Premium (WAV, higher limits), and Exclusive (full ownership transfer). This way, you capture buyers at every budget level. Typical ranges: Basic $15–$30, Premium $40–$75, Exclusive $200–$500+.'
      },
      {
        heading: 'Research Your Genre',
        text: 'Afrobeats, Amapiano, and Afro-drill have different market rates. Browse BeatToday charts to see what top producers in your genre are charging and position yourself just below until you build a track record.'
      },
      {
        heading: 'Never Price at $0 (Except Strategy)',
        text: 'Free beats can build an audience — use our "Make Free" feature to occasionally drop a freebie that drives traffic to your paid catalog. But make it a limited strategy, not your default.'
      },
      {
        heading: 'Raise Prices as You Grow',
        text: 'When a beat gets 100+ plays, consider raising its price. Scarcity and demand are your friends. A beat that\'s been played 500 times commands more than a new upload.'
      },
    ]
  },
  {
    icon: Share2,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-400/10',
    category: 'Marketing',
    title: 'Promoting Your Beats on Social Media',
    readTime: '7 min read',
    summary: 'Social media is your biggest free marketing channel. Here\'s a proven strategy for getting consistent plays, followers, and sales from Instagram, TikTok, and Twitter/X.',
    body: [
      {
        heading: 'Post Beat Previews as Reels/Shorts',
        text: 'Cut a 30–60 second clip of your best section. Add a waveform visualizer (CapCut, Adobe Express, or Canva). Post to Instagram Reels, TikTok, and YouTube Shorts simultaneously. One beat = 3 platforms.'
      },
      {
        heading: 'Use Genre-Specific Hashtags',
        text: 'Afrobeats: #afrobeats #afrobeatsinstrumental #afropop. Amapiano: #amapiano #pianogirls #amapianosa. Drill: #ukdrill #afrodrill #drillbeat. Mix 5 niche with 3 broad tags per post.'
      },
      {
        heading: 'Engage With Artists Actively',
        text: 'Comment on artist posts in your genre with value: "This vibe would match the beat I dropped last week." Don\'t spam links — build relationships. DM after 2–3 genuine interactions.'
      },
      {
        heading: 'Build an Email List',
        text: 'Offer a free beat pack to anyone who subscribes. Use free tools like Mailchimp or ConvertKit. Email subscribers convert 5–10x better than social followers. Even 100 emails can drive consistent sales.'
      },
      {
        heading: 'Post Consistently, Not Randomly',
        text: 'Algorithms reward consistency. Post 3–5 times a week minimum. Batch-create content on weekends. Use scheduling tools like Buffer or Later so you never miss a day even when you\'re busy in the studio.'
      },
    ]
  },
  {
    icon: TrendingUp,
    iconColor: 'text-accent-orange',
    iconBg: 'bg-accent-orange/10',
    category: 'Growth',
    title: 'Getting on the BeatToday Charts',
    readTime: '4 min read',
    summary: 'The BeatToday charts are the fastest way to get discovered. Here\'s exactly how the ranking algorithm works and what you can do to climb.',
    body: [
      {
        heading: 'How the Charts Algorithm Works',
        text: 'Chart position is driven by: (1) plays in the last 7 days, (2) favorites/saves, (3) purchases, and (4) your subscription tier. PRO producers get a boost multiplier — meaning equal plays will rank PRO producers higher.'
      },
      {
        heading: 'Release on High-Traffic Days',
        text: 'Thursday–Saturday are the highest-traffic days on music platforms globally. Release new beats Thursday afternoon (3–6pm West Africa Time) to catch the Friday/weekend traffic surge.'
      },
      {
        heading: 'Drive External Traffic to Your Profile',
        text: 'Every play counts. Link your BeatToday profile in your bio. When you share beats externally, link the BeatToday page directly — not a YouTube upload. External plays count toward charts.'
      },
      {
        heading: 'Upload Frequently',
        text: 'Producers who upload 2–4 beats per week consistently rank higher than producers who batch-upload 20 beats once a month. Fresh content gets more surface area in discovery.'
      },
    ]
  },
  {
    icon: Tag,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-400/10',
    category: 'Licensing',
    title: 'Understanding Beat Licenses — A Producer\'s Guide',
    readTime: '6 min read',
    summary: 'Confused about licenses? This guide breaks down every license type, what rights you keep, and how to protect your catalog from misuse.',
    body: [
      {
        heading: 'Basic / MP3 License',
        text: 'The buyer gets an MP3 to record over. Typically comes with a usage cap (e.g., 100k streams, 5k sales). You retain the copyright. The beat is NOT exclusive — you can sell it to multiple artists simultaneously.'
      },
      {
        heading: 'Premium / WAV License',
        text: 'Higher usage caps (e.g., 500k streams, 50k sales). Includes WAV files for better recording quality. Still non-exclusive — you keep all rights and can continue selling.'
      },
      {
        heading: 'Exclusive License',
        text: 'Once sold exclusively, the beat is taken off market. The buyer gets full commercial rights (radio, sync, distribution). You receive a one-time lump sum. This should be priced significantly higher — typically 10–20x your non-exclusive price.'
      },
      {
        heading: 'Custom License Templates (STARTER & PRO)',
        text: 'With STARTER or PRO, you can create fully custom license templates. Define your own stream limits, distribution rights, sync rights, and radio play terms. This protects you legally and lets you offer premium packages.'
      },
    ]
  },
  {
    icon: Music2,
    iconColor: 'text-accent-gold',
    iconBg: 'bg-accent-gold/10',
    category: 'Production',
    title: 'Optimizing Your Beat Files for Maximum Sales',
    readTime: '4 min read',
    summary: 'The quality of your files matters as much as the music. Learn the export settings, file naming conventions, and cover art standards that make buyers trust you.',
    body: [
      {
        heading: 'Export Settings',
        text: 'MP3 preview: 320kbps, stereo. WAV deliverable: 24-bit, 44.1kHz (industry standard). Stems/trackouts: Name each stem clearly (e.g., "Kick", "Snare", "Melody 1", "Bass", "Brass"). Zipped stem packs should be under 500MB.'
      },
      {
        heading: 'Cover Art',
        text: 'Cover art is the first thing a buyer sees. Use at minimum 1000x1000px, JPG or PNG. Dark, moody visuals with bold text convert better in beat marketplaces. Use Canva or Photoshop — free tools work fine.'
      },
      {
        heading: 'Beat Titles and Tags',
        text: 'Never name beats "Untitled Beat 3". Use descriptive titles: "[Afrobeats] Burna Boy Type Beat - Lagos Nights". Include genre keywords buyers actually search for. Genre tags matter — fill them in accurately.'
      },
      {
        heading: 'The Preview Section',
        text: 'The preview MP3 should showcase the hook/peak of your beat in the first 30 seconds. Most buyers decide in the first 15 seconds. Don\'t bury the best part at 2:30.'
      },
    ]
  },
  {
    icon: Users,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-400/10',
    category: 'Business',
    title: 'Building Long-Term Relationships with Artists',
    readTime: '5 min read',
    summary: 'One-time sales are good. Repeat buyers are a business. Here\'s how to turn a single beat sale into a long-term production partnership.',
    body: [
      {
        heading: 'Deliver More Than Expected',
        text: 'When an artist buys a beat, send a personal thank-you DM. Include the stems for free (if on PRO) as a surprise upgrade. Small gestures like this create loyal customers who come back for every project.'
      },
      {
        heading: 'Create Artist-Specific Packs',
        text: 'Once you understand an artist\'s sound, build packs specifically for them. "I made 5 beats that sound like your last EP" is infinitely more compelling than "check out my page." Personalization closes deals.'
      },
      {
        heading: 'Use Promo Codes Strategically',
        text: 'With STARTER/PRO, create artist-specific discount codes. "LAGOSKING20" for 20% off. This makes the artist feel special, increases close rate, and costs you very little. Set an expiry to create urgency.'
      },
      {
        heading: 'Stay Professional',
        text: 'Send invoices for every transaction. Keep your communication fast (reply within 24h). Deliver files immediately after payment — don\'t make buyers chase you. Professionalism is rare in the beat market and instantly differentiates you.'
      },
    ]
  },
]

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center space-y-5 mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-accent-orange/10 border border-accent-orange/20 text-[10px] font-black uppercase tracking-widest text-accent-orange">
            <BookOpen className="w-3.5 h-3.5" />
            Producer Playbook
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white">Marketing Guides</h1>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Actionable playbooks for producers who want to turn beats into a real business.
          </p>
        </div>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {GUIDES.map((guide) => {
            const Icon = guide.icon
            return (
              <article key={guide.title} className="bg-bg-surface border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-colors">
                {/* Card Header */}
                <div className="p-8 pb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${guide.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${guide.iconColor}`} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">{guide.readTime}</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-text-muted/60 mb-2">{guide.category}</div>
                  <h2 className="text-xl font-black text-white leading-snug mb-3">{guide.title}</h2>
                  <p className="text-text-muted text-sm leading-relaxed">{guide.summary}</p>
                </div>

                {/* Guide Content */}
                <div className="border-t border-white/5 px-8 py-6 space-y-5">
                  {guide.body.map((section) => (
                    <div key={section.heading}>
                      <h3 className="text-sm font-black text-white mb-1.5">{section.heading}</h3>
                      <p className="text-sm text-text-muted leading-relaxed">{section.text}</p>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center space-y-5 bg-bg-surface border border-white/5 rounded-3xl p-12">
          <Zap className="w-8 h-8 text-accent-orange mx-auto" />
          <h2 className="text-3xl font-black text-white">Ready to Put This Into Practice?</h2>
          <p className="text-text-muted max-w-md mx-auto">
            Create your producer profile, upload your beats, and start building your catalog today.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup?role=producer" className="h-12 px-8 bg-accent-orange text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-accent-orange/90 transition-all shadow-[0_10px_20px_rgba(255,85,0,0.2)]">
              Start Selling Beats
            </Link>
            <Link href="/pricing" className="h-12 px-8 bg-white/5 text-white rounded-full font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all border border-white/10">
              View Pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
