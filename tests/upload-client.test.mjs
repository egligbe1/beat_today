import {test} from 'node:test'
import assert from 'node:assert/strict'
import {uploadToR2} from '../lib/r2Upload.ts'
test('upload completion retries reuse the ticket without uploading the file twice',async t=>{
 const calls=[];let complete=0
 t.mock.method(globalThis,'setTimeout',callback=>{queueMicrotask(callback);return 0})
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url,options})
  if(url==='/api/uploads/presign')return Response.json({uploadUrl:'http://isolated.invalid/put',ticket:'fixed-ticket'})
  if(url==='http://isolated.invalid/put')return new Response(null,{status:200})
  assert.equal(url,'/api/uploads/complete');assert.deepEqual(JSON.parse(options.body),{ticket:'fixed-ticket'})
  if(++complete===1)throw new TypeError('isolated response lost')
  return Response.json({key:'masters/fixture/verified.mp3',publicUrl:null})
 })
 const result=await uploadToR2({purpose:'master',file:new Blob(['fixture'],{type:'audio/mpeg'}),beatId:'fixture',ext:'mp3'})
 assert.equal(result.key,'masters/fixture/verified.mp3')
 assert.equal(calls.filter(c=>c.url==='/api/uploads/presign').length,1)
 assert.equal(calls.filter(c=>c.url==='http://isolated.invalid/put').length,1)
 assert.equal(complete,2)
 assert.equal(JSON.parse(calls[0].options.body).verification_version,1)
})
