import {execFileSync} from 'node:child_process'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {readRequestText,readJsonObject,validRequestOrigin} from '../lib/http.ts'
import {uploadMetadata,uploadPlanAllowed} from '../lib/uploads.ts'
import {validPaystackSignature} from '../lib/paymentSignature.ts'
import {payoutAccount,payoutBank,payoutName} from '../lib/payoutValidation.ts'
import {attachmentDisposition} from '../lib/security.ts'
import {studioDayBounds,bookingPage,pageRange} from '../lib/studio/calendar.ts'
const request=body=>new Request('http://localhost/test',{method:'POST',body})
test('bounded requests reject oversized declared and streamed bodies, invalid UTF8 and non-object JSON',async()=>{
 assert.equal(await readRequestText(request('artist'),6),'artist')
 await assert.rejects(readRequestText(new Request('http://localhost',{method:'POST',headers:{'Content-Length':'999'},body:'x'}),10),{status:413})
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8));controller.enqueue(new Uint8Array(8));controller.close()}})
 await assert.rejects(readRequestText(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'}),10),{status:413})
 await assert.rejects(readRequestText(request(new Uint8Array([0xff]))),{status:400})
 for(const body of ['null','[]','true','"token"','{broken'])await assert.rejects(readJsonObject(request(body)),{status:400})
 assert.deepEqual(await readJsonObject(request('{"content":"hello"}')),{content:'hello'})
})
test('browser mutation origins reject cross-site requests even when Origin is missing',()=>{
 const origin='https://beattoday.example'
 for(const headers of [{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'},{origin:'null'}])assert.equal(validRequestOrigin(new Request(origin,{headers}),origin),false)
 for(const headers of [{origin},{'sec-fetch-site':'same-origin'},{}])assert.equal(validRequestOrigin(new Request(origin,{headers}),origin),true)
})
test('upload entitlement cannot be bypassed by extension casing or mismatched public formats',()=>{
 const wav=uploadMetadata({purpose:'master',ext:'WAV',contentType:'audio/wav',size:1024})
 assert.equal(wav.ext,'wav');assert.equal(uploadPlanAllowed(wav.purpose,wav.ext,'FREE'),false)
 assert.equal(uploadPlanAllowed('master','WAV','FREE'),false)
 assert.equal(uploadPlanAllowed('master','wav','STARTER'),true)
 assert.equal(uploadPlanAllowed('stems','zip','STARTER'),false)
 assert.equal(uploadPlanAllowed('stems','zip','PRO'),true)
 for(const body of [{purpose:'avatar',ext:'svg',contentType:'image/jpeg',size:10},{purpose:'avatar',ext:'png',contentType:'image/jpeg',size:10},{purpose:'__proto__',ext:'png',contentType:'image/png',size:10},{purpose:'master',ext:'mp3',contentType:'audio/mpeg',size:Infinity},{purpose:'master',ext:'mp3',contentType:'audio/mpeg',size:0}])assert.throws(()=>uploadMetadata(body))
 assert.equal(uploadMetadata({purpose:'avatar',ext:'PNG',contentType:'image/png',size:10}).ext,'png')
})
test('payment signatures authenticate exact raw bytes and reject altered, malformed and unsigned events',()=>{
 const secret='isolated-never-live',body='{"event":"charge.success","name":"Artíst"}'
 const signature=createHmac('sha512',secret).update(body).digest('hex')
 assert.equal(validPaystackSignature(body,signature,secret),true)
 assert.equal(validPaystackSignature(body,signature.toUpperCase(),secret),true)
 for(const [b,s,k] of [[body+' ',signature,secret],[body,signature,'other'],[body,null,secret],[body,'z'.repeat(128),secret],[body,signature,undefined],[body,signature.slice(2),secret]])assert.equal(validPaystackSignature(b,s,k),false)
})
test('bank details reject query injection, controls and unbounded input',()=>{
 assert.equal(payoutAccount('0241234567'),'0241234567');assert.equal(payoutBank('MTN'),'MTN');assert.equal(payoutName(' Artist Name '),'Artist Name')
 for(const value of ['01234&bank_code=OTHER','1','1'.repeat(21),12345])assert.throws(()=>payoutAccount(value))
 for(const value of ['001&account_number=0','\r\n','x'.repeat(21),null])assert.throws(()=>payoutBank(value))
 assert.throws(()=>payoutName('Artist\r\nInjected'));assert.throws(()=>payoutName('a'.repeat(151)))
})
test('download filenames cannot inject headers and preserve Unicode using RFC 5987',()=>{
 const header=attachmentDisposition('Artíst "mix"\r\nEvil: yes.wav')
 assert.equal(/[\r\n]/.test(header),false)
 assert.match(header,/filename\*=UTF-8''Art%C3%ADst/)
 assert.match(header,/filename="Art_st _mix___Evil: yes.wav"/)
})
test('calendar bounds follow studio local dates and daylight-saving transitions',()=>{
 assert.deepEqual(studioDayBounds('2026-11-01','Africa/Accra'),{start:'2026-11-01T00:00:00.000Z',end:'2026-11-02T00:00:00.000Z'})
 assert.equal(studioDayBounds('2026-04-24','Africa/Cairo').start,'2026-04-23T22:00:00.000Z')
 assert.equal(studioDayBounds('2026-11-01','Asia/Dubai').start,'2026-10-31T20:00:00.000Z')
 const fall=studioDayBounds('2026-11-01','America/New_York'),spring=studioDayBounds('2026-03-08','America/New_York')
 assert.equal((Date.parse(fall.end)-Date.parse(fall.start))/3600000,25)
 assert.equal((Date.parse(spring.end)-Date.parse(spring.start))/3600000,23)
 assert.throws(()=>studioDayBounds('2026-02-30','Africa/Accra'))
 assert.equal(bookingPage('12'),12);assert.equal(bookingPage('-2'),1);assert.equal(bookingPage('99999'),10000)
 assert.deepEqual(pageRange(9),{from:200,to:224})
})

test('readiness credentials fail closed and do not share cron credentials implicitly',async()=>{
 const {validOperatorToken}=await import('../lib/operations.ts')
 const secret='isolated-operator-secret-with-at-least-32-characters'
 assert.equal(validOperatorToken('Bearer '+secret,secret),true)
 for(const [header,key] of [[null,secret],['Bearer wrong',secret],['Bearer short','short'],['Bearer '+secret,undefined],['Bearer '+secret+' ',secret]])assert.equal(validOperatorToken(header,key),false)
})

test('actual upload presigner binds content type and file length without contacting storage',()=>{
 const script="import {presignUpload} from './lib/r2.ts';const url=new URL(await presignUpload('isolated','test.wav','audio/wav',600,1024));console.log(url.searchParams.get('X-Amz-SignedHeaders'))"
 const headers=execFileSync(process.execPath,['--conditions=react-server','--import','tsx','--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,CLOUDFLARE_S3_API_ENDPOINT:'http://127.0.0.1:9',CLOUDFLARE_R2_ACCESS_KEY_ID:'isolated',CLOUDFLARE_R2_SECRET_ACCESS_KEY:'isolated'},encoding:'utf8'}).trim().split(';')
 assert.ok(headers.includes('content-type'))
 assert.ok(headers.includes('content-length'))
})
