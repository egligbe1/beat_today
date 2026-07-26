import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, FileText } from 'lucide-react'
import DownloadButton from '@/components/library/DownloadButton'
import LicenseModal from '@/components/library/LicenseModal'

export default async function LibraryOrderPage({ params }: { params: { orderId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/library')

  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*, beats(*), order_item_licenses(*))')
    .eq('id', params.orderId)
    .eq('buyer_id', user.id)
    .single()

  if (!order) return notFound()

  const isPending = order.status === 'pending' || order.status === 'processing'

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-5xl mx-auto px-4 py-14 space-y-8">
        <Link href="/library" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-accent-orange hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </Link>

        <div className="rounded-[40px] border border-border-subtle bg-bg-surface p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted font-black">Order Receipt</p>
              <h1 className="text-4xl font-black text-white mt-3">{order.gateway_reference}</h1>
              <p className="text-text-muted mt-2">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted font-black">Total Paid</p>
              <p className="text-3xl font-black text-white">{formatCurrency(order.total_amount)}</p>
            </div>
          </div>

          <div className="mt-10 space-y-8">
            {order.order_items?.map((item: any) => (
              <div key={item.id} className="rounded-3xl border border-white/10 p-6 bg-black/10 space-y-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  {/* Beat Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-3xl overflow-hidden bg-bg-primary relative flex-shrink-0">
                      {item.beats?.cover_url ? (
                        <Image src={item.beats.cover_url} alt={item.beats.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center text-text-muted text-xs">No Art</div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-accent-orange font-bold">{item.license_type} License</p>
                      <h2 className="text-2xl font-black text-white">{item.beats?.title || 'Unknown Beat'}</h2>
                      <p className="text-sm text-text-muted mt-1">Paid {formatCurrency(item.price)}</p>
                    </div>
                  </div>

                  {/* Downloads — only show if completed */}
                  <div className="flex flex-col gap-3 min-w-[200px]">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-text-muted">
                      {isPending ? 'Fulfillment Status' : 'Your Files'}
                    </p>

                    {isPending ? (
                      <div className="p-4 rounded-2xl bg-accent-orange/10 border border-accent-orange/20 text-accent-orange text-xs font-bold leading-relaxed">
                        Processing... Downloads and licenses will appear here in a few moments.
                      </div>
                    ) : (
                      <>
                        {/* MP3 — all licenses get this */}
                        {(item.beats?.file_mp3_url || item.beats?.mp3_preview_url) && (
                          <DownloadButton
                            orderId={order.id}
                            beatId={item.beats.id}
                            fileType="mp3"
                            label="Download MP3"
                            className="w-full"
                          />
                        )}

                        {/* WAV — wav, trackout, exclusive */}
                        {item.beats?.file_wav_url && ['wav', 'trackout', 'exclusive'].includes(item.license_type) && (
                          <DownloadButton
                            orderId={order.id}
                            beatId={item.beats.id}
                            fileType="wav"
                            label="Download WAV"
                            className="w-full"
                          />
                        )}

                        {/* STEMS — trackout, exclusive */}
                        {item.beats?.file_stems_url && ['trackout', 'exclusive'].includes(item.license_type) && (
                          <DownloadButton
                            orderId={order.id}
                            beatId={item.beats.id}
                            fileType="stems"
                            label="Download Stems"
                            className="w-full"
                          />
                        )}
                      </>
                    )}

                    <Link
                      href={`/checkout/success?order_id=${order.id}`}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white/5 text-sm text-white font-bold uppercase tracking-[0.15em] hover:bg-white/10 transition-all"
                    >
                      <FileText className="w-4 h-4" /> View Confirmation
                    </Link>
                  </div>
                </div>

                {/* License Agreement */}
                <div className="rounded-3xl border border-border-subtle bg-bg-primary p-6">
                  <h3 className="text-sm uppercase tracking-[0.3em] text-text-muted font-black mb-3">License Agreement</h3>
                  <p className="text-xs text-text-muted mb-4">This is your legal protection for the purchased beat.</p>
                  
                  {isPending ? (
                    <div className="max-h-72 rounded-2xl bg-black/20 p-4 border border-white/10 text-accent-orange text-xs font-bold leading-relaxed animate-pulse">
                      Generating your licensing agreement...
                    </div>
                  ) : (
                    <>
                      {(Array.isArray(item.order_item_licenses) ? item.order_item_licenses[0]?.final_legal_text : item.order_item_licenses?.final_legal_text) ? (
                        <LicenseModal 
                          licenseText={Array.isArray(item.order_item_licenses) ? item.order_item_licenses[0].final_legal_text : item.order_item_licenses.final_legal_text}
                          orderItemId={item.id}
                          beatTitle={item.beats?.title || 'Beat'}
                        />
                      ) : (
                        <div className="max-h-72 rounded-2xl bg-black/20 p-4 text-sm text-text-muted border border-white/10">
                          <p>No license text available. A PDF was emailed to you when your order was processed.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
