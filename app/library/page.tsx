import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { BookOpen, Download, Clock, FileText } from 'lucide-react'

export default async function LibraryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/library')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, gateway_reference, status, total_amount, created_at, order_items(id, license_type, price, beats(id, title, cover_url), order_item_licenses(final_legal_text))')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-6xl mx-auto px-4 py-14 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-accent-orange font-black">Secure Library</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">Your Purchase History</h1>
            <p className="text-text-muted mt-3 max-w-2xl">Access receipts, license agreements and downloads from every completed purchase.</p>
          </div>
          <Link href="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-bold uppercase tracking-[0.15em] hover:bg-[#FF5500] hover:text-white transition-all">
            <BookOpen className="w-4 h-4" /> Explore More Beats
          </Link>
        </div>

        <div className="grid gap-6">
          {orders && orders.length > 0 ? (
            orders.map((order: any) => (
              <div key={order.id} className="bg-bg-surface border border-border-subtle rounded-[28px] p-6 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted font-bold">Order</p>
                    <h2 className="text-2xl font-black text-white">{order.gateway_reference}</h2>
                    <p className="text-text-muted text-sm">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-2 rounded-full bg-[#00E676]/10 text-[#00E676] font-bold uppercase tracking-[0.2em] text-xs">{order.status}</span>
                    <span className="px-3 py-2 rounded-full bg-bg-elevated text-text-primary font-bold uppercase tracking-[0.2em] text-xs">{formatCurrency(order.total_amount)}</span>
                    <Link href={`/library/${order.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF5500] text-white font-bold rounded-full text-xs uppercase tracking-[0.2em] hover:bg-[#ff6f1a] transition-all">
                      <FileText className="w-4 h-4" /> View Receipt
                    </Link>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-bg-primary overflow-hidden relative">
                          {item.beats?.cover_url ? (
                            <Image src={item.beats.cover_url} alt={item.beats.title} fill sizes="56px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center text-text-muted">Beat</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-text-muted uppercase tracking-[0.2em]">{item.license_type}</p>
                          <h3 className="font-bold text-white truncate">{item.beats?.title || 'Untitled Beat'}</h3>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.2em] text-text-muted">Paid</span>
                        <span className="font-black text-white">{formatCurrency(item.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-bg-surface border border-border-subtle rounded-[28px] p-10 text-center">
              <p className="text-text-muted text-lg">No completed purchases yet. Add beats to your library and they’ll appear here instantly.</p>
              <Link href="/search" className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-[#FF5500] text-white rounded-full font-bold uppercase tracking-[0.15em] hover:bg-[#ff6f1a] transition-all">
                <Download className="w-4 h-4" /> Browse Beats
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
