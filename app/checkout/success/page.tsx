import { CheckCircle2, Download, Music } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import LicenseModal from '@/components/library/LicenseModal'

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { order_id?: string }
}) {
  const orderId = searchParams.order_id
  
  if (!orderId) {
    return notFound()
  }

  const supabase = createClient()
  
  // 1. Fetch Order and Items
  const { data: order } = await supabase
    .from('orders')
    .select('*, buyer_profiles:users_profiles!buyer_id(*)')
    .eq('id', orderId)
    .single()
    
  if (!order) {
    return notFound()
  }

  const isPending = order.status === 'pending' || order.status === 'processing'

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('*, beats(*), order_item_licenses(*)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  // Polling component imported here
  const SuccessPolling = (await import('./SuccessPolling')).default

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center py-20 px-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl w-full space-y-8 relative z-10 text-center animate-fade-in">
        
        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
          {isPending ? 'Payment Received!' : 'Payment Successful!'}
        </h1>
        <p className="text-text-muted text-lg">
          {isPending 
            ? "We're currently finalizing your downloads and license agreements. This usually takes a few seconds."
            : `Thank you for your purchase. Your order ${order.gateway_reference} is complete.`
          }
        </p>

        <div className="bg-bg-surface rounded-3xl border border-border-subtle p-8 text-left space-y-6 shadow-2xl">
            {isPending ? (
              <SuccessPolling orderId={orderId} />
            ) : (
              <>
                <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted border-b border-border-subtle pb-4">Your Downloads</h3>
                
                <div className="space-y-4">
                   {orderItems?.map((item: any) => (
                       <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-bg-primary border border-border-subtle">
                            <div className="flex items-center gap-4">
                                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-bg-elevated flex-shrink-0">
                                    {item.beats?.cover_url ? (
                                        <Image src={item.beats.cover_url} alt={item.beats.title} fill className="object-cover" />
                                    ) : (
                                        <Music className="w-6 h-6 text-text-muted m-auto absolute inset-0" />
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-bold text-text-primary">{item.beats?.title || 'Unknown Beat'}</h4>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded mt-1 inline-block">
                                        {item.license_type}
                                    </span>
                                </div>
                            </div>

                            {/* Download Links — go through secure /api/download to verify auth */}
                            <div className="flex items-center gap-2">
                                {item.beats?.file_mp3_url && (
                                    <Link href={`/api/download?beat_id=${item.beats.id}&file=mp3&order_id=${orderId}`} className="h-10 px-4 bg-bg-surface border border-border-subtle rounded-lg text-sm font-bold flex items-center gap-2 hover:text-accent-orange transition-colors">
                                        <Download className="w-4 h-4" /> MP3
                                    </Link>
                                )}
                                {['wav', 'trackout', 'exclusive'].includes(item.license_type) && item.beats?.file_wav_url && (
                                    <Link href={`/api/download?beat_id=${item.beats.id}&file=wav&order_id=${orderId}`} className="h-10 px-4 bg-bg-surface border border-border-subtle rounded-lg text-sm font-bold flex items-center gap-2 hover:text-accent-orange transition-colors">
                                        <Download className="w-4 h-4" /> WAV
                                    </Link>
                                )}
                                {['trackout', 'exclusive'].includes(item.license_type) && item.beats?.file_stems_url && (
                                    <Link href={`/api/download?beat_id=${item.beats.id}&file=stems&order_id=${orderId}`} className="h-10 px-4 bg-bg-surface border border-border-subtle rounded-lg text-sm font-bold flex items-center gap-2 hover:text-accent-orange transition-colors">
                                        <Download className="w-4 h-4" /> STEMS
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* License Section */}
                        {item.order_item_licenses && (
                          <div className="mt-4 pt-4 border-t border-border-subtle/50">
                            {(Array.isArray(item.order_item_licenses) ? item.order_item_licenses[0]?.final_legal_text : (item.order_item_licenses as any)?.final_legal_text) ? (
                              <LicenseModal 
                                licenseText={Array.isArray(item.order_item_licenses) ? item.order_item_licenses[0].final_legal_text : (item.order_item_licenses as any).final_legal_text}
                                orderItemId={item.id}
                                beatTitle={item.beats?.title || 'Beat'}
                              />
                            ) : (
                              <div className="text-[10px] text-text-muted italic px-4">
                                License agreement will be available in your library shortly.
                              </div>
                            )}
                          </div>
                        )}
                   </div>
                   ))}
                </div>
                
                <div className="pt-6 border-t border-border-subtle flex items-center justify-between font-bold text-lg">
                    <span>Total Paid</span>
                    <span className="text-accent-green">{formatCurrency(order.total_amount)}</span>
                </div>
              </>
            )}
        </div>

        <div className="pt-8">
            <Link href="/" className="h-14 px-8 bg-white text-black rounded-xl font-bold text-lg inline-flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all">
                Return to Marketplace
            </Link>
        </div>
      </div>
    </div>
  )
}
