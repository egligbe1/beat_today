import type { SupabaseClient } from '@supabase/supabase-js'
/** Caller must authenticate and authorize conversation membership before calling. */
export async function markConversationRead(admin:SupabaseClient,db:SupabaseClient,userId:string,conversationId:string,ids:string[],cutoff=new Date().toISOString()) {
 const {data:read,error}=await admin.from('messages').update({is_read:true}).eq('conversation_id',conversationId).in('id',ids).neq('sender_id',userId).select('id')
 if(error)throw error
 const readIds=(read||[]).map(row=>row.id)
 if(readIds.length){
  const {error:notificationError}=await admin.from('notifications').update({is_read:true}).eq('user_id',userId).eq('type','new_message').contains('metadata',{conversation_id:conversationId}).in('metadata->>message_id',readIds)
  if(notificationError)throw notificationError
 }
 // Legacy alerts have no message ID. Keep alerts that arrived during this request
 // and leave the conversation alert unread if there are still undisplayed messages.
 const {count,error:unreadError}=await db.from('messages').select('id',{count:'exact',head:true}).eq('conversation_id',conversationId).neq('sender_id',userId).eq('is_read',false)
 if(unreadError)throw unreadError
 if(count===0){
  const {error:legacyError}=await admin.from('notifications').update({is_read:true}).eq('user_id',userId).eq('type','new_message').contains('metadata',{conversation_id:conversationId}).is('metadata->>message_id',null).lte('created_at',cutoff)
  if(legacyError)throw legacyError
 }
}
