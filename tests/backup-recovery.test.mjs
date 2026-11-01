import {test} from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {Readable} from 'node:stream'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PGlite} from '@electric-sql/pglite'
import {encryptBackup,decryptBackup} from '../lib/backups/archive.mjs'
import {marketplaceFixture} from './helpers/marketplace-fixture.mjs'
const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}})
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('encrypted exports protect content, reject tampering and do not mark interrupted streams complete',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bt-backup-test-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const path=join(dir,'data.btbackup'),original=Buffer.from('isolated private purchase fixture')
 await encryptBackup(Readable.from([original]),path,keys.publicKey)
 const encrypted=await readFile(path);assert.equal(encrypted.includes(original),false);assert.deepEqual(decryptBackup(encrypted,keys.privateKey),original)
 const corrupt=Buffer.from(encrypted);corrupt[corrupt.length-20]^=1;assert.throws(()=>decryptBackup(corrupt,keys.privateKey))
 await assert.rejects(encryptBackup(Readable.from([original]),path,keys.publicKey),/already exists/)
 const interrupted=Readable.from((async function*(){yield original;throw new Error('isolated interruption')})())
 const failed=join(dir,'failed.btbackup');await assert.rejects(encryptBackup(interrupted,failed,keys.publicKey),/interruption/)
 await assert.rejects(readFile(failed),{code:'ENOENT'});await assert.rejects(readFile(failed+'.partial'),{code:'ENOENT'})
})
test('isolated encrypted restore retains completed purchases, wallets, licenses, private assets and RLS',async t=>{
 const db=await marketplaceFixture(t),buyer=id(1),producer=id(2),outsider=id(3)
 for(const [uid,role] of [[buyer,'artist'],[producer,'producer'],[outsider,'artist']])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[uid,uid+'@example.invalid',{role,full_name:'Fixture'}])
 const key=`masters/${producer}/${id(10)}-v1.mp3`
 await db.query("INSERT INTO beats(id,producer_id,title,status,price_mp3,file_mp3_url) VALUES($1,$2,'Recovery fixture','active',10,$3)",[id(10),producer,key])
 const defaults={mp3:{contract_text:'Fixture license for {{TRACK_TITLE}} to {{BUYER_NAME}}.',streaming_limit:50000,music_video_limit:1,radio_broadcasting:false}}
 const checkout=(await db.query("SELECT prepare_checkout($1,$2,'BT-recovery',10,$3,NULL,NULL) c",[buyer,[{beat_id:id(10),license_type:'mp3'}],defaults])).rows[0].c
 await db.query("SELECT settle_order($1,'BT-recovery',$2,'GHS')",[checkout.order_id,checkout.expected_minor])
 const balances=(await db.query('SELECT producer_id,pending_balance,available_balance FROM wallets ORDER BY producer_id')).rows
 const dir=await mkdtemp(join(tmpdir(),'bt-restore-test-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const snapshot=Buffer.from(await (await db.dumpDataDir('gzip')).arrayBuffer())
 await encryptBackup(Readable.from([snapshot]),join(dir,'database.btbackup'),keys.publicKey)
 const asset=Buffer.from('isolated purchased audio bytes')
 await encryptBackup(Readable.from([asset]),join(dir,'asset.btbackup'),keys.publicKey)
 const restored=await PGlite.create({loadDataDir:new Blob([decryptBackup(await readFile(join(dir,'database.btbackup')),keys.privateKey)])});t.after(()=>restored.close())
 assert.deepEqual((await restored.query('SELECT producer_id,pending_balance,available_balance FROM wallets ORDER BY producer_id')).rows,balances)
 assert.equal((await restored.query('SELECT status FROM orders')).rows[0].status,'completed')
 assert.equal((await restored.query('SELECT asset_snapshot FROM order_items')).rows[0].asset_snapshot.mp3,key)
 assert.deepEqual(decryptBackup(await readFile(join(dir,'asset.btbackup')),keys.privateKey),asset)
 await restored.exec('SET ROLE authenticated');await restored.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[buyer])
 assert.equal((await restored.query('SELECT * FROM order_item_licenses')).rows.length,1)
 await restored.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[outsider])
 assert.equal((await restored.query('SELECT * FROM order_item_licenses')).rows.length,0)
 await assert.rejects(restored.query('UPDATE wallets SET available_balance=999999'),/permission denied/)
})
