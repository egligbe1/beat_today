import {RequestError} from './http'
export type UploadPurpose='cover'|'avatar'|'master'|'stems'|'producerTag'
const formats:Record<UploadPurpose,Record<string,string[]>>={
 cover:{webp:['image/webp']},avatar:{webp:['image/webp'],jpg:['image/jpeg'],jpeg:['image/jpeg'],png:['image/png']},
 master:{mp3:['audio/mpeg','audio/mp3'],wav:['audio/wav','audio/x-wav','audio/wave']},
 stems:{zip:['application/zip','application/x-zip-compressed']},producerTag:{mp3:['audio/mpeg','audio/mp3']},
}
export function uploadMetadata(body:Record<string,unknown>) {
 if(typeof body.purpose!=='string'||!Object.hasOwn(formats,body.purpose))throw new RequestError('Invalid upload purpose')
 const purpose=body.purpose as UploadPurpose
 const ext=typeof body.ext==='string'?body.ext.trim().toLowerCase():''
 const contentType=typeof body.contentType==='string'?body.contentType.toLowerCase():''
 if(!formats[purpose][ext]?.includes(contentType))throw new RequestError('File extension and content type must match an allowed format')
 const max=purpose==='stems'?1024*1024*1024:purpose==='master'?250*1024*1024:10*1024*1024
 if(typeof body.size!=='number'||!Number.isSafeInteger(body.size)||body.size<1||body.size>max)throw new RequestError('File size exceeds this upload limit')
 return {purpose,ext,contentType,size:body.size,beatId:body.beatId}
}
export function uploadPlanAllowed(purpose:UploadPurpose,ext:string,tier:'FREE'|'STARTER'|'PRO') {
 if((purpose==='stems'||purpose==='producerTag')&&tier!=='PRO')return false
 return !(purpose==='master'&&ext.toLowerCase()==='wav'&&tier==='FREE')
}
