import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import LicensesDashboard from './LicensesDashboard'

export default async function LicensesPage() {
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
  const canCustomizeLicenses = tier === 'starter' || tier === 'pro'

  if (!canCustomizeLicenses) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 bg-accent-orange/10 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-accent-orange" />
        </div>
        <h1 className="text-3xl font-black text-white">Custom License Templates</h1>
        <p className="text-text-muted">
          Customize the streaming limits, video rights, radio rights, and contract text for every license tier you sell. Available on <strong className="text-accent-gold">STARTER</strong> and above.
        </p>
        <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-3 text-left">
          <p className="text-xs font-black uppercase tracking-widest text-text-muted">Unlock with STARTER</p>
          {[
            'Set custom stream limits per license type',
            'Control music video & radio broadcasting rights',
            'Edit full contract text with dynamic placeholders',
            'Changes apply instantly to all future sales',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange/50" />
              {f}
            </div>
          ))}
        </div>
        <Link
          href="/dashboard/subscription"
          className="inline-flex h-12 px-8 bg-accent-orange text-white font-black rounded-2xl items-center justify-center hover:bg-accent-orange/90 transition-colors"
        >
          Upgrade to STARTER — $9.99/yr
        </Link>
      </div>
    )
  }

  return <LicensesDashboard />
}
