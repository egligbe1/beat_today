import {NextResponse} from 'next/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {validOperatorToken,READINESS_CONFIG,operationalCounts} from '@/lib/operations'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store'}
/** Read-only operator check. Never settles payments or claims/retries a job. */
export async function GET(request:Request){
 if(!validOperatorToken(request.headers.get('authorization'),process.env.HEALTHCHECK_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401,headers})
 const missing=READINESS_CONFIG.filter(name=>!process.env[name])
 if(missing.length)return NextResponse.json({status:'not_ready',missing_configuration:missing},{status:503,headers})
 try{
  const counts=await operationalCounts(createAdminClient())
  const needsAttention=counts.failed_deliveries>0||counts.failed_watermarks>0||counts.stale_watermark_leases>0||counts.open_payment_cases>0
  return NextResponse.json({status:needsAttention?'attention_required':'ready',counts,timestamp:new Date().toISOString()},{status:needsAttention?503:200,headers})
 }catch{return NextResponse.json({status:'not_ready',error:'Dependency check failed'},{status:503,headers})}
}
