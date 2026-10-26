import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {mergeMessages,messageCursor,validMessageTimestamp} from '../lib/messages.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const message=(n,time='2026-10-26T12:00:00.123456+00:00')=>({id:id(n),conversation_id:id(20),sender_id:id(10),content:'Message '+n,created_at:time,is_read:false})
test('send response and repeated realtime/catch-up delivery produce one ordered message',()=>{
 const old=message(1),sent=message(2,'2026-10-26T12:00:01Z')
 assert.deepEqual(mergeMessages(mergeMessages([old],[sent]),[old,sent]),[old,sent])
 assert.equal(mergeMessages([{...old,is_read:true}],[old])[0].is_read,true)
 assert.equal(mergeMessages([old],[{...old,is_read:true}])[0].is_read,true)
})
test('chat ordering and cursors retain Postgres microseconds and equal-timestamp IDs',()=>{
 const later=message(1,'2026-10-26T12:00:00.123457Z'),earlier=message(2,'2026-10-26T12:00:00.123456Z')
 assert.deepEqual(mergeMessages([later],[earlier]),[earlier,later])
 assert.deepEqual(mergeMessages([message(2)],[message(1)]).map(m=>m.id),[id(1),id(2)])
 assert.equal(messageCursor(earlier).created_at,'2026-10-26T12:00:00.123456Z')
 assert.equal(messageCursor(undefined),null)
 assert.equal(validMessageTimestamp(earlier.created_at),true)
 for(const value of ['not a date','2026-10-26T12:00:00Z),id.gt.1','2026-10-26','2026-99-99T12:00:00Z'])assert.equal(validMessageTimestamp(value),false)
})
test('realtime migration preserves rows, is repeatable, preserves RLS and prevents direct chat writes',async t=>{
 const db=await PGlite.create();t.after(()=>db.close())
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE PUBLICATION supabase_realtime;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE conversations(id UUID PRIMARY KEY,participant_1 UUID,participant_2 UUID);
 CREATE TABLE messages(id UUID PRIMARY KEY,conversation_id UUID REFERENCES conversations(id),sender_id UUID,content TEXT,is_read BOOLEAN DEFAULT false,created_at TIMESTAMPTZ DEFAULT now());
 ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
 CREATE POLICY conversations_select ON conversations FOR SELECT TO authenticated USING(auth.uid() IN(participant_1,participant_2));
 CREATE POLICY conversations_manage ON conversations FOR ALL TO authenticated USING(auth.uid() IN(participant_1,participant_2));
 CREATE POLICY messages_select ON messages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM conversations WHERE id=messages.conversation_id));
 CREATE POLICY messages_insert ON messages FOR INSERT TO authenticated WITH CHECK(auth.uid()=sender_id);
 GRANT ALL ON messages,conversations TO authenticated;
 `)
 for(const name of ['notifications','studio_project_events','studio_projects','studio_agreements','studio_bookings','studio_project_milestones'])await db.exec(`CREATE TABLE ${name}(id UUID PRIMARY KEY);ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY;CREATE POLICY participant_read ON ${name} FOR SELECT TO authenticated USING(false);`)
 await db.query('INSERT INTO conversations VALUES($1,$2,$3)',[id(20),id(10),id(11)])
 await db.query('INSERT INTO messages(id,conversation_id,sender_id,content) VALUES($1,$2,$3,$4)',[id(1),id(20),id(10),'Existing private content'])
 const before=(await db.query('SELECT * FROM messages')).rows
 const sql=await readFile(new URL('../supabase/migrations/20261026210512_realtime_messaging_and_studio.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 assert.deepEqual((await db.query('SELECT * FROM messages')).rows,before)
 assert.equal((await db.query("SELECT count(*)::INTEGER AS n FROM pg_publication_tables WHERE pubname='supabase_realtime'")).rows[0].n,8)
 await db.exec('SET ROLE authenticated')
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(10)])
 assert.equal((await db.query('SELECT * FROM messages')).rows.length,1)
 await assert.rejects(db.query('UPDATE conversations SET participant_2=$1',[id(12)]),/permission denied/)
 await assert.rejects(db.query('INSERT INTO messages(id,conversation_id,sender_id,content) VALUES($1,$2,$3,$4)',[id(2),id(20),id(10),'Bypass']),/permission denied/)
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(12)])
 assert.equal((await db.query('SELECT * FROM messages')).rows.length,0)
 await db.exec('RESET ROLE;ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;')
 await assert.rejects(db.exec(sql),/RLS is disabled/)
 await db.exec('ROLLBACK;')
 assert.deepEqual((await db.query('SELECT * FROM messages')).rows,before)
})

test('message catch-up covers a full page of equal timestamps without losing the next page',async t=>{
 const db=await PGlite.create();t.after(()=>db.close())
 await db.exec('CREATE TABLE messages(id UUID PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL);')
 for(let n=1;n<=150;n++)await db.query('INSERT INTO messages VALUES($1,$2)',[id(n),'2026-10-26T12:00:00.123456Z'])
 const page=(after,afterId)=>db.query('SELECT id,created_at::TEXT AS created_at FROM messages WHERE (created_at,id)>($1::TIMESTAMPTZ,$2::UUID) ORDER BY created_at,id LIMIT 100',[after,afterId])
 const first=(await page('2026-10-26T12:00:00.123455Z',id(0))).rows
 assert.equal(first.length,100)
 const last=first.at(-1)
 const second=(await page(last.created_at,last.id)).rows
 assert.equal(second.length,50)
 assert.equal(new Set([...first,...second].map(row=>row.id)).size,150)
 assert.equal((await page(second.at(-1).created_at,second.at(-1).id)).rows.length,0)
})
