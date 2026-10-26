import { createClient } from '@/lib/supabase/server'
import { notFound,redirect } from 'next/navigation'
import OfferCheckout from './OfferCheckout'
export default async function Checkout({searchParams}:{searchParams:Promise<{offer_id?:string}>}) {
  const client=await createClient()
  const {data:{user}}=await client.auth.getUser()
  if(!user)redirect('/login')
  const id=(await searchParams).offer_id
  if(!id)notFound()
  const {data:offer}=await client.from('offers').select('id,beat_id,license_type,amount,status,buyer_id,expires_at').eq('id',id).single()
  if(!offer || offer.buyer_id!==user.id || offer.status!=='ACCEPTED' || !offer.expires_at || Date.parse(offer.expires_at)<=Date.now())notFound()
  return <OfferCheckout offer={offer}/>
}
