import { createClient } from '@/lib/supabase/server'
import { notFound,redirect } from 'next/navigation'
import OfferCheckout from './OfferCheckout'
import MarketplaceCheckout from './MarketplaceCheckout'
export default async function Checkout({searchParams}:{searchParams:Promise<{offer_id?:string;promo?:string}>}) {
  const client=await createClient()
  const {data:{user}}=await client.auth.getUser()
  const query=await searchParams,id=query.offer_id
  if(!id)return <MarketplaceCheckout signedIn={!!user} email={user?.email||''} promo={typeof query.promo==='string'?query.promo.slice(0,80):''}/>
  if(!user)redirect('/login?redirect='+encodeURIComponent('/checkout?offer_id='+id))
  const {data:offer}=await client.from('offers').select('id,beat_id,license_type,amount,status,buyer_id,expires_at').eq('id',id).single()
  if(!offer || offer.buyer_id!==user.id || offer.status!=='ACCEPTED' || !offer.expires_at || Date.parse(offer.expires_at)<=Date.now())notFound()
  return <OfferCheckout offer={offer}/>
}
