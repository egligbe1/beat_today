import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {rateLimit} from '@/lib/rateLimit'
import {createGuestClaimProof} from '@/lib/guestCheckout'
import {guestReceiptSecret} from '@/lib/commerce/purchaseAccess'
import {sendGuestClaimEmail} from '@/lib/utils/emailService'
export async function POST(){
 const {data:{user}}=await (await createClient()).auth.getUser()
 if(!user?.email)return NextResponse.json({error:'Sign in to add purchases to your library'},{status:401})
 if(!await rateLimit('guest-claim:'+user.id,3,900))return NextResponse.json({error:'Please wait before requesting another confirmation email'},{status:429})
 const proof=createGuestClaimProof(user.id,user.email,guestReceiptSecret()),url=new URL('/purchases/claim',process.env.NEXT_PUBLIC_SITE_URL!)
 url.hash=new URLSearchParams({proof}).toString()
 try{await sendGuestClaimEmail(user.email,url.href)}catch{return NextResponse.json({error:'The confirmation email could not be sent. Please try again shortly.'},{status:503})}
 return NextResponse.json({message:'Check your account email to confirm and add your guest purchases.'},{headers:{'Cache-Control':'private, no-store'}})
}
