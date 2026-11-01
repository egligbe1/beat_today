import {randomUUID} from 'node:crypto'
import {NextResponse} from 'next/server'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {unlink} from 'node:fs/promises'
import {createClient} from '@/lib/supabase/server'
import {readJsonObject,RequestError,safeRequestError} from '@/lib/http'
import {verifyUploadTicket} from '@/lib/uploads/ticket'
import {sanitizeImage,validateAudioFile,validateStemArchive} from '@/lib/uploads/content'
import {uploadPlanAllowed} from '@/lib/uploads'
import {effectiveTier} from '@/lib/security'
import {rateLimit} from '@/lib/rateLimit'
import {R2_PRIVATE_BUCKET,R2_PUBLIC_BUCKET,objectInfo,objectBytes,objectToFile,publishVerifiedObject,putVerifiedImage,removeUploadStage,publicUrl} from '@/lib/r2'
export const runtime='nodejs'
export const maxDuration=180
let activeVerifications=0
const headers={'Cache-Control':'private, no-store'}
export async function POST(request:Request){
 let temporary:string|undefined,claimed=false
 try{
  const db=await createClient(),{data:{user}}=await db.auth.getUser()
  if(!user)return NextResponse.json({error:'Sign in to upload'},{status:401,headers})
  const body=await readJsonObject(request,6000),ticket=verifyUploadTicket(body.ticket,user.id,process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!)
  if(!await rateLimit('verify-upload:'+user.id,20,60))return NextResponse.json({error:'Please wait before verifying another file'},{status:429,headers})
  const [{data:profile},{data:settings}]=await Promise.all([db.from('users_profiles').select('role').eq('id',user.id).single(),db.from('producer_settings').select('subscription_tier,subscription_active,subscription_expires_at').eq('user_id',user.id).maybeSingle()])
  if((ticket.purpose!=='avatar'&&profile?.role!=='producer')||!uploadPlanAllowed(ticket.purpose,ticket.ext,effectiveTier(settings)))return NextResponse.json({error:'This upload is not available on your current plan'},{status:403,headers})
  if(['cover','master','stems'].includes(ticket.purpose)){
   const {data:beat}=await db.from('beats').select('producer_id').eq('id',ticket.beatId).single()
   if(beat?.producer_id!==user.id)return NextResponse.json({error:'Beat not found'},{status:404,headers})
  }
  const bucket=ticket.isPublic?R2_PUBLIC_BUCKET:R2_PRIVATE_BUCKET
  const result=()=>NextResponse.json({key:ticket.key,publicUrl:ticket.isPublic?publicUrl(ticket.key):null},{headers})
  const published=await objectInfo(bucket,ticket.key)
  if(published?.Metadata?.['upload-id']===ticket.id&&published.Metadata?.['verified']==='1')return result()
  if(activeVerifications>=1)return NextResponse.json({error:'File verification is busy. Please try again shortly.'},{status:503,headers:{...headers,'Retry-After':'10'}})
  activeVerifications++;claimed=true
  const info=await objectInfo(R2_PRIVATE_BUCKET,ticket.source)
  if(!info?.ETag||info.ContentLength!==ticket.size||info.ContentType?.toLowerCase()!==ticket.contentType)throw new RequestError('Upload is incomplete or changed. Please upload the file again.',422)
  const etag=info.ETag,metadata={'upload-id':ticket.id,verified:'1','original-size':String(ticket.size)}
  const range=(start:number,end:number)=>objectBytes(R2_PRIVATE_BUCKET,ticket.source,start,end,etag)
  if(['cover','avatar'].includes(ticket.purpose)){
   const bytes=await sanitizeImage(await range(0,ticket.size-1),ticket.ext)
   await putVerifiedImage(bucket,ticket.key,bytes,metadata)
  }else{
   if(ticket.purpose==='stems')await validateStemArchive(ticket.size,range)
   else{
    temporary=join(tmpdir(),'bt-verify-'+randomUUID()+'.'+ticket.ext)
    await objectToFile(R2_PRIVATE_BUCKET,ticket.source,etag,temporary,ticket.size)
    await validateAudioFile(temporary,ticket.ext)
   }
   // Conditional copy prevents a replacement between validation and publication.
   await publishVerifiedObject(ticket.source,ticket.key,bucket,etag,ticket.finalContentType,metadata)
  }
  // Only this request's new quarantine object is temporary. Final/purchased assets
  // and failed uploads are never removed as a cleanup sweep.
  await removeUploadStage(ticket.source).catch(()=>{})
  return result()
 }catch(error){const e=safeRequestError(error,'Your file could not be verified. Please try again.');return NextResponse.json({error:e.message},{status:e.status,headers})}
 finally{if(claimed)activeVerifications--;if(temporary)await unlink(temporary).catch(()=>{})}
}
