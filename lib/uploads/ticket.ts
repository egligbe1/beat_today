import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto'
import {UUID_RE} from '../security'
import {RequestError} from '../http'
import {uploadMetadata} from '../uploads'
type Metadata=ReturnType<typeof uploadMetadata>
export type UploadTicket=Metadata&{id:string;userId:string;expires:number;source:string;key:string;isPublic:boolean;finalContentType:string}
function signature(payload:string,secret:string){if(!secret)throw new Error('Upload signing unavailable');return createHmac('sha256',createHmac('sha256',secret).update('beattoday:upload-ticket:v1').digest()).update(payload).digest()}
function destination(metadata:Metadata,id:string,userId:string,expires:number):UploadTicket{
 const beatId=typeof metadata.beatId==='string'?metadata.beatId:''
 if(!UUID_RE.test(id)||!UUID_RE.test(userId)||(['cover','master','stems'].includes(metadata.purpose)&&!UUID_RE.test(beatId)))throw new RequestError('Invalid upload identity')
 let key:string
 switch(metadata.purpose){
  case 'cover':key=`covers/${userId}/${beatId}-${id}.webp`;break
  case 'avatar':key=`avatars/${userId}-${id}.webp`;break
  case 'master':key=`masters/${userId}/${beatId}-${id}.${metadata.ext}`;break
  case 'stems':key=`stems/${userId}/${beatId}-${id}.zip`;break
  case 'producerTag':key=`producer-tags/${userId}/tag.mp3`;break
 }
 return {...metadata,id,userId,expires,source:`quarantine/${userId}/${id}.${metadata.ext}`,key,isPublic:['cover','avatar','producerTag'].includes(metadata.purpose),finalContentType:['cover','avatar'].includes(metadata.purpose)?'image/webp':metadata.contentType}
}
export function issueUploadTicket(metadata:Metadata,userId:string,secret:string,now=Date.now()){
 const id=randomUUID(),expires=now+15*60*1000
 const payload=Buffer.from(JSON.stringify({...metadata,id,userId,expires})).toString('base64url')
 return {token:payload+'.'+signature(payload,secret).toString('hex'),upload:destination(metadata,id,userId,expires)}
}
export function verifyUploadTicket(token:unknown,userId:string,secret:string,now=Date.now()){
 if(typeof token!=='string'||token.length>4096)throw new RequestError('Invalid upload ticket')
 const parts=token.split('.')
 if(parts.length!==2||!/^[a-f0-9]{64}$/.test(parts[1])||!timingSafeEqual(signature(parts[0],secret),Buffer.from(parts[1],'hex')))throw new RequestError('Invalid upload ticket')
 let body:Record<string,unknown>
 try{body=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))}catch{throw new RequestError('Invalid upload ticket')}
 if(!body||body.userId!==userId||typeof body.id!=='string'||typeof body.expires!=='number'||!Number.isSafeInteger(body.expires)||body.expires<=now||body.expires>now+15*60*1000)throw new RequestError('Upload expired or belongs to another account')
 return destination(uploadMetadata(body),body.id,userId,body.expires)
}
