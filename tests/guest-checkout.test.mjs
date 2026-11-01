import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {marketplaceFixture} from './helpers/marketplace-fixture.mjs'
import {createGuestReceipt,decryptGuestReceipt,validGuestReceipt,guestDetails,guestReceiptLink,createGuestClaimProof,validGuestClaimProof} from '../lib/guestCheckout.ts'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('guest identity and receipt credentials resist tampering, expiry and account mismatches',()=>{
 const secret='isolated-never-live',receipt=createGuestReceipt(secret)
 assert.equal(decryptGuestReceipt(receipt.ciphertext,secret),receipt.token)
 assert.equal(receipt.ciphertext.includes(receipt.token),false)
 assert.throws(()=>decryptGuestReceipt(receipt.ciphertext,'different'))
 const row={receipt_hash:receipt.hash,receipt_expires_at:'2030-01-01T00:00:00Z',claimed_by:null}
 assert.equal(validGuestReceipt(receipt.token,row),true);assert.equal(validGuestReceipt('guess',row),false)
 assert.equal(validGuestReceipt(receipt.token,{...row,claimed_by:id(1)}),false)
 assert.equal(validGuestReceipt(receipt.token,{...row,receipt_expires_at:'2020-01-01'}),false)
 const url=new URL(guestReceiptLink('https://beattoday.example',id(10),receipt.token));assert.equal(url.search,'');assert.ok(url.hash.includes(receipt.token))
 assert.deepEqual(guestDetails({name:' Artist Name ',email:' Artist+music@Example.com ',accepted_terms:true}),{name:'Artist Name',email:'artist+music@example.com'})
 for(const body of [{name:'A',email:'a@example.com',accepted_terms:true},{name:'Artist',email:'bad\nemail@example.com',accepted_terms:true},{name:'Artist',email:'a@example.com',accepted_terms:false}])assert.throws(()=>guestDetails(body))
})
test('guest orders use the same prices/settlement, private receipts and verified email ownership without rewriting legal terms',async t=>{
 const db=await marketplaceFixture(t)
 await db.exec('ALTER TABLE auth.users ADD COLUMN email_confirmed_at TIMESTAMPTZ')
 for(const [uid,email,role] of [[id(1),'owner@example.invalid','producer'],[id(2),'guest@example.invalid','artist'],[id(3),'wrong@example.invalid','artist'],[id(4),'unverified@example.invalid','artist']])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[uid,email,{role,full_name:'Fixture '+uid}])
 await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id IN($1,$2)',[id(2),id(3)])
 await db.query("INSERT INTO beats(id,producer_id,title,status,price_mp3,file_mp3_url) VALUES($1,$2,'Guest beat','active',10,$3)",[id(10),id(1),`masters/${id(1)}/${id(10)}-v1.mp3`])
 const before=(await db.query('SELECT producer_id,pending_balance,available_balance FROM wallets ORDER BY producer_id')).rows
 await db.exec(await readFile(new URL('../supabase/migrations/20261101161606_guest_license_checkout.sql',import.meta.url),'utf8'))
 assert.deepEqual((await db.query('SELECT producer_id,pending_balance,available_balance FROM wallets ORDER BY producer_id')).rows,before)
 const receipt=createGuestReceipt('test'),defaults={mp3:{contract_text:'License to {{BUYER_NAME}} for {{TRACK_TITLE}}.',streaming_limit:50000,music_video_limit:1,radio_broadcasting:false}},items=[{beat_id:id(10),license_type:'mp3'}]
 const checkout=(await db.query("SELECT prepare_guest_checkout($1,'BT-guest-fixture',10,$2,'guest@example.invalid','Guest Legal Name',$3,$4,NULL) c",[items,defaults,receipt.hash,receipt.ciphertext])).rows[0].c
 assert.equal(checkout.expected_minor,10000)
 assert.equal((await db.query('SELECT buyer_id FROM orders WHERE id=$1',[checkout.order_id])).rows[0].buyer_id,null)
 await assert.rejects(db.query("SELECT settle_order($1,'BT-guest-fixture',1,'GHS')",[checkout.order_id]),/amount\/currency/)
 await db.query("SELECT settle_order($1,'BT-guest-fixture',10000,'GHS')",[checkout.order_id]);await db.query("SELECT settle_order($1,'BT-guest-fixture',10000,'GHS')",[checkout.order_id])
 const legal=(await db.query('SELECT final_legal_text FROM order_item_licenses')).rows[0].final_legal_text
 assert.match(legal,/Guest Legal Name \(guest@example.invalid\)/)
 assert.equal((await db.query('SELECT count(*)::INTEGER n FROM ledger_transactions')).rows[0].n,1)
 const balances=(await db.query('SELECT producer_id,pending_balance,available_balance FROM wallets ORDER BY producer_id')).rows
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM guest_checkouts'),/permission denied/);await assert.rejects(db.query('SELECT claim_guest_purchases($1,$2)',[id(2),'guest@example.invalid']),/permission denied/);await db.exec('RESET ROLE')
 await db.exec('SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(2)])
 await assert.rejects(db.query('SELECT claim_guest_purchases($1,$2)',[id(2),'guest@example.invalid']),/permission denied/)
 await db.exec('RESET ROLE;SET ROLE service_role')
 await assert.rejects(db.query('SELECT claim_guest_purchases($1,$2)',[id(3),'guest@example.invalid']),/Verify your email/)
 assert.equal((await db.query('SELECT claim_guest_purchases($1,$2) count',[id(2),'guest@example.invalid'])).rows[0].count,1)
 assert.equal((await db.query('SELECT claim_guest_purchases($1,$2) count',[id(2),'guest@example.invalid'])).rows[0].count,0)
 await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id(2)])
 assert.equal((await db.query('SELECT * FROM orders')).rows.length,1)
 await db.exec('RESET ROLE')
 assert.equal((await db.query('SELECT final_legal_text FROM order_item_licenses')).rows[0].final_legal_text,legal)
 assert.deepEqual((await db.query('SELECT producer_id,pending_balance,available_balance FROM wallets ORDER BY producer_id')).rows,balances)
})

test('library claims need a fresh email-only proof bound to the signed-in account, independent of signup auto-confirmation',()=>{
 const secret='isolated-proof-key',email='guest@example.invalid',proof=createGuestClaimProof(id(2),email,secret,1000)
 assert.equal(validGuestClaimProof(proof,id(2),email,secret,2000),true)
 assert.equal(validGuestClaimProof(proof,id(3),email,secret,2000),false)
 assert.equal(validGuestClaimProof(proof,id(2),'other@example.invalid',secret,2000),false)
 assert.equal(validGuestClaimProof(proof,id(2),email,secret,1000000),false)
 assert.equal(validGuestClaimProof(proof+'x',id(2),email,secret,2000),false)
 assert.equal(validGuestClaimProof(createGuestReceipt(secret).token,id(2),email,secret,2000),false)
})
