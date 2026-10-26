import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
const root = new URL('../supabase/migrations/',import.meta.url)
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const buyer=id(1),producer=id(2),second=id(3),collab=id(4)
test('marketplace integrity in a disposable PostgreSQL database',async t=>{
  const {PGlite}=await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite')
  const db=await PGlite.create();t.after(()=>db.close())
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT current_setting('role',true) $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN);
    CREATE TABLE storage.objects(id UUID,bucket_id TEXT,owner UUID);
  `)
  for(const file of ['001_core_identity.sql','002_catalog_and_storage.sql','003_financial_engine.sql','004_marketplace_and_licenses.sql','005_engagement_and_optimization.sql','006_permissions_and_sync.sql','007_status_alignment.sql','009_create_search_view.sql','010_add_subscription_reference.sql','015_rename_reviews_table.sql','016_auto_producer_settings.sql','017_add_updated_at_reviews.sql','018_unique_reviews.sql','029_collaborated_splits.sql','030_negotiations.sql','031_producer_services.sql','032_email_gates.sql','033_beat_comments.sql','035_perf_denormalization.sql','036_fix_auth_onboarding.sql','037_ensure_play_count_permissions.sql','038_financial_and_security_hardening.sql','039_restrict_financial_access.sql','20261026154145_marketplace_integrity.sql']) {
    try {await db.exec(await readFile(new URL(file,root),'utf8'))}catch(e){throw new Error(`${file}: ${e.message}`,{cause:e})}
  }
  for(const [uid,role] of [[buyer,'artist'],[producer,'producer'],[second,'producer'],[collab,'producer']]) await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[uid,`${uid}@example.invalid`,{role,full_name:role}])
  const defaults={}
  for(const kind of ['mp3','wav','trackout','exclusive'])defaults[kind]={contract_text:`${kind} license for {{TRACK_TITLE}} by {{PRODUCER_NAME}} to {{BUYER_NAME}}. {{STREAM_LIMIT}} streams. {{DATE}}`,streaming_limit:kind==='exclusive'?0:50000,music_video_limit:1,radio_broadcasting:false}
  let serial=20
  async function beat(owner=producer,price=10){const bid=id(serial++);await db.query("INSERT INTO public.beats(id,producer_id,title,status,price_mp3,price_exclusive,file_mp3_url) VALUES($1,$2,'Test Beat','active',$3,100,$4)",[bid,owner,price,`masters/${owner}/${bid}-v1.mp3`]);return bid}
  async function checkout(items,promo=null,offer=null){const ref=`test-${serial++}`;const {rows}=await db.query('SELECT public.prepare_checkout($1,$2,$3,10,$4,$5,$6) AS c',[buyer,items,ref,defaults,promo,offer]);return {...rows[0].c,ref}}
  async function settle(c,amount=c.expected_minor){return db.query("SELECT public.settle_order($1,$2,$3,'GHS')",[c.order_id,c.ref,amount])}
  async function as(uid,fn){await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);try{return await fn()}finally{await db.exec('RESET ROLE')}}
  const balance=async(uid)=>Number((await db.query('SELECT pending_balance FROM public.wallets WHERE producer_id=$1',[uid])).rows[0]?.pending_balance||0)

  await t.test('atomic settlement validates exact payment and credits only once',async()=>{
    const b=await beat();const c=await checkout([{beat_id:b,license_type:'mp3'}])
    await assert.rejects(settle(c,c.expected_minor-1),/amount\/currency/)
    assert.equal(await balance(producer),0)
    assert.equal((await db.query('SELECT status FROM orders WHERE id=$1',[c.order_id])).rows[0].status,'pending')
    await settle(c);await settle(c)
    assert.equal(await balance(producer),80)
    assert.equal(Number((await db.query('SELECT count(*) FROM order_item_licenses')).rows[0].count),1)
    assert.equal(Number((await db.query('SELECT count(*) FROM delivery_jobs')).rows[0].count),1)
  })
  await t.test('failed settlement rolls back money, licenses and order state together',async()=>{
    const b=await beat();const c=await checkout([{beat_id:b,license_type:'mp3'}]);const before=await balance(producer)
    // Force a license write failure after the financial statements.
    await db.exec("CREATE FUNCTION public.reject_test_license() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test license failure'; END $$; CREATE TRIGGER reject_test_license BEFORE INSERT ON order_item_licenses FOR EACH ROW EXECUTE FUNCTION public.reject_test_license()")
    await assert.rejects(settle(c),/test license failure/)
    assert.equal(await balance(producer),before)
    assert.equal((await db.query('SELECT status FROM orders WHERE id=$1',[c.order_id])).rows[0].status,'pending')
    // Only a disposable test trigger is removed; no application rows are deleted.
    await db.exec('DROP TRIGGER reject_test_license ON order_item_licenses')
    await settle(c)
  })
  await t.test('exclusive late payment cannot settle after reservation ownership changes',async()=>{
    const b=await beat();const first=await checkout([{beat_id:b,license_type:'exclusive'}])
    await assert.rejects(checkout([{beat_id:b,license_type:'exclusive'}]),/reserved/)
    await db.query("UPDATE beats SET exclusive_reserved_until=now()-interval '1 minute' WHERE id=$1",[b])
    const next=await checkout([{beat_id:b,license_type:'exclusive'}])
    await assert.rejects(settle(first),/Late exclusive/)
    await settle(next)
    assert.deepEqual((await db.query('SELECT status,is_exclusive_sold FROM beats WHERE id=$1',[b])).rows[0],{status:'hidden',is_exclusive_sold:true})
  })
  await t.test('producer promos only discount that seller and honor reserved use limits',async()=>{
    const a=await beat(),b=await beat(second)
    await db.query("INSERT INTO promo_codes(producer_id,code,discount_type,discount_value,max_uses) VALUES($1,'OWNER50','percentage',50,1)",[producer])
    const c=await checkout([{beat_id:a,license_type:'mp3'},{beat_id:b,license_type:'mp3'}],'OWNER50')
    assert.equal(c.total_amount,15)
    await assert.rejects(checkout([{beat_id:a,license_type:'mp3'}],'OWNER50'),/exhausted/)
    const before=await balance(second);await settle(c)
    assert.equal(await balance(second)-before,80)
    assert.equal((await db.query("SELECT uses_count FROM promo_codes WHERE code='OWNER50'")).rows[0].uses_count,1)
  })
  await t.test('collaborator allocation cannot exceed proceeds',async()=>{
    const b=await beat()
    await db.query('INSERT INTO beat_collaborators(beat_id,collaborator_id,split_percentage) VALUES($1,$2,80)',[b,collab])
    await assert.rejects(db.query('INSERT INTO beat_collaborators(beat_id,collaborator_id,split_percentage) VALUES($1,$2,30)',[b,second]),/100 percent/)
    const c=await checkout([{beat_id:b,license_type:'mp3'}]);const before=await balance(collab);await settle(c)
    assert.equal(await balance(collab)-before,64)
  })
  await t.test('zero-total promotions deliver licenses without issuing credits',async()=>{
    const b=await beat();await db.query("INSERT INTO promo_codes(producer_id,code,discount_type,discount_value) VALUES($1,'FULL100','percentage',100)",[producer])
    const c=await checkout([{beat_id:b,license_type:'mp3'}],'FULL100');const before=await balance(producer)
    assert.equal(c.expected_minor,0);await settle(c)
    assert.equal(await balance(producer),before)
    assert.equal((await db.query('SELECT status FROM orders WHERE id=$1',[c.order_id])).rows[0].status,'completed')
  })
  await t.test('offers require the other party to respond and lock an accepted price',async()=>{
    const b=await beat();const offer=id(700)
    await db.query("INSERT INTO offers(id,buyer_id,producer_id,beat_id,license_type,amount) VALUES($1,$2,$3,$4,'mp3',5)",[offer,buyer,producer,b])
    await assert.rejects(db.query("SELECT transition_offer($1,$2,'ACCEPTED',NULL,NULL)",[offer,buyer]),/Wait for producer/)
    await db.query("SELECT transition_offer($1,$2,'COUNTERED',7,NULL)",[offer,producer])
    await db.query("SELECT transition_offer($1,$2,'ACCEPTED',NULL,NULL)",[offer,buyer])
    const c=await checkout([{beat_id:b,license_type:'mp3'}],null,offer)
    assert.equal(c.total_amount,7)
    await assert.rejects(checkout([{beat_id:b,license_type:'mp3'}],null,offer),/in progress/)
    await settle(c)
    assert.equal((await db.query('SELECT status FROM offers WHERE id=$1',[offer])).rows[0].status,'PAID')
  })
  await t.test('rate limits are durable and internal APIs are not browser-callable',async()=>{
    assert.equal((await db.query("SELECT consume_request_limit('test',1,60) AS allowed")).rows[0].allowed,true)
    assert.equal((await db.query("SELECT consume_request_limit('test',1,60) AS allowed")).rows[0].allowed,false)
    await as(buyer,()=>assert.rejects(db.query("SELECT settle_order($1,'forged',1,'GHS')",[id(999)]),e=>e.code==='42501'))
  })
  await t.test('payout attempts survive retry and restore reversals only once',async()=>{
    await db.query('UPDATE wallets SET available_balance=100 WHERE producer_id=$1',[producer])
    const payload={reference:'payout-test',recipient:'RCP_test',currency:'GHS',amount:10000}
    await db.query('SELECT begin_payout($1,100,$2)',[producer,payload])
    assert.equal((await db.query('SELECT begin_payout($1,100,$2) AS id',[producer,{...payload,reference:'another'}])).rows[0].id,null)
    await db.exec("SELECT finish_payout('payout-test','success','TRF_test'); SELECT finish_payout('payout-test','reversed','TRF_test'); SELECT finish_payout('payout-test','reversed','TRF_test')")
    assert.equal(Number((await db.query('SELECT available_balance FROM wallets WHERE producer_id=$1',[producer])).rows[0].available_balance),100)
  })
  await t.test('subscriptions are payment-bound and old callbacks cannot extend expiry',async()=>{
    await db.query("INSERT INTO subscription_payments(reference,user_id,tier,expected_minor) VALUES('subscription-test',$1,'PRO',10000)",[producer])
    await assert.rejects(db.exec("SELECT activate_subscription('subscription-test',1,'GHS',now())"),/mismatch/)
    await db.exec("SELECT activate_subscription('subscription-test',10000,'GHS',now())")
    const before=(await db.query('SELECT subscription_expires_at FROM producer_settings WHERE user_id=$1',[producer])).rows[0].subscription_expires_at
    await db.exec("SELECT activate_subscription('subscription-test',10000,'GHS',now())")
    assert.equal(String((await db.query('SELECT subscription_expires_at FROM producer_settings WHERE user_id=$1',[producer])).rows[0].subscription_expires_at),String(before))
    await db.query("UPDATE producer_settings SET subscription_expires_at=now()-interval '1 day' WHERE user_id=$1",[producer])
    assert.equal((await db.query('SELECT active_tier($1) AS tier',[producer])).rows[0].tier,'FREE')
  })
  await t.test('unverified reviews and nonmember messages are blocked by database policy',async()=>{
    const b=await beat()
    await as(buyer,()=>assert.rejects(db.query('INSERT INTO beat_reviews(beat_id,reviewer_id,rating) VALUES($1,$2,5)',[b,buyer]),e=>e.code==='42501'))
    const conversation=id(900)
    await db.query('INSERT INTO conversations(id,participant_1,participant_2) VALUES($1,$2,$3)',[conversation,producer,second])
    await as(buyer,()=>assert.rejects(db.query("INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,'forged')",[conversation,buyer]),e=>e.code==='42501'))
  })
  await t.test('cross-account asset changes and destructive beat deletion are blocked',async()=>{
    const b=await beat()
    await assert.rejects(db.query('UPDATE beats SET file_mp3_url=$1 WHERE id=$2',[`masters/${second}/stolen.mp3`,b]),/ownership/)
    await assert.rejects(db.query('DELETE FROM beats WHERE id=$1',[b]),/Archive beats/)
    await db.query("UPDATE beats SET status='hidden' WHERE id=$1",[b])
  })
  await t.test('watermark and email workers claim jobs once until their lease expires',async()=>{
    const b=await beat();await db.query('SELECT enqueue_watermark($1,$2)',[b,`masters/${producer}/source.mp3`])
    assert.equal((await db.query('SELECT * FROM claim_watermark_job($1)',[b])).rows.length,1)
    assert.equal((await db.query('SELECT * FROM claim_watermark_job($1)',[b])).rows.length,0)
    await db.query('SELECT enqueue_watermark($1,$2)',[b,`masters/${producer}/replacement.mp3`])
    assert.equal((await db.query('SELECT * FROM claim_watermark_job($1)',[b])).rows.length,1)
    const item=(await db.query('SELECT order_item_id FROM delivery_jobs LIMIT 1')).rows[0].order_item_id
    assert.equal((await db.query('SELECT claim_delivery_job($1) AS claimed',[item])).rows[0].claimed,true)
    assert.equal((await db.query('SELECT claim_delivery_job($1) AS claimed',[item])).rows[0].claimed,false)
  })
  await t.test('anonymous catalog access excludes private master keys',async()=>{
    await db.exec('SET ROLE anon')
    try {
      await db.query('SELECT id,title FROM beats LIMIT 1')
      await db.query('SELECT * FROM search_catalog LIMIT 1')
      await db.query('SELECT * FROM discovery_feed_trending LIMIT 1')
      await assert.rejects(db.query('SELECT file_mp3_url FROM beats'),e=>e.code==='42501')
    }finally{await db.exec('RESET ROLE')}
  })
  await t.test('all public definers are restricted and catalog views use caller permissions',async()=>{
    const {rows}=await db.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))")
    assert.deepEqual(rows,[])
    assert.equal(Number((await db.query("SELECT count(*) FROM pg_class WHERE relname IN ('search_catalog','discovery_feed_trending') AND reloptions @> ARRAY['security_invoker=true']")).rows[0].count),2)
  })
  await t.test('saving a pending master commits its retry job with the beat',async()=>{
    const b=await beat()
    await db.query("UPDATE beats SET status='pending' WHERE id=$1",[b])
    assert.equal((await db.query('SELECT status FROM watermark_jobs WHERE beat_id=$1',[b])).rows[0].status,'pending')
  })
})
