import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {marketplaceFixture} from './helpers/marketplace-fixture.mjs'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const hash=value=>createHash('sha256').update(value).digest('hex')
test('proposed payment cases preserve money and hold affected sellers/collaborators with an immutable review history',async t=>{
 const db=await marketplaceFixture(t),buyer=id(1),producer=id(2),collaborator=id(3),unrelated=id(4)
 for(const uid of [buyer,producer,collaborator,unrelated])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[uid,uid+'@example.invalid',{role:uid===buyer?'artist':'producer',full_name:'Fixture'}])
 await db.query("INSERT INTO orders(id,buyer_id,total_amount,status,gateway_reference,expected_minor) VALUES($1,$2,10,'completed','BT-fixture',10000)",[id(10),buyer])
 await db.query("INSERT INTO beats(id,producer_id,title,status,price_mp3) VALUES($1,$2,'Fixture','active',10)",[id(11),producer])
 await db.query("INSERT INTO order_items(id,order_id,beat_id,producer_id,license_type,price) VALUES($1,$2,$3,$4,'mp3',10)",[id(12),id(10),id(11),producer])
 await db.query("INSERT INTO ledger_transactions(producer_id,amount,type,status,order_item_id) VALUES($1,20,'SALE','AVAILABLE',$2)",[collaborator,id(12)])
 await db.exec("UPDATE wallets SET available_balance=100,recipient_code='RCP_fixture',bank_details='{\"bank\":{\"country\":\"Ghana\"}}'")
 const money=async()=>(await db.query('SELECT producer_id,available_balance,pending_balance FROM wallets ORDER BY producer_id')).rows
 const before=await money(),ledgerBefore=(await db.query('SELECT * FROM ledger_transactions')).rows
 await db.exec(await readFile(new URL('../supabase/migrations/20261101111934_payment_case_holds.sql',import.meta.url),'utf8'))
 assert.deepEqual(await money(),before);assert.deepEqual((await db.query('SELECT * FROM ledger_transactions')).rows,ledgerBefore)
 const record=(key,event='refund.pending',reference='BT-fixture')=>db.query("SELECT record_payment_case($1,$2,$3,1000,'GHS','{}') id",[hash(key),event,reference])
 const blocked=async uid=>(await db.query('SELECT payment_payout_blocked($1) blocked',[uid])).rows[0].blocked
 const caseId=(await record('refund-1')).rows[0].id
 assert.equal(blocked instanceof Function,true)
 assert.equal(await blocked(producer),true);assert.equal(await blocked(collaborator),true);assert.equal(await blocked(unrelated),false)
 assert.equal((await record('refund-1')).rows[0].id,caseId)
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM payment_case_events')).rows[0].n,1)
 await assert.rejects(db.query("SELECT begin_payout($1,50,'{\"reference\":\"held\"}')",[producer]),/Payout paused/)
 await assert.rejects(db.query("INSERT INTO payouts(producer_id,amount,status,reference) VALUES($1,50,'PROCESSING','bypass')",[producer]),/Payout paused/)
 assert.deepEqual(await money(),before)
 const eligible=(await db.query('SELECT producer_id FROM eligible_payout_wallets()')).rows.map(r=>r.producer_id)
 assert.ok(!eligible.includes(producer)&&!eligible.includes(collaborator)&&eligible.includes(unrelated))
 await db.exec('SET ROLE authenticated')
 await assert.rejects(db.query("SELECT record_payment_case($1,'refund.pending','BT-fixture',1,'GHS','{}')",[hash('forged')]),/permission denied/)
 await assert.rejects(db.query('SELECT * FROM payment_cases'),/permission denied/)
 await db.exec('RESET ROLE')
 await assert.rejects(db.query("SELECT resolve_payment_case($1,$2,'NO_FINANCIAL_LOSS','short',$3)",[caseId,producer,id(20)]),/review evidence/)
 await db.query("SELECT resolve_payment_case($1,$2,'NO_FINANCIAL_LOSS','Provider confirmed refund failed; no funds were removed.',$3)",[caseId,producer,id(20)])
 assert.equal(await blocked(producer),false)
 await record('refund-1') // A delivery retry cannot reopen a reviewed case.
 assert.equal(await blocked(producer),false)
 await record('refund-2','refund.processed') // A genuinely new outcome needs review.
 assert.equal(await blocked(producer),true)
 assert.deepEqual(await money(),before)
 const unknown=(await record('unknown','charge.dispute.create',null)).rows[0].id
 assert.equal(await blocked(unrelated),true)
 await db.query("SELECT resolve_payment_case($1,$2,'UNRELATED_PAYMENT','Provider transaction belongs to a separate integration.',$3)",[unknown,producer,id(21)])
 assert.equal(await blocked(unrelated),false)
 await db.exec('SET ROLE service_role')
 await assert.rejects(db.query("UPDATE payment_case_events SET event_type='edited'"),/permission denied/)
 await assert.rejects(db.query('DELETE FROM payment_cases'),/permission denied/)
 await db.exec('RESET ROLE')
 assert.deepEqual(await money(),before)
})
