import { CheckCircle2, Music } from 'lucide-react'
import Link from 'next/link'
import {createAdminClient} from '@/lib/supabase/admin'
import {purchaseAccess} from '@/lib/commerce/purchaseAccess'
import PurchaseCompleteEffects from '@/components/commerce/PurchaseCompleteEffects'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import LicenseModal from '@/components/library/LicenseModal'
import DownloadButton from '@/components/library/DownloadButton'

export default async function CheckoutSuccessPage(
  props: {
    searchParams: Promise<{ order_id?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const orderId = searchParams.order_id

  if (!orderId) {
    return notFound()
  }

  const access=await purchaseAccess(orderId)
  if(!access)return <div className="max-w-xl mx-auto p-8 py-20 text-center"><h1 className="text-3xl font-bold">Open your purchase securely</h1><p className="text-zinc-400 mt-4">Use the private purchase link in your email, recover a fresh link, or sign in to your library.</p><div className="flex justify-center gap-5 mt-7 text-orange-400"><Link href="/purchases/recover">Recover by email</Link><Link href="/login?redirect=%2Flibrary">Sign in</Link></div></div>
  const order=access.order
  const isPending=order.status==='pending'||order.status==='processing'
  if(!isPending&&order.status!=='completed')return <div className="max-w-xl mx-auto p-8 py-20 text-center"><h1 className="text-3xl font-bold">Your order is not complete</h1><p className="mt-4 text-zinc-400">If you were charged, contact support with your payment reference before paying again.</p><Link className="inline-block text-orange-400 mt-6" href="/library">Open purchase history</Link></div>
  const {data:orderItems,error}=await createAdminClient().from('order_items')
    .select('id,beat_id,license_type,price,asset_snapshot,agreement_snapshot,beats(id,title,cover_url,file_mp3_url,file_wav_url,file_stems_url),order_item_licenses(final_legal_text)')
    .eq('order_id',orderId).order('created_at',{ascending:true})
  if(error)throw new Error('Your purchase could not be loaded. Please try again.')

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
          {isPending ? 'Payment confirmation pending' : 'Your purchase is ready'}
        </h1>
        <p className="text-text-muted text-lg">
          {isPending 
            ? "Your order is waiting for verified payment confirmation. Downloads will appear when it is complete."
            : `Thank you for your purchase. Your order ${order.gateway_reference} is complete.`
          }
        </p>

        {!isPending&&<PurchaseCompleteEffects items={(orderItems||[]).map(item=>({beat_id:item.beat_id,license_type:item.license_type}))}/>}
        {access.guest&&!isPending&&<section className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 text-left"><h2 className="font-bold text-lg">Keep every license in one place</h2><p className="mt-3 text-sm text-zinc-400">Your license and private download link will be emailed to you. An optional account gives you purchase history, ongoing access and collaboration with producers. Use the same delivery email and verify it to add this purchase.</p><div className="mt-5 flex flex-wrap gap-4"><Link className="rounded-full bg-orange-500 px-5 py-3 text-sm font-bold" href="/signup?role=artist&redirect=%2Flibrary%3Fclaim_guest%3D1">Create my artist account</Link><Link className="self-center text-sm text-zinc-400" href="/login?redirect=%2Flibrary%3Fclaim_guest%3D1">Already registered? Sign in</Link></div></section>}

        <div className="bg-bg-surface rounded-3xl border border-border-subtle p-8 text-left space-y-6 shadow-2xl">
            {isPending ? (
              <SuccessPolling orderId={orderId} />
            ) : (
              <>
                <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted border-b border-border-subtle pb-4">Your Downloads</h3>
                
                <div className="space-y-4">
                   {orderItems?.map((item: any) => (
                       <div key={item.id} className="p-4 rounded-2xl bg-bg-primary border border-border-subtle space-y-4">
                            {/* Main Info Row */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

                                {/* Downloads — DownloadButton fetches a signed URL then triggers
                                    the download (never navigate straight to the JSON API). */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {(item.asset_snapshot?.mp3 || item.asset_snapshot?.wav || item.beats?.file_mp3_url || item.beats?.file_wav_url) && (
                                        <DownloadButton orderId={orderId} beatId={item.beats.id} fileType="mp3" label="Download" className="!py-2.5 !rounded-lg" />
                                    )}
                                    {['trackout', 'exclusive'].includes(item.license_type) && (item.asset_snapshot?.stems || item.beats?.file_stems_url) && (
                                        <DownloadButton orderId={orderId} beatId={item.beats.id} fileType="stems" label="Stems" className="!py-2.5 !rounded-lg" />
                                    )}
                                </div>
                            </div>

                            {/* License Section */}
                            {!isPending && (
                              <div className="pt-4 border-t border-border-subtle/50">
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
