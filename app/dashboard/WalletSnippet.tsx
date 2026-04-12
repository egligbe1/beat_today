'use client'

import { useCurrency } from '@/lib/providers/CurrencyProvider'
import Link from 'next/link'

export default function WalletSnippet({ available, pending }: { available: number; pending: number }) {
  const { convertAndFormat } = useCurrency()

  return (
    <div className="bg-bg-surface rounded-3xl border border-border-subtle p-5 space-y-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">Wallet</h3>
      <div>
        <p className="text-3xl font-black text-white">{convertAndFormat(available)}</p>
        <p className="text-xs text-accent-green font-bold mt-1">Available for payout</p>
      </div>
      {pending > 0 && (
        <p className="text-xs text-text-muted">+ {convertAndFormat(pending)} pending</p>
      )}
      <Link href="/dashboard/wallet" className="block text-center text-xs font-bold uppercase tracking-widest text-accent-orange hover:underline">
        Manage Wallet →
      </Link>
    </div>
  )
}
