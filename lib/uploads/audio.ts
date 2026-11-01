import {open} from 'node:fs/promises'
import {RequestError} from '../http'
/** Structural audio validation uses bounded reads, not a native decoder or shell. */
export async function validateAudioFile(path:string,ext:string){
 const invalid=()=>new RequestError('Audio structure could not be verified. Export a standard PCM WAV or MP3 and try again.',422)
 const file=await open(path,'r')
 try{
  const size=(await file.stat()).size
  if(size<12||size>250*1024*1024)throw invalid()
  let cache=Buffer.alloc(0),cacheStart=-1
  async function bytes(offset:number,length:number){
   if(offset<0||offset+length>size||length>128)throw invalid()
   if(cacheStart<0||offset<cacheStart||offset+length>cacheStart+cache.length){
    cacheStart=Math.floor(offset/65536)*65536
    const buffer=Buffer.alloc(Math.min(size-cacheStart,65536+128)),{bytesRead}=await file.read(buffer,0,buffer.length,cacheStart)
    cache=buffer.subarray(0,bytesRead)
   }
   const result=cache.subarray(offset-cacheStart,offset-cacheStart+length)
   if(result.length!==length)throw invalid()
   return result
  }
  if(ext==='wav'){
   const header=await bytes(0,12)
   if(header.toString('ascii',0,4)!=='RIFF'||header.toString('ascii',8,12)!=='WAVE'||header.readUInt32LE(4)+8!==size)throw invalid()
   let at=12,align=0,dataBytes=0,chunks=0
   while(at<size){
    if(++chunks>128)throw invalid()
    const chunk=await bytes(at,8),length=chunk.readUInt32LE(4),kind=chunk.toString('ascii',0,4)
    if(at+8+length>size)throw invalid()
    if(kind==='fmt '){
     if(length<16)throw invalid()
     const fmt=await bytes(at+8,Math.min(length,40));let format=fmt.readUInt16LE(0)
     const channels=fmt.readUInt16LE(2),rate=fmt.readUInt32LE(4),byteRate=fmt.readUInt32LE(8),block=fmt.readUInt16LE(12),bits=fmt.readUInt16LE(14)
     if(format===0xfffe){if(length<40)throw invalid();const guid=fmt.subarray(24,40).toString('hex');if(!['0100000000001000800000aa00389b71','0300000000001000800000aa00389b71'].includes(guid))throw invalid();format=fmt.readUInt16LE(24)}
     if(![1,3].includes(format)||channels<1||channels>32||rate<8000||rate>384000||!(format===1?[8,16,24,32]:[32,64]).includes(bits)||block!==channels*bits/8||byteRate!==rate*block)throw invalid()
     align=block
    }
    if(kind==='data')dataBytes+=length
    at+=8+length+(length%2)
   }
   if(at!==size||!align||!dataBytes||dataBytes%align)throw invalid()
   return
  }
  if(ext!=='mp3')throw invalid()
  let at=0,frames=0
  const first=await bytes(0,10)
  if(first.toString('ascii',0,3)==='ID3'){
   if(![2,3,4].includes(first[3])||[...first.subarray(6,10)].some(value=>value>127))throw invalid()
   const length=(first[6]<<21)|(first[7]<<14)|(first[8]<<7)|first[9]
   if(length>16*1024*1024)throw invalid()
   at=10+length+(first[3]===4&&(first[5]&16)?10:0)
  }
  const bitrates=[32,40,48,56,64,80,96,112,128,160,192,224,256,320],lowerBitrates=[8,16,24,32,40,48,56,64,80,96,112,128,144,160]
  while(at<size){
   const remaining=size-at
   if(remaining===128&&(await bytes(at,3)).toString('ascii')==='TAG'){at=size;break}
   if(remaining<=128&&(await bytes(at,remaining)).every(value=>value===0)){at=size;break}
   if(remaining<4)throw invalid()
   const h=(await bytes(at,4)).readUInt32BE(0),version=(h>>>19)&3,layer=(h>>>17)&3,bitrate=(h>>>12)&15,sample=(h>>>10)&3
   if((h>>>21)!==0x7ff||version===1||layer!==1||!bitrate||bitrate===15||sample===3)throw invalid()
   const rate=[44100,48000,32000][sample]/(version===3?1:version===2?2:4),kbps=(version===3?bitrates:lowerBitrates)[bitrate-1]
   const length=Math.floor((version===3?144000:72000)*kbps/rate)+((h>>>9)&1)
   if(length<24||at+length>size)throw invalid()
   at+=length;frames++
  }
  if(at!==size||frames<2)throw invalid()
 }finally{await file.close()}
}
