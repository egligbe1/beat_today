import {createHash,timingSafeEqual} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
export function validOperatorToken(header:string|null,secret:string|undefined) {
 if(!secret||secret.length<32||!header||header.length>2048)return false
 const hash=(value:string)=>createHash('sha256').update(value).digest()
 return timingSafeEqual(hash(header),hash('Bearer '+secret))
}
export const READINESS_CONFIG=['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','PAYSTACK_SECRET_KEY','RESEND_API_KEY','QSTASH_CURRENT_SIGNING_KEY','QSTASH_NEXT_SIGNING_KEY','CRON_SECRET','CLOUDFLARE_S3_API_ENDPOINT','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_S3_PUBLIC_BUCKET','CLOUDFLARE_S3_PRIVATE_BUCKET','CLOUDFLARE_R2_PUBLIC_URL'] as const
export async function operationalCounts(db:SupabaseClient,now=Date.now()) {
 const count=(table:string)=>db.from(table).select('*',{count:'exact',head:true})
 const stale=new Date(now-10*60*1000).toISOString()
 const results=await Promise.all([
  count('delivery_jobs').is('sent_at',null),
  count('delivery_jobs').is('sent_at',null).not('last_error','is',null),
  count('watermark_jobs').eq('status','failed'),
  count('watermark_jobs').eq('status','processing').lt('claimed_at',stale),
  count('payment_reconciliations'),
 ].map(query=>query.abortSignal(AbortSignal.timeout(5000))))
 if(results.some(result=>result.error||result.count===null))throw new Error('Dependency check failed')
 return Object.fromEntries(['pending_deliveries','failed_deliveries','failed_watermarks','stale_watermark_leases','recorded_payment_exceptions'].map((name,index)=>[name,results[index].count!])) as Record<string,number>
}
