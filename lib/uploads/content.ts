import sharp from 'sharp'
import {RequestError} from '../http'
export async function sanitizeImage(bytes:Buffer,ext:string){
 const expected:Record<string,string>={png:'png',jpg:'jpeg',jpeg:'jpeg',webp:'webp'}
 try{
  const image=sharp(bytes,{limitInputPixels:25_000_000,failOn:'warning',animated:false}),metadata=await image.metadata()
  if(metadata.format!==expected[ext]||!metadata.width||!metadata.height||metadata.width>10000||metadata.height>10000||(metadata.pages||1)>1)throw new Error('Invalid image')
  // Decode and re-encode; do not publish uploaded metadata, SVG or polyglot bytes.
  return await image.rotate().webp({quality:90}).toBuffer()
 }catch{throw new RequestError('Image could not be verified. Upload a valid PNG, JPEG or WebP image.')}
}
export {validateAudioFile} from './audio'
/** Inspect central directory without extracting or trusting client archive metadata. */
export async function validateStemArchive(size:number,readRange:(start:number,end:number)=>Promise<Buffer>){
 const invalid=()=>new RequestError('ZIP could not be verified. Use an unencrypted ZIP containing audio stems, MIDI or a text readme.',422)
 if(size<22)throw invalid()
 const start=Math.max(0,size-65557),tail=await readRange(start,size-1)
 let end=-1
 for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break}
 if(end<0)throw invalid()
 const disk=tail.readUInt16LE(end+4),directoryDisk=tail.readUInt16LE(end+6),diskEntries=tail.readUInt16LE(end+8),entries=tail.readUInt16LE(end+10),length=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16)
 if(disk||directoryDisk||!entries||entries>1000||entries!==diskEntries||length>4*1024*1024||offset+length!==start+end||offset===0xffffffff||length===0xffffffff)throw invalid()
 const prefix=await readRange(0,3)
 if(prefix.length!==4||prefix.readUInt32LE(0)!==0x04034b50)throw invalid()
 const central=await readRange(offset,offset+length-1)
 if(central.length!==length)throw invalid()
 let at=0,expanded=0
 const names=new Set<string>()
 for(let n=0;n<entries;n++){
  if(at+46>central.length||central.readUInt32LE(at)!==0x02014b50)throw invalid()
  const flags=central.readUInt16LE(at+8),compression=central.readUInt16LE(at+10),compressed=central.readUInt32LE(at+20),uncompressed=central.readUInt32LE(at+24),nameLength=central.readUInt16LE(at+28),extraLength=central.readUInt16LE(at+30),commentLength=central.readUInt16LE(at+32),fileDisk=central.readUInt16LE(at+34),mode=(central.readUInt32LE(at+38)>>>16)&0o170000,localOffset=central.readUInt32LE(at+42)
  const next=at+46+nameLength+extraLength+commentLength
  if(next>central.length||!nameLength||nameLength>500||fileDisk||flags&(1|64)||![0,8].includes(compression)||uncompressed>512*1024*1024||compressed>size||uncompressed>Math.max(1,compressed)*200||localOffset+30>offset||![0,0o100000,0o040000].includes(mode))throw invalid()
  const name=central.subarray(at+46,at+46+nameLength).toString('utf8'),parts=name.split('/')
  if(/[\\:\u0000-\u001f\u007f\ufffd]/.test(name)||name.startsWith('/')||parts.some(part=>part==='..'||part==='.')||names.has(name.toLowerCase()))throw invalid()
  names.add(name.toLowerCase())
  if(!name.endsWith('/')&&!/\.(wav|mp3|flac|aiff?|ogg|m4a|midi?|txt)$/i.test(name)&&parts.at(-1)!=='.DS_Store')throw invalid()
  expanded+=uncompressed;if(expanded>5*1024*1024*1024)throw invalid()
  at=next
 }
 if(at!==central.length)throw invalid()
 return {entries,expandedBytes:expanded}
}
