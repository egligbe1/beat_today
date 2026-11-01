import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import sharp from 'sharp'
import {sanitizeImage,validateStemArchive,validateAudioFile} from '../lib/uploads/content.ts'
import {issueUploadTicket,verifyUploadTicket} from '../lib/uploads/ticket.ts'
const user='00000000-0000-4000-8000-000000000001',beat='00000000-0000-4000-8000-000000000002',secret='isolated-upload-key'
test('upload tickets bind user, purpose, size, expiry and private quarantine destination',()=>{
 const metadata={purpose:'master',ext:'wav',contentType:'audio/wav',size:100,beatId:beat},issued=issueUploadTicket(metadata,user,secret,1000)
 const ticket=verifyUploadTicket(issued.token,user,secret,2000)
 assert.match(ticket.source,new RegExp('^quarantine/'+user+'/'))
 assert.match(ticket.key,new RegExp('^masters/'+user+'/'))
 assert.equal(ticket.size,100)
 for(const [token,uid,key,now] of [[issued.token,beat,secret,2000],[issued.token,user,'other',2000],[issued.token+'x',user,secret,2000],[issued.token,user,secret,1000000]])assert.throws(()=>verifyUploadTicket(token,uid,key,now))
 assert.throws(()=>issueUploadTicket({...metadata,beatId:'../../victim'},user,secret))
})
test('images are decoded/re-encoded and mismatched, active or broken content is rejected',async()=>{
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#ff5500'}}).png().toBuffer()
 const result=await sanitizeImage(png,'png');assert.equal((await sharp(result).metadata()).format,'webp')
 await assert.rejects(sanitizeImage(png,'webp'))
 await assert.rejects(sanitizeImage(Buffer.from('<svg><script>alert(1)</script></svg>'),'png'))
 await assert.rejects(sanitizeImage(Buffer.from('not an image'),'jpg'))
})
function zip(name='vocals.wav',{expanded=100,compressed=100,flags=0,mode=0,compression=0}={}){
 const filename=Buffer.from(name),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22)
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(filename.length,26)
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(flags,8);central.writeUInt16LE(compression,10);central.writeUInt32LE(compressed,20);central.writeUInt32LE(expanded,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE((mode<<16)>>>0,38)
 const contents=Buffer.alloc(compressed),directory=Buffer.concat([central,filename]),prefix=Buffer.concat([local,filename,contents])
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(prefix.length,16)
 return Buffer.concat([prefix,directory,end])
}
test('ZIP structure limits expansion and rejects traversal, executable entries, encryption and symlinks without extracting',async()=>{
 const verify=buffer=>validateStemArchive(buffer.length,async(start,end)=>buffer.subarray(start,end+1))
 assert.equal((await verify(zip())).entries,1)
 for(const archive of [zip('../vocals.wav'),zip('/vocals.wav'),zip('C:\\vocals.wav'),zip('launch.exe'),zip('vocals.wav',{flags:1}),zip('vocals.wav',{mode:0o120000}),zip('vocals.wav',{expanded:100000,compressed:1}),Buffer.from('not a zip')])await assert.rejects(verify(archive))
})
test('audio structural verification rejects playlists, fake MIME, inconsistent WAV and truncated MP3',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'bt-content-test-'));t.after(()=>rm(dir,{recursive:true,force:true}))
 const wav=Buffer.alloc(48);wav.write('RIFF');wav.writeUInt32LE(40,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(4,40)
 const path=join(dir,'fixture');await writeFile(path,wav);await validateAudioFile(path,'wav')
 await writeFile(path,Buffer.from('#EXTM3U\nhttp://127.0.0.1/private'));await assert.rejects(validateAudioFile(path,'mp3'))
 const broken=Buffer.from(wav);broken.writeUInt32LE(99999,40);await writeFile(path,broken);await assert.rejects(validateAudioFile(path,'wav'))
 const frame=Buffer.alloc(417);frame.writeUInt32BE(0xfffb9000);const mp3=Buffer.concat([frame,frame]);await writeFile(path,mp3);await validateAudioFile(path,'mp3')
 await writeFile(path,mp3.subarray(0,700));await assert.rejects(validateAudioFile(path,'mp3'))
})
