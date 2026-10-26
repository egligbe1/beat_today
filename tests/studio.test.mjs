import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { priceToMinor } from '../lib/studio/domain.ts'
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const owner=uid(1),artist=uid(2),stranger=uid(3),other=uid(4)

test('studio agreement workflow, permissions and history in isolated PostgreSQL',async t=>{
 const db=await PGlite.create();t.after(()=>db.close())
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE users_profiles(id UUID PRIMARY KEY,handle TEXT UNIQUE,display_name TEXT,role TEXT);
 CREATE TABLE producer_settings(user_id UUID PRIMARY KEY,subscription_tier TEXT,subscription_expires_at TIMESTAMPTZ,subscription_active BOOLEAN);
 CREATE TABLE notifications(id UUID DEFAULT gen_random_uuid(),user_id UUID,type TEXT,title TEXT,body TEXT,link TEXT);
 CREATE TABLE wallets(producer_id UUID PRIMARY KEY,pending_balance NUMERIC,available_balance NUMERIC);
 CREATE FUNCTION public.active_tier(p_user UUID) RETURNS TEXT LANGUAGE sql STABLE AS $$SELECT COALESCE((SELECT CASE WHEN subscription_active IS TRUE AND subscription_expires_at>now() THEN subscription_tier ELSE 'FREE' END FROM producer_settings WHERE user_id=p_user),'FREE')$$;
 CREATE FUNCTION public.consume_request_limit(TEXT,INTEGER,INTEGER) RETURNS BOOLEAN LANGUAGE sql AS $$SELECT true$$;
 REVOKE ALL ON FUNCTION active_tier(UUID),consume_request_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC;
 GRANT SELECT ON users_profiles TO authenticated;
 `)
 for(const [id,handle,role] of [[owner,'producer','producer'],[artist,'artist','artist'],[stranger,'stranger','artist'],[other,'other','producer']]) await db.query('INSERT INTO users_profiles VALUES($1,$2,$2,$3)',[id,handle,role])
 await db.query("INSERT INTO producer_settings VALUES($1,'PRO',now()+interval '1 year',true),($2,'FREE',NULL,false)",[owner,other])
 await db.query('INSERT INTO wallets VALUES($1,100,50)',[owner])
 await db.exec(await readFile(new URL('../supabase/migrations/20261026164028_studio_workspace.sql',import.meta.url),'utf8'))
 async function as(user,fn){await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);try{return await fn()}finally{await db.exec('RESET ROLE')}}
 const command=async(user,action,payload={},project=null)=>as(user,async()=>{const r=await db.query('SELECT studio_command($1,$2,$3) AS r',[action,project,payload]);return r.rows[0].r})
 const get=async(table,id)=> (await db.query(`SELECT * FROM ${table} WHERE id=$1`,[id])).rows[0]
 const terms={scope:'Mix and master two original songs.',deliverables:'Two stereo WAV masters and instrumental mixes. Two rounds of revisions.',timeline:'First mix by 30 November, final delivery by 15 December. Africa/Accra.',payment_terms:'30 percent deposit before work. Balance after approval before final delivery.',rights:'Artist retains recording ownership. Producer receives the agreed production credit.',cancellation:'Rescheduling requires agreement by both parties. Refund requests are reviewed.',total_minor:100000,deposit_minor:30000,revision_rounds:2,confirmed:true,expected_version:0}
 let project,first,second
 await t.test('PRO creation restrictions and timezone validation',async()=>{
  await assert.rejects(command(other,'create_studio',{name:'Other',timezone:'Africa/Accra'}),/PRO/)
  await assert.rejects(command(owner,'create_studio',{name:'Studio',timezone:'Invalid/Place'}),/timezone/)
  await command(owner,'create_studio',{name:'Test Studio',city:'Accra',timezone:'Africa/Accra'})
  await assert.rejects(command(owner,'create_project',{artist_handle:'producer',title:'Self',brief:'A self project brief',service_type:'MIXING'}),/another registered/)
  project=(await command(owner,'create_project',{artist_handle:'@artist',title:'Artist EP',brief:'Mixing and mastering two tracks.',service_type:'MIXING'})).id
 })
 await t.test('RLS isolates projects, agreements, events and workspace; direct writes denied',async()=>{
  await as(artist,async()=>assert.equal((await db.query('SELECT * FROM studio_projects')).rows.length,1))
  await as(stranger,async()=>{
   for(const table of ['studio_workspaces','studio_projects','studio_agreements','studio_project_events','studio_project_milestones']) assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,0)
   await assert.rejects(db.query('UPDATE studio_projects SET title=\'stolen\''),/permission denied/)
  })
  await assert.rejects(command(stranger,'message',{message:'An intruder message'},project),/unavailable/)
  await db.exec('SET ROLE anon');try{await assert.rejects(db.query('SELECT * FROM studio_projects'),/permission denied/);await assert.rejects(db.query("SELECT studio_command('create_studio',NULL,'{}')"),/permission denied/)}finally{await db.exec('RESET ROLE')}
 })
 await t.test('milestones freeze into published terms; exact price and sender confirmation enforced',async()=>{
  await command(owner,'add_milestone',{title:'First mixes',due_date:'2026-11-30'},project)
  await assert.rejects(command(owner,'publish_agreement',{...terms,confirmed:false},project),/Confirm/)
  await assert.rejects(command(owner,'publish_agreement',{...terms,deposit_minor:100001},project),/price/)
  await assert.rejects(command(owner,'publish_agreement',{...terms,rights:''},project),/rights/)
  await assert.rejects(command(artist,'publish_agreement',terms,project),/Only the producer/)
  await command(owner,'publish_agreement',terms,project)
  first=(await db.query('SELECT * FROM studio_agreements WHERE project_id=$1 ORDER BY version DESC',[project])).rows[0]
  assert.equal(first.terms.milestones[0].title,'First mixes');assert.equal(first.content_hash.length,64)
  assert.equal(first.status,'SENT');assert.equal(first.artist_accepted_at,null)
  await assert.rejects(command(owner,'add_milestone',{title:'Silent extra work'},project),/frozen/)
  await assert.rejects(command(owner,'set_status',{status:'IN_PRODUCTION'},project),/accepted agreement/)
 })
 await t.test('artist requests changes; publishing a replacement never edits prior terms',async()=>{
  await assert.rejects(command(artist,'request_changes',{agreement_id:first.id,content_hash:'outdated',message:'Please change the delivery date'},project),/changed/)
  await command(artist,'request_changes',{agreement_id:first.id,content_hash:first.content_hash,message:'Please include an extra instrumental version.'},project)
  await assert.rejects(command(owner,'publish_agreement',{...terms,expected_version:0},project),/Refresh/)
  await command(owner,'publish_agreement',{...terms,expected_version:1,deliverables:'Two stereo WAV masters and additional instrumental mixes.'},project)
  second=(await db.query('SELECT * FROM studio_agreements WHERE project_id=$1 ORDER BY version DESC',[project])).rows[0]
  assert.equal((await get('studio_agreements',first.id)).terms.deliverables,first.terms.deliverables)
  assert.equal((await get('studio_agreements',first.id)).status,'CHANGES_REQUESTED')
 })
 await t.test('only the artist accepts the exact current version; replay does not add events',async()=>{
  await assert.rejects(command(owner,'accept_agreement',{agreement_id:second.id,content_hash:second.content_hash,confirmed:true},project),/Only the artist/)
  await assert.rejects(command(artist,'accept_agreement',{agreement_id:first.id,content_hash:first.content_hash,confirmed:true},project),/no longer/)
  await assert.rejects(command(artist,'accept_agreement',{agreement_id:second.id,content_hash:'wrong',confirmed:true},project),/changed/)
  await assert.rejects(command(artist,'accept_agreement',{agreement_id:second.id,content_hash:second.content_hash,confirmed:false},project),/Confirm/)
  const accept={agreement_id:second.id,content_hash:second.content_hash,confirmed:true}
  await command(artist,'accept_agreement',accept,project)
  const before=Number((await db.query('SELECT count(*) FROM studio_project_events')).rows[0].count)
  await command(artist,'accept_agreement',accept,project)
  assert.equal(Number((await db.query('SELECT count(*) FROM studio_project_events')).rows[0].count),before)
  assert.equal((await get('studio_projects',project)).active_agreement_id,second.id)
  assert.equal((await get('studio_projects',project)).status,'AGREED')
 })
 await t.test('amendments keep active accepted terms until the artist accepts replacement',async()=>{
  await command(owner,'publish_agreement',{...terms,expected_version:2,total_minor:120000},project)
  const third=(await db.query('SELECT * FROM studio_agreements WHERE project_id=$1 ORDER BY version DESC',[project])).rows[0]
  assert.equal((await get('studio_projects',project)).active_agreement_id,second.id)
  assert.equal((await get('studio_agreements',second.id)).terms.total_minor,100000)
  await command(artist,'accept_agreement',{agreement_id:third.id,content_hash:third.content_hash,confirmed:true},project)
  assert.equal((await get('studio_projects',project)).active_agreement_id,third.id)
  assert.equal((await get('studio_agreements',second.id)).status,'ACCEPTED')
 })
 await t.test('PRO expiry blocks new business but preserves collaboration and commitments',async()=>{
  await db.query("UPDATE producer_settings SET subscription_expires_at=now()-interval '1 day' WHERE user_id=$1",[owner])
  await assert.rejects(command(owner,'create_project',{artist_handle:'artist',title:'New',brief:'Another creative project',service_type:'MIXING'}),/PRO/)
  await command(owner,'message',{message:'Production continues on the agreed scope.'},project)
  await command(artist,'message',{message:'Thanks, I will review the next mix.'},project)
  await command(owner,'set_status',{status:'IN_PRODUCTION'},project)
  await command(owner,'publish_agreement',{...terms,expected_version:3,total_minor:125000},project)
  const milestone=(await db.query('SELECT * FROM studio_project_milestones WHERE project_id=$1',[project])).rows[0]
  await command(owner,'complete_milestone',{milestone_id:milestone.id},project)
  assert.ok((await get('studio_project_milestones',milestone.id)).completed_at)
  await assert.rejects(command(artist,'complete_milestone',{milestone_id:milestone.id},project),/producer access/)
  await as(stranger,async()=>{
   for(const table of ['studio_agreements','studio_project_events','studio_project_milestones'])assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,0)
  })
  assert.deepEqual((await db.query('SELECT pending_balance,available_balance FROM wallets')).rows,[{pending_balance:'100',available_balance:'50'}])
 })
})

test('studio price conversion uses exact minor units and rejects invalid values',()=>{
 assert.equal(priceToMinor('10.29'),1029);assert.equal(priceToMinor('0.01'),1);assert.equal(priceToMinor('0'),0)
 for(const value of ['-1','NaN','Infinity','1.001','1e3','10x','1000001']) assert.throws(()=>priceToMinor(value))
})

test('studio agreement PDF retains long terms and confirmation evidence across pages',async()=>{
 const React=await import('react')
 const {renderToBuffer}=await import('@react-pdf/renderer')
 const {default:AgreementPDF}=await import('../components/studio/AgreementPDF.tsx')
 const long='Detailed agreed production conditions. '.repeat(110)
 const a={id:uid(50),project_id:uid(51),version:2,status:'ACCEPTED',content_hash:'a'.repeat(64),producer_accepted_at:'2026-10-26T12:00:00Z',artist_accepted_at:'2026-10-26T13:00:00Z',created_at:'2026-10-26T12:00:00Z',changes_requested:null,terms:{scope:long,deliverables:long,timeline:long,payment_terms:long,rights:long,cancellation:long,total_minor:30000,deposit_minor:10000,currency:'GHS',revision_rounds:2,project_title:'Agreement test',producer_id:owner,artist_id:artist,producer_name:'Producer',artist_name:'Artist',studio_name:'Studio',milestones:[]}}
 const pdf=await renderToBuffer(React.createElement(AgreementPDF,{agreement:a}))
 assert.equal(pdf.subarray(0,4).toString(),'%PDF')
 assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1)
})
