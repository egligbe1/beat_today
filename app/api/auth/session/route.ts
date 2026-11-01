import {createClient} from '@/lib/supabase/server'
import {readJsonObject,safeRequestError,RequestError} from '@/lib/http'
import {NextResponse} from 'next/server'
export async function POST(request:Request) {
 try{
  const {access_token,refresh_token}=await readJsonObject(request,16000)
  if(typeof access_token!=='string'||typeof refresh_token!=='string'||!access_token||!refresh_token||access_token.length>12000||refresh_token.length>2000)throw new RequestError('Invalid session credentials')
  const db=await createClient()
  const {error}=await db.auth.setSession({access_token,refresh_token})
  if(error)return NextResponse.json({error:'Session could not be established'},{status:401})
  return NextResponse.json({success:true},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){const failure=safeRequestError(error);return NextResponse.json({error:failure.message},{status:failure.status})}
}
