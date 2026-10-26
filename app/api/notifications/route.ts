import { UUID_RE } from '@/lib/security'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/notifications — fetch user's notifications
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kind=searchParams.get('kind')==='messages'?'messages':'general'
  const unreadOnly = searchParams.get('unread') === 'true'

  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  query=kind==='messages'?query.eq('type','new_message'):query.neq('type','new_message')
  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let unread=supabaseAdmin.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('is_read',false)
  unread=kind==='messages'?unread.eq('type','new_message'):unread.neq('type','new_message')
  const {count:unreadCount,error:countError}=await unread
  if(countError)return NextResponse.json({error:'Notification count could not be loaded'},{status:503})
  return NextResponse.json({notifications:data||[],unread_count:unreadCount},{headers:{'Cache-Control':'private, no-store'}})
}

// PATCH /api/notifications — mark as read
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400})}
  const {ids,mark_all}=body||{}
  const kind=body?.kind==='messages'?'messages':'general'
  let query=supabaseAdmin.from('notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false)
  query=kind==='messages'?query.eq('type','new_message'):query.neq('type','new_message')
  if(!mark_all){
    if(!Array.isArray(ids)||!ids.length||ids.length>50||ids.some((id:unknown)=>typeof id!=='string'||!UUID_RE.test(id)))return NextResponse.json({error:'Invalid notification IDs'},{status:400})
    query=query.in('id',ids)
  }
  const {error}=await query
  if(error)return NextResponse.json({error:'Notifications could not be updated'},{status:503})
  return NextResponse.json({success:true})
}
