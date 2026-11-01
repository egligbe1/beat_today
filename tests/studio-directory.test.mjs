import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {marketplaceFixture} from './helpers/marketplace-fixture.mjs'
import {collectiveDestination,directoryFilters,directoryUrl} from '../lib/studio/directory.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('collective CTA takes signed-in artists to producers, never producer signup or role conversion',()=>{
 assert.equal(collectiveDestination(true,'artist'),'/producers');assert.equal(collectiveDestination(true,'producer'),'/dashboard/studio')
 assert.match(collectiveDestination(false),/^\/signup\?role=producer/)
 assert.equal(collectiveDestination(true,null),'/complete-profile')
 const filters=directoryFilters({q:'  Studio  ',service:'mixing',page:'-1'});assert.equal(filters.q,'Studio');assert.equal(filters.page,1);assert.equal(filters.service,'MIXING');assert.equal(directoryUrl(filters,2),'/producers?q=Studio&service=MIXING&page=2')
})
test('anonymous directory lists only published PRO studios with usable services and exposes no private scheduling data',async t=>{
 const db=await marketplaceFixture(t)
 for(const file of ['20261026164028_studio_workspace.sql','20261026171617_studio_bookings.sql','20261101161604_public_studio_directory.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 for(let n=1;n<=16;n++){
  const uid=id(n),studio=id(100+n),room=id(200+n)
  await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[uid,uid+'@example.invalid',{role:'producer',full_name:'Producer '+String(n).padStart(2,'0')}])
  await db.query('UPDATE users_profiles SET handle=$1,display_name=$2,country=$3 WHERE id=$4',['producer'+n,'Producer '+String(n).padStart(2,'0'),'Ghana',uid])
  await db.query("UPDATE producer_settings SET subscription_tier='PRO',subscription_active=true,subscription_expires_at=now()+interval '1 month' WHERE user_id=$1",[uid])
  await db.query("INSERT INTO studio_workspaces(id,owner_id,name,city,timezone) VALUES($1,$2,'Studio','Accra','Africa/Accra')",[studio,uid])
  await db.query('INSERT INTO studio_booking_settings(studio_id,is_public) VALUES($1,true)',[studio])
  await db.query("INSERT INTO studio_rooms(id,studio_id,name) VALUES($1,$2,'Private Room')",[room,studio])
  await db.query("INSERT INTO studio_session_services(room_id,title,service_type,price_minor,duration_minutes,buffer_minutes) VALUES($1,'Record vocals','RECORDING',20000,60,15)",[room])
  await db.query("INSERT INTO studio_opening_hours(room_id,weekday,opens,closes,closed) VALUES($1,1,'09:00','18:00',false)",[room])
 }
 await db.query('UPDATE studio_booking_settings SET is_public=false WHERE studio_id=$1',[id(101)])
 await db.query("UPDATE producer_settings SET subscription_expires_at=now()-interval '1 day' WHERE user_id=$1",[id(2)])
 await db.query("UPDATE studio_opening_hours SET closes='09:30' WHERE room_id=$1",[id(203)])
 await db.exec('SET ROLE anon')
 const page=async number=>(await db.query("SELECT studio_booking_directory('','','RECORDING',$1) result",[number])).rows[0].result
 const first=await page(1),second=await page(2)
 assert.equal(first.total,13);assert.equal(first.items.length,12);assert.equal(second.items.length,1)
 assert.equal(new Set([...first.items,...second.items].map(item=>item.id)).size,13)
 assert.equal(first.items.some(item=>['producer1','producer2','producer3'].includes(item.handle)),false)
 assert.equal(first.items[0].from_minor,20000)
 const serialized=JSON.stringify(first)
 for(const privateField of ['owner_id','room_id','artist_id','notes','opens','closes','email','bank_details'])assert.equal(serialized.includes('"'+privateField+'"'),false)
 await assert.rejects(db.query('SELECT * FROM studio_time_blocks'),/permission denied/)
 assert.equal((await db.query("SELECT studio_booking_directory('no match','',NULL,1) result")).rows[0].result.total,0)
 await assert.rejects(db.query("SELECT studio_booking_directory('','','bad',1)"),/Invalid directory filters/)
})
