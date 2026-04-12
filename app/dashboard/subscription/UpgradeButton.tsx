'use client'

import { useState } from 'react'
import { Loader2, ArrowUpRight } from 'lucide-react'
import { showToast } from '@/lib/utils/toast'

export default function UpgradeButton({ tier, isDowngrade }: { tier: string; isDowngrade: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        showToast.error(data.error || 'Failed to start subscription. Please try again.')
      }
    } catch {
      showToast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (isDowngrade) {
    return (
      <div className="w-full h-12 rounded-2xl bg-white/5 text-text-muted font-black text-xs uppercase tracking-widest flex items-center justify-center">
        Contact support to downgrade
      </div>
    )
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="w-full h-12 rounded-2xl bg-accent-orange text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#ff6a1f] active:scale-[0.98] transition-all shadow-lg shadow-accent-orange/20 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>Upgrade to {tier} <ArrowUpRight className="w-4 h-4" /></>
      )}
    </button>
  )
}
