import { randomUUID } from 'node:crypto'
import { markConversationRead } from '@/lib/messageReadReceipts'
import { readJsonObject, safeRequestError } from '@/lib/http'
import { validMessageTimestamp } from '@/lib/messages'
import { UUID_RE } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function participant(db: Awaited<ReturnType<typeof createClient>>, conversationId:string, userId:string) {
 const {data,error}=await db.from('conversations').select('id').eq('id',conversationId).or(`participant_1.eq.${userId},participant_2.eq.${userId}`).maybeSingle()
 if(error)throw new Error('Conversation could not be loaded')
 return !!data
}

// Incremental catch-up uses a compound cursor so equal timestamps do not lose rows.
export async function GET(req:Request) {
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return NextResponse.json({error:'Sign in to view messages'},{status:401})
 const params=new URL(req.url).searchParams, conversationId=params.get('conversation_id')||''
 const after=params.get('after'),afterId=params.get('after_id')
 if(!UUID_RE.test(conversationId)||((after||afterId)&&(!after||!afterId||!UUID_RE.test(afterId)||!validMessageTimestamp(after))))return NextResponse.json({error:'Invalid conversation or cursor'},{status:400})
 try{
  if(!await participant(db,conversationId,user.id))return NextResponse.json({error:'Conversation not found'},{status:404})
  let query=db.from('messages').select('id,conversation_id,sender_id,content,created_at,is_read').eq('conversation_id',conversationId)
  if(after&&afterId){const timestamp=after;query=query.or(`created_at.gt.${timestamp},and(created_at.eq.${timestamp},id.gt.${afterId})`)}
  const {data,error}=await query.order('created_at',{ascending:true}).order('id',{ascending:true}).limit(100)
  if(error)throw error
  return NextResponse.json({messages:data||[],has_more:data?.length===100},{headers:{'Cache-Control':'private, no-store'}})
 }catch{return NextResponse.json({error:'Messages could not be refreshed'},{status:503})}
}

// Only the recipient can mark the received messages they have actually displayed.
export async function PATCH(req:Request) {
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return NextResponse.json({error:'Sign in to continue'},{status:401})
 let body
 try{body=await readJsonObject(req)}catch(error){const e=safeRequestError(error);return NextResponse.json({error:e.message},{status:e.status})}
 if(typeof body.conversation_id!=='string'||!UUID_RE.test(body.conversation_id)||!Array.isArray(body?.ids)||!body.ids.length||body.ids.length>100||body.ids.some((id:unknown)=>typeof id!=='string'||!UUID_RE.test(id)))return NextResponse.json({error:'Invalid request'},{status:400})
 try{
  if(!await participant(db,body.conversation_id,user.id))return NextResponse.json({error:'Conversation not found'},{status:404})
  await markConversationRead(supabaseAdmin,db,user.id,body.conversation_id,body.ids)
  return NextResponse.json({success:true})
 }catch{return NextResponse.json({error:'Messages could not be marked read'},{status:503})}
}

// POST /api/messages — send a message (creates conversation if needed)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await rateLimit('app/api/messages/route.ts:' + user.id, 30, 60)) return NextResponse.json({ error: 'Please wait' }, { status: 429 })

  let body
  try{body=await readJsonObject(req)}catch(error){const e=safeRequestError(error);return NextResponse.json({error:e.message},{status:e.status})}
  const {content}=body
  const recipient_id=typeof body.recipient_id==='string'?body.recipient_id:''
  const conversation_id=typeof body.conversation_id==='string'?body.conversation_id:''
  if((body.conversation_id!=null&&typeof body.conversation_id!=='string')||(body.recipient_id!=null&&typeof body.recipient_id!=='string'))return NextResponse.json({error:'Invalid conversation or recipient'},{status:400})
  if((conversation_id&&!UUID_RE.test(conversation_id))||(!conversation_id&&!UUID_RE.test(recipient_id||'')))return NextResponse.json({error:'Invalid conversation or recipient'},{status:400})

  if (typeof content !== 'string' || !content.trim() || content.length > 5000) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  if(body.request_id!=null&&(typeof body.request_id!=='string'||!UUID_RE.test(body.request_id)))return NextResponse.json({error:'Invalid message request ID'},{status:400})
  // Migration applied with specific authorization on 2026-11-01. When on,
  // errors never fall through to a second, non-atomic insert.
  if(process.env.MESSAGE_IDEMPOTENCY_ENABLED!=='false'){
    const {data,error}=await supabase.rpc('send_message_once',{p_request:body.request_id||randomUUID(),p_content:content.trim(),p_conversation:conversation_id||null,p_recipient:recipient_id||null})
    if(error)return NextResponse.json({error:error.code==='P0429'?'Please wait before sending another message':error.code==='42501'?'Conversation not found':error.code==='P0001'?'Check the message or start a new send attempt':'Message could not be sent. Retry with the same draft.'},{status:error.code==='P0429'?429:error.code==='42501'?403:error.code==='P0001'?409:503})
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}})
  }

  let convId = conversation_id

  if (convId) {
    // Verify the caller is actually a participant in this conversation
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', convId)
      .single()
    if (!conv || (conv.participant_1 !== user.id && conv.participant_2 !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    if (!recipient_id) return NextResponse.json({ error: 'Missing recipient_id' }, { status: 400 })
    if (recipient_id === user.id) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })

    // Find or create conversation (normalize participant order)
    const [p1, p2] = [user.id, recipient_id].sort()

    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .maybeSingle()

    if (existing) {
      convId = existing.id
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('conversations')
        .insert({ participant_1: p1, participant_2: p2 })
        .select('id')
        .single()

      if (error) {
        if(error.code!=='23505')return NextResponse.json({error:'Conversation could not be started'},{status:500})
        const {data:raced}=await supabaseAdmin.from('conversations').select('id').eq('participant_1',p1).eq('participant_2',p2).maybeSingle()
        if(!raced)return NextResponse.json({error:'Conversation could not be started'},{status:500})
        convId=raced.id
      } else convId = created.id
    }
  }

  // Insert message
  const { data: message, error: msgError } = await supabaseAdmin
    .from('messages')
    .insert({ conversation_id: convId, sender_id: user.id, content: content.trim() })
    .select()
    .single()

  if (msgError) return NextResponse.json({ error: 'Message could not be sent. Please try again.' }, { status: 500 })

  // Update conversation last_message_at
  await supabaseAdmin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId)

  // Notify recipient
  const otherUserId = await getOtherParticipant(convId, user.id)
  if (otherUserId) {
    const { data: sender } = await supabaseAdmin
      .from('users_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    await supabaseAdmin.from('notifications').insert({
      user_id: otherUserId,
      type: 'new_message',
      title: 'New Message',
      body: `${sender?.display_name || 'Someone'}: ${content.trim().slice(0, 60)}${content.length > 60 ? '...' : ''}`,
      link: `/messages/${convId}`,
      metadata: { conversation_id: convId, message_id: message.id }
    })
  }

  return NextResponse.json({ message, conversation_id: convId })
}

async function getOtherParticipant(convId: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('participant_1, participant_2')
    .eq('id', convId)
    .single()
  if (!data) return null
  return data.participant_1 === userId ? data.participant_2 : data.participant_1
}
