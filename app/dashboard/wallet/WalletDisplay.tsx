'use client'

import { useCurrency } from '@/lib/providers/CurrencyProvider'
import { CheckCircle, Clock, HelpCircle } from 'lucide-react'
import { useState } from 'react'

interface Props {
  available: number
  pending: number
  ledger: { id: string; description: string; reference_id: string; type: string; amount: number; created_at: string }[]
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1.5 cursor-help"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <HelpCircle className="w-3.5 h-3.5 text-text-muted/50 hover:text-text-muted transition-colors" />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2 text-[11px] text-text-muted leading-relaxed z-50 shadow-xl pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-bg-elevated" />
        </span>
      )}
    </span>
  )
}

export default function WalletDisplay({ available, pending, ledger }: Props) {
  const { convertAndFormat } = useCurrency()
  const total = available + pending

  return (
    <>
      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl relative overflow-hidden group">
          <div className="relative z-10 space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-text-muted flex items-center">
              Available Balance
              <Tooltip text="Funds cleared and ready to be paid out to your bank account. Payouts run automatically on the 1st and 15th of each month." />
            </p>
            <h2 className="text-3xl sm:text-5xl font-black text-white">{convertAndFormat(available)}</h2>
            <p className="text-xs text-accent-green font-bold uppercase tracking-widest flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Ready for Payout
            </p>
          </div>
        </div>

        <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl relative overflow-hidden group">
          <div className="relative z-10 space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-text-muted flex items-center">
              Pending Clearance
              <Tooltip text="Sales revenue held for 48 hours as a fraud protection window. Funds automatically move to Available Balance after 48 hours." />
            </p>
            <h2 className="text-3xl sm:text-5xl font-black text-accent-gold/90">{convertAndFormat(pending)}</h2>
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4" /> 48-Hour Maturation
            </p>
          </div>
        </div>

        <div className="bg-[#FF5500]/5 p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-[#FF5500]/20 shadow-xl relative overflow-hidden group">
          <div className="relative z-10 space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[#FF5500]/60 flex items-center">
              Total Revenue
              <Tooltip text="Your combined available + pending balance. Represents all earnings on BeatToday that haven't yet been paid out." />
            </p>
            <h2 className="text-3xl sm:text-5xl font-black text-white">{convertAndFormat(total)}</h2>
            <p className="text-xs text-[#FF5500] font-bold uppercase tracking-widest">Lifetime Earnings</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-bg-surface rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl overflow-hidden">
        <div className="p-5 sm:p-8 border-b border-border-subtle">
          <h3 className="text-base sm:text-xl font-bold text-white">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-primary/50 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                <th className="p-3 sm:p-6">Transaction</th>
                <th className="p-3 sm:p-6">Type</th>
                <th className="p-3 sm:p-6 text-center">Date</th>
                <th className="p-3 sm:p-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 sm:p-20 text-center text-text-muted font-bold uppercase tracking-widest text-xs opacity-40">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                ledger.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 sm:p-6">
                      <p className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight">{tx.description || 'Beat Sale'}</p>
                      <p className="text-[10px] font-mono text-text-muted truncate max-w-[120px] sm:max-w-none">REF: {tx.reference_id}</p>
                    </td>
                    <td className="p-3 sm:p-6">
                      <span className={`inline-block px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        tx.type === 'sale'
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : tx.type === 'payout'
                          ? 'bg-accent-gold/10 text-accent-gold border-accent-gold/20'
                          : 'bg-white/5 text-white border-white/10'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3 sm:p-6 text-center text-[10px] text-text-muted font-bold uppercase tracking-tighter whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className={`p-3 sm:p-6 text-right font-black text-sm sm:text-lg whitespace-nowrap ${tx.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                      {tx.amount > 0 ? '+' : ''}{convertAndFormat(Math.abs(tx.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
