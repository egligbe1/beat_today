import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {createClient} from '@supabase/supabase-js'
import {markConversationRead} from '../lib/messageReadReceipts.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
// Translate the real Supabase client's HTTP filters into isolated PostgreSQL.
// No network or live credentials are used; ownership and race behavior run on rows.
async function fixture(t){
 const db=await PGlite.create();t.after(()=>db.close())
 await db.exec('CREATE TABLE messages(id UUID PRIMARY KEY,conversation_id UUID,sender_id UUID,is_read BOOLEAN DEFAULT false);CREATE TABLE notifications(id UUID PRIMARY KEY,user_id UUID,type TEXT,metadata JSONB,is_read BOOLEAN DEFAULT false,created_at TIMESTAMPTZ)')
 const fetch=async(input,options)=>{
  const url=new URL(input),table=url.pathname.split('/').at(-1)
  assert.ok(['messages','notifications'].includes(table))
  const values=[],conditions=[]
  const param=value=>{values.push(value);return '$'+values.length}
  for(const [key,filter] of url.searchParams){
   if(key==='select')continue
   assert.ok(['conversation_id','id','sender_id','user_id','type','metadata','metadata->>message_id','created_at','is_read'].includes(key),'unexpected filter '+key)
   const column=key==='metadata->>message_id'?"metadata->>'message_id'":`"${key}"`
   const dot=filter.indexOf('.'),op=filter.slice(0,dot),value=filter.slice(dot+1)
   if(op==='in')conditions.push(`${column} IN (${value.slice(1,-1).split(',').map(v=>param(v.replace(/^"|"$/g,''))).join(',')})`)
   else if(op==='is'){assert.equal(value,'null');conditions.push(`${column} IS NULL`)}
   else if(op==='cs')conditions.push(`${column} @> ${param(value)}::JSONB`)
   else {assert.ok(['eq','neq','lte'].includes(op));conditions.push(`${column} ${{eq:'=',neq:'<>',lte:'<='}[op]} ${param(value)}`)}
  }
  const where=conditions.join(' AND ')
  if(options.method==='HEAD'){
   const {rows}=await db.query(`SELECT count(*)::INTEGER n FROM ${table} WHERE ${where}`,values)
   return new Response(null,{status:200,headers:{'content-range':`*/${rows[0].n}`}})
  }
  assert.equal(options.method,'PATCH');assert.deepEqual(JSON.parse(options.body),{is_read:true})
  const {rows}=await db.query(`UPDATE ${table} SET is_read=true WHERE ${where} RETURNING id`,values)
  return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}})
 }
 return {db,client:createClient('http://isolated.invalid','isolated',{global:{fetch},auth:{persistSession:false,autoRefreshToken:false}})}
}
test('chat read receipts clear matching alerts, retain other users/conversations and are retry-safe',async t=>{
 const {db,client}=await fixture(t)
 for(const [n,conv,sender] of [[1,20,11],[2,20,11],[3,20,10],[4,21,11]])await db.query('INSERT INTO messages(id,conversation_id,sender_id) VALUES($1,$2,$3)',[id(n),id(conv),id(sender)])
 for(const [n,user,conv,msg,type='new_message',time='2026-11-01T12:00:00Z'] of [[30,10,20,1],[31,10,20,2],[32,10,20,3],[33,12,20,1],[34,10,21,4],[35,10,20,null],[36,10,20,null,'new_message','2026-11-01T12:02:00Z'],[37,10,20,null,'new_sale']])await db.query('INSERT INTO notifications VALUES($1,$2,$3,$4,false,$5)',[id(n),id(user),type,JSON.stringify({conversation_id:id(conv),...(msg?{message_id:id(msg)}:{})}),time])
 const receipt=ids=>markConversationRead(client,client,id(10),id(20),ids.map(id),'2026-11-01T12:01:00Z')
 await receipt([1,3,4])
 const read=async table=>(await db.query(`SELECT id FROM ${table} WHERE is_read ORDER BY id`)).rows.map(r=>r.id)
 assert.deepEqual(await read('messages'),[id(1)])
 assert.deepEqual(await read('notifications'),[id(30)])
 // Last displayed received message clears its own alert and the old legacy alert.
 await receipt([1,2]);await receipt([1,2])
 assert.deepEqual(await read('messages'),[id(1),id(2)])
 assert.deepEqual(await read('notifications'),[id(30),id(31),id(35)])
})
