import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('proposed messaging migration preserves history, enforces caller identity and commits retries exactly once',async t=>{
 const db=await PGlite.create();t.after(()=>db.close())
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE users_profiles(id UUID PRIMARY KEY,display_name TEXT);
 CREATE TABLE conversations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),participant_1 UUID REFERENCES users_profiles(id),participant_2 UUID REFERENCES users_profiles(id),last_message_at TIMESTAMPTZ DEFAULT now(),created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(participant_1,participant_2));
 CREATE TABLE messages(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id UUID REFERENCES conversations(id),sender_id UUID REFERENCES users_profiles(id),content TEXT,is_read BOOLEAN DEFAULT false,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE notifications(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID REFERENCES users_profiles(id),type TEXT,title TEXT,body TEXT,link TEXT,is_read BOOLEAN DEFAULT false,metadata JSONB,created_at TIMESTAMPTZ DEFAULT now());
 ALTER TABLE messages ENABLE ROW LEVEL SECURITY;ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;`)
 for(let n=1;n<=3;n++)await db.query('INSERT INTO users_profiles VALUES($1,$2)',[id(n),'Artist '+n])
 await db.query('INSERT INTO conversations(id,participant_1,participant_2) VALUES($1,$2,$3)',[id(20),id(1),id(2)])
 await db.query('INSERT INTO messages(id,conversation_id,sender_id,content) VALUES($1,$2,$3,$4)',[id(21),id(20),id(1),'Existing history'])
 const marketplace=await readFile(new URL('../supabase/migrations/20261026154145_marketplace_integrity.sql',import.meta.url),'utf8')
 await db.exec('CREATE TABLE request_limits(key TEXT PRIMARY KEY,hits INT,expires_at TIMESTAMPTZ)')
 await db.exec(marketplace.match(/CREATE OR REPLACE FUNCTION public.consume_request_limit[\s\S]*?\$\$;/)[0])
 const before=(await db.query('SELECT * FROM messages')).rows
 const sql=await readFile(new URL('../supabase/migrations/20261101113000_idempotent_messages.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 assert.deepEqual((await db.query('SELECT id,conversation_id,sender_id,content,is_read,created_at FROM messages')).rows,before)
 await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(1)])
 const send=(key,content='Hello',conv=id(20),recipient=null)=>db.query('SELECT send_message_once($1,$2,$3,$4) result',[id(key),content,conv,recipient])
 const first=(await send(30)).rows[0].result
 assert.deepEqual((await send(30)).rows[0].result,first)
 await assert.rejects(send(30,'Edited retry'),/Request key already used/)
 await send(31) // Identical text with a NEW key is an intentional second message.
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(3)])
 await assert.rejects(send(32),/Conversation not found/)
 await assert.rejects(db.query('INSERT INTO messages(content) VALUES($1)',['Bypass']),/permission denied/)
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(1)])
 await assert.rejects(send(33,'Self',null,id(1)),/Invalid message/)
 await send(34,'New conversation',null,id(3));await send(34,'New conversation',null,id(3))
 await db.exec('RESET ROLE')
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM messages')).rows[0].n,4)
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM notifications')).rows[0].n,3)
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM conversations')).rows[0].n,2)
 // A notification failure must roll back the message as well.
 await db.exec("ALTER TABLE notifications ADD CONSTRAINT reject_test CHECK(body NOT LIKE '%atomic-failure%')")
 await db.exec('SET ROLE authenticated')
 await assert.rejects(send(35,'atomic-failure'),/reject_test/)
 await db.exec('RESET ROLE')
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM messages')).rows[0].n,4)
 await db.query('UPDATE request_limits SET hits=30 WHERE key=$1',['send-message:'+id(1)])
 await db.exec('SET ROLE authenticated')
 await assert.rejects(send(36),/Please wait/)
 await db.exec('RESET ROLE')
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM messages')).rows[0].n,4)
 await db.exec('SET ROLE anon')
 await assert.rejects(send(36),/permission denied/)
})
