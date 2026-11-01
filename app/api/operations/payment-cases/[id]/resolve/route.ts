import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {isOperator} from '@/lib/operations'
import {UUID_RE} from '@/lib/security'
import {rateLimit} from '@/lib/rateLimit'
import {readJsonObject,safeRequestError} from '@/lib/http'
const headers={'Cache-Control':'private, no-store'}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {data:{user}}=await (await createClient()).auth.getUser()
  if(!user)return NextResponse.json({error:'Sign in to continue'},{status:401,headers})
  if(!isOperator(user.id))return NextResponse.json({error:'Operator access required'},{status:403,headers})
  if(!await rateLimit('case-review:'+user.id,10,60))return NextResponse.json({error:'Please wait before another review'},{status:429,headers})
  const {id}=await params,body=await readJsonObject(request,6000)
  if(!UUID_RE.test(id)||typeof body.request_id!=='string'||!UUID_RE.test(body.request_id)||typeof body.resolution!=='string'||!['NO_FINANCIAL_LOSS','ACCOUNTING_REVIEW_COMPLETED','UNRELATED_PAYMENT'].includes(body.resolution)||typeof body.note!=='string'||body.note.trim().length<20||body.note.length>1000||body.provider_checked!==true||body.accounting_checked!==true)return NextResponse.json({error:'Complete the provider and accounting review and include your evidence'},{status:400,headers})
  const {error}=await createAdminClient().rpc('resolve_payment_case',{p_case:id,p_actor:user.id,p_resolution:body.resolution,p_note:body.note.trim(),p_request:body.request_id})
  if(error)return NextResponse.json({error:'The review could not be recorded. Please refresh and check the case.'},{status:409,headers})
  return NextResponse.json({success:true},{headers})
 }catch(error){const e=safeRequestError(error,'The review could not be recorded');return NextResponse.json({error:e.message},{status:e.status,headers})}
}
