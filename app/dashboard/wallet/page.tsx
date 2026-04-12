import { getCachedAuthContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Landmark } from 'lucide-react'
import Link from 'next/link'
import WalletDisplay from './WalletDisplay'

export default async function WalletPage() {
  const { user } = await getCachedAuthContext()
  if (!user) redirect('/login')

  const supabase = createClient()

  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('producer_id', user.id)
    .single()

  const { data: ledger } = await supabase
    .from('ledger_transactions')
    .select('*')
    .eq('producer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-2">My Balance</h1>
          <p className="text-text-muted text-sm">Track your earnings and automated payouts.</p>
        </div>
        {(() => {
          const bd = wallet?.bank_details || {}
          const bankData = bd.bank || bd
          const isSetup = !!(bankData.account_number || bankData.iban || wallet?.mobile_money_recipient_code)
          const displayNumber = bankData.account_number
            ? `••••${bankData.account_number.slice(-4)}`
            : bankData.iban ? `IBAN ••••${bankData.iban.slice(-4)}` : null
          const displayName = bankData.bank_name || bankData.country || null

          if (!isSetup) {
            return (
              <Link href="/dashboard/settings#payout" className="bg-bg-surface px-5 py-4 rounded-xl border border-dashed border-accent-orange/30 flex flex-col gap-1 hover:border-accent-orange/60 hover:bg-accent-orange/5 transition-all group">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-accent-orange" />
                  <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Payout Account</p>
                </div>
                <p className="text-accent-orange font-bold text-sm group-hover:underline">+ Set up payout details →</p>
                <p className="text-[10px] text-text-muted">Required to receive automatic payouts</p>
              </Link>
            )
          }

          return (
            <Link href="/dashboard/settings#payout" className="bg-bg-surface px-5 py-4 rounded-xl border border-border-subtle flex flex-col gap-2 hover:border-accent-gold/30 transition-all">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-accent-gold" />
                <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Payout Account</p>
              </div>
              <p className="text-white font-mono text-sm">{displayNumber || 'Linked'}</p>
              <p className="text-[10px] text-text-muted uppercase tracking-[0.2em]">{displayName || 'Edit details →'}</p>
            </Link>
          )
        })()}
      </div>

      <WalletDisplay
        available={wallet?.available_balance || 0}
        pending={wallet?.pending_balance || 0}
        ledger={ledger || []}
      />
    </div>
  )
}
