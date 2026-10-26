import { bookingDate } from '../lib/studio/booking.ts'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const owner=id(1),artist=id(2),second=id(3),stranger=id(4)
test('booking-first workflow with conflict, privacy and agreement guards',async t=>{
 const db=await PGlite.create();t.after(()=>db.close())
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID$$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated;
 CREATE TABLE users_profiles(id UUID PRIMARY KEY,handle TEXT UNIQUE,display_name TEXT,role TEXT);
 CREATE TABLE producer_settings(user_id UUID PRIMARY KEY,subscription_tier TEXT,subscription_expires_at TIMESTAMPTZ,subscription_active BOOLEAN);
 CREATE TABLE notifications(id UUID DEFAULT gen_random_uuid(),user_id UUID,type TEXT,title TEXT,body TEXT,link TEXT);
 CREATE FUNCTION active_tier(p UUID) RETURNS TEXT LANGUAGE sql STABLE AS $$SELECT COALESCE((SELECT CASE WHEN subscription_expires_at>now() AND subscription_active THEN subscription_tier ELSE 'FREE' END FROM producer_settings WHERE user_id=p),'FREE')$$;
 CREATE FUNCTION consume_request_limit(TEXT,INTEGER,INTEGER) RETURNS BOOLEAN LANGUAGE sql AS $$SELECT true$$;
 REVOKE ALL ON FUNCTION active_tier(UUID),consume_request_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC;
 GRANT SELECT ON users_profiles TO authenticated;
 `)
 for(const [uid,handle,role]of[[owner,'producer','producer'],[artist,'artist','artist'],[second,'second','artist'],[stranger,'stranger','artist']])await db.query('INSERT INTO users_profiles VALUES($1,$2,$2,$3)',[uid,handle,role])
 await db.query("INSERT INTO producer_settings VALUES($1,'PRO',now()+interval '1 year',true)",[owner])
 for(const name of ['20261026164028_studio_workspace.sql','20261026171617_studio_bookings.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
 async function as(uid,fn,role='authenticated'){await db.exec(`SET ROLE ${role}`);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid||'']);try{return await fn()}finally{await db.exec('RESET ROLE')}}
 const command=(uid,action,payload)=>as(uid,async()=>{const r=await db.query('SELECT studio_booking_command($1,$2) AS r',[action,payload]);return r.rows[0].r})
 const core=(uid,action,payload,project=null)=>as(uid,async()=>{const r=await db.query('SELECT studio_command($1,$2,$3) AS r',[action,project,payload]);return r.rows[0].r})
 const catalog=(uid=null)=>as(uid,async()=>(await db.query("SELECT studio_booking_catalog('producer') AS c")).rows[0].c,uid?'authenticated':'anon')
 const slots=(service,day)=>as(null,async()=>(await db.query('SELECT studio_booking_slots($1,$2) AS s',[service,day])).rows[0].s,'anon')
 const row=async(table,uid)=>(await db.query(`SELECT * FROM ${table} WHERE id=$1`,[uid])).rows[0]
 const studio=(await core(owner,'create_studio',{name:'Booking Studio',city:'Accra',timezone:'Africa/Accra'})).id
 let room,service,day,available,first,competing,project
 const terms={scope:'A focused recording and vocal production session.',deliverables:'Recorded vocals and stereo rough mix. Two revision rounds.',timeline:'One studio session at the reserved time, Africa/Accra.',payment_terms:'No payment is collected by this test booking flow.',rights:'Artist retains recording ownership; beat licensing is separate.',cancellation:'Session changes require notice and confirmation by both parties.',total_minor:20000,deposit_minor:0,revision_rounds:2,expected_version:0,confirmed:true}
 await t.test('configure rooms, hours and services; unpublished catalog remains private',async()=>{
  assert.equal(await catalog(),null)
  await assert.rejects(command(artist,'create_room',{name:'Intruder room'}),/ownership/)
  room=(await command(owner,'create_room',{name:'Main Room'})).id
  service=(await command(owner,'create_service',{room_id:room,title:'Vocal session',description:'Recording and vocal production.',duration_minutes:60,buffer_minutes:15,price_minor:20000,service_type:'RECORDING'})).id
  await command(owner,'save_hours',{room_id:room,weekly:Array.from({length:7},(_,weekday)=>({weekday,opens:'09:00',closes:'18:00',closed:false}))})
  assert.equal(await catalog(),null)
  assert.equal(await catalog(artist),null)
  assert.equal((await catalog(owner)).is_public,false)
  await command(owner,'publish',{is_public:true,notice_hours:0,horizon_days:90})
  const c=await catalog();assert.equal(c.services[0].price_minor,20000);assert.equal(c.name,'Booking Studio');assert.equal(c.notes,undefined)
  assert.deepEqual(await catalog(artist),c)
  await command(owner,'toggle_service',{service_id:service,is_active:false})
  assert.equal((await catalog()).services.length,0)
  assert.equal((await catalog(artist)).services.length,0)
  await command(owner,'toggle_service',{service_id:service,is_active:true})
  day=(await db.query("SELECT ((now() AT TIME ZONE 'Africa/Accra')::DATE+2)::TEXT AS day")).rows[0].day
  available=await slots(service,day);assert.ok(available.length>5)
  assert.equal(new Date(available[0]).getUTCHours(),9);assert.equal(new Date(available[0]).getUTCMinutes(),15)
  assert.deepEqual(await slots(service,'2000-01-01'),[])
 })
 await t.test('requests snapshot server pricing and remain non-exclusive until reservation',async()=>{
  first=(await command(artist,'request',{service_id:service,starts_at:available[0],notes:'Recording two songs.',price_minor:1})).id
  competing=(await command(second,'request',{service_id:service,starts_at:available[0],notes:'Another artist requesting the same time.'})).id
  assert.equal((await row('studio_bookings',first)).service_snapshot.price_minor,20000)
  assert.equal((await row('studio_bookings',first)).project_id,null)
  await assert.rejects(command(artist,'request',{service_id:service,starts_at:available[0],notes:'Duplicate request.'}),/duplicate key/)
  await assert.rejects(command(artist,'request',{service_id:service,starts_at:day+'T09:17:00Z',notes:'Invalid grid time.'}),/no longer available/)
 })
 await t.test('reservation creates one linked project and rejects competing or buffered overlap',async()=>{
  const r=await command(owner,'reserve',{booking_id:first});project=r.project_id;assert.ok(project)
  const again=await command(owner,'reserve',{booking_id:first});assert.equal(again.project_id,project)
  assert.equal(Number((await db.query('SELECT count(*) FROM studio_projects')).rows[0].count),1)
  await assert.rejects(command(owner,'reserve',{booking_id:competing}),/already taken/)
  const current=await slots(service,day);assert.ok(!current.includes(available[0]));assert.ok(!current.includes(available[1]));assert.ok(!current.includes(available[2]));assert.ok(current.includes(available[3]))
  await assert.rejects(command(artist,'reserve',{booking_id:competing}),/unavailable/)
 })
 await t.test('agreement acceptance confirms the session atomically',async()=>{
  await core(owner,'publish_agreement',terms,project)
  const a=(await db.query('SELECT * FROM studio_agreements WHERE project_id=$1',[project])).rows[0]
  await core(artist,'accept_agreement',{agreement_id:a.id,content_hash:a.content_hash,confirmed:true},project)
  assert.equal((await row('studio_bookings',first)).status,'CONFIRMED')
  await assert.rejects(command(owner,'complete',{booking_id:first}),/finished confirmed/)
  await assert.rejects(command(owner,'block_time',{room_id:room,starts_local:day+'T09:00',ends_local:day+'T10:30',reason:'Maintenance'}),/overlaps/)
 })
 await t.test('manual bookings support independent rooms and cancelled reservations cannot be confirmed later',async()=>{
  const room2=(await command(owner,'create_room',{name:'Mix Room'})).id
  await command(owner,'save_hours',{room_id:room2,weekly:Array.from({length:7},(_,weekday)=>({weekday,opens:'09:00',closes:'18:00',closed:false}))})
  const service2=(await command(owner,'create_service',{room_id:room2,title:'Mix review session',duration_minutes:60,buffer_minutes:15,price_minor:25000,service_type:'MIXING'})).id
  const result=await command(owner,'manual_booking',{service_id:service2,starts_at:available[0],artist_handle:'second',notes:'A separate room at the same time.'})
  assert.ok(result.project_id);assert.equal((await row('studio_projects',result.project_id)).service_type,'MIXING')
  await core(owner,'publish_agreement',terms,result.project_id)
  const a=(await db.query('SELECT * FROM studio_agreements WHERE project_id=$1',[result.project_id])).rows[0]
  await command(owner,'cancel',{booking_id:result.id,reason:'The artist requested a different date.'})
  await assert.rejects(core(second,'accept_agreement',{agreement_id:a.id,content_hash:a.content_hash,confirmed:true},result.project_id),/booking was cancelled/)
  assert.equal((await row('studio_agreements',a.id)).status,'SENT')
 })
 await t.test('changing opening hours preserves confirmed sessions and closes public availability',async()=>{
  await command(owner,'save_hours',{room_id:room,weekly:Array.from({length:7},(_,weekday)=>({weekday,opens:'09:00',closes:'18:00',closed:true}))})
  assert.deepEqual(await slots(service,day),[])
  assert.equal((await row('studio_bookings',first)).status,'CONFIRMED')
  await command(owner,'save_hours',{room_id:room,weekly:Array.from({length:7},(_,weekday)=>({weekday,opens:'09:00',closes:'18:00',closed:false}))})
 })
 await t.test('calendar blocks are private, removable without deleting history, and enforced',async()=>{
  const block=(await command(owner,'block_time',{room_id:room,starts_local:day+'T15:00',ends_local:day+'T18:00',reason:'Private maintenance notes'})).id
  const current=await slots(service,day);assert.ok(current.every(x=>new Date(x).getUTCHours()<15))
  await as(stranger,async()=>{
   for(const table of ['studio_bookings','studio_rooms','studio_time_blocks','studio_booking_settings','studio_session_services','studio_opening_hours'])assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,0)
   await assert.rejects(db.query("UPDATE studio_bookings SET status='CONFIRMED'"),/permission denied/)
  })
  await as(null,async()=>{await assert.rejects(db.query('SELECT * FROM studio_bookings'),/permission denied/);await assert.rejects(db.query("SELECT studio_booking_command('reserve','{}')"),/permission denied/)},'anon')
  await command(owner,'unblock_time',{room_id:room,block_id:block});assert.equal((await row('studio_time_blocks',block)).is_active,false)
  assert.ok((await slots(service,day)).some(x=>new Date(x).getUTCHours()>=15))
 })
 await t.test('late agreement acceptance cannot revive an expired reservation or take another artist’s slot',async()=>{
  const time=(await slots(service,day))[0]
  const original=(await command(artist,'request',{service_id:service,starts_at:time,notes:'An additional session.'})).id
  const oldProject=(await command(owner,'reserve',{booking_id:original})).project_id
  await core(owner,'publish_agreement',terms,oldProject)
  const a=(await db.query('SELECT * FROM studio_agreements WHERE project_id=$1',[oldProject])).rows[0]
  await db.query("UPDATE studio_bookings SET reserved_until=now()-interval '1 minute' WHERE id=$1",[original])
  const replacement=(await command(second,'request',{service_id:service,starts_at:time,notes:'Taking the newly available slot.'})).id
  await command(owner,'reserve',{booking_id:replacement})
  await assert.rejects(core(artist,'accept_agreement',{agreement_id:a.id,content_hash:a.content_hash,confirmed:true},oldProject),/reservation expired/)
  assert.equal((await row('studio_agreements',a.id)).status,'SENT')
  assert.equal((await row('studio_projects',oldProject)).active_agreement_id,null)
  assert.equal((await row('studio_bookings',replacement)).status,'RESERVED')
 })
 await t.test('cancellation releases time but retains project, agreement and booking history',async()=>{
  await assert.rejects(command(artist,'withdraw',{booking_id:first,reason:'I changed my mind.'}),/pending request/)
  await command(owner,'cancel',{booking_id:first,reason:'Rescheduling agreed with the artist.'})
  assert.equal((await row('studio_bookings',first)).status,'CANCELLED')
  assert.ok((await row('studio_projects',project)).active_agreement_id)
  assert.ok((await slots(service,day)).includes(available[0]))
  await command(second,'withdraw',{booking_id:competing,reason:'Choosing a different session.'})
 })
 await t.test('PRO expiry closes public intake without removing booking history',async()=>{
  await db.query("UPDATE producer_settings SET subscription_expires_at=now()-interval '1 day' WHERE user_id=$1",[owner])
  assert.equal(await catalog(),null);assert.equal(await catalog(artist),null);assert.deepEqual(await slots(service,day),[])
  await assert.rejects(command(owner,'create_room',{name:'Extra room'}),/PRO/)
  await as(artist,async()=>assert.ok((await db.query('SELECT * FROM studio_bookings')).rows.length>0))
 })
})


test('repeated daylight-saving times remain distinguishable in booking labels',()=>{
 const first=bookingDate('2026-11-01T05:15:00Z','America/New_York',true)
 const repeated=bookingDate('2026-11-01T06:15:00Z','America/New_York',true)
 assert.notEqual(first,repeated)
 assert.match(first,/01:15/);assert.match(repeated,/01:15/)
})
