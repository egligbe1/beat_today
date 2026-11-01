import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto'
import {RequestError} from './http'
import {UUID_RE} from './security'
export const GUEST_RECEIPT_DAYS=14
export function guestDetails(value:unknown){
 const body=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
 const name=typeof body.name==='string'?body.name.trim():'',email=typeof body.email==='string'?body.email.trim().toLowerCase():''
 const parts=email.split('@'),local=parts[0],domain=parts[1]
 if(name.length<2||name.length>150||/[\u0000-\u001f\u007f]/.test(name)||email.length>254||parts.length!==2||!local||local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..')||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)||!domain||! /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)||body.accepted_terms!==true)throw new RequestError('Enter your full name, a valid delivery email and accept the license terms.')
 return {name,email}
}
function key(secret:string){if(!secret)throw new Error('Guest receipt protection is unavailable');return createHmac('sha256',secret).update('beattoday:guest-receipt:v1').digest()}
export function receiptHash(token:string){return createHash('sha256').update(token).digest('hex')}
export function createGuestReceipt(secret:string){
 const token=randomBytes(32).toString('base64url'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv)
 cipher.setAAD(Buffer.from('beattoday-guest-v1'))
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()])
 return {token,hash:receiptHash(token),ciphertext:['v1',iv.toString('hex'),cipher.getAuthTag().toString('hex'),encrypted.toString('hex')].join('.')}
}
export function decryptGuestReceipt(value:string,secret:string){
 const [version,iv,tag,body]=value.split('.')
 if(version!=='v1'||! /^[a-f0-9]{24}$/.test(iv||'')||! /^[a-f0-9]{32}$/.test(tag||'')||! /^[a-f0-9]{86}$/.test(body||''))throw new Error('Guest receipt could not be opened')
 const decipher=createDecipheriv('aes-256-gcm',key(secret),Buffer.from(iv,'hex'));decipher.setAAD(Buffer.from('beattoday-guest-v1'));decipher.setAuthTag(Buffer.from(tag,'hex'))
 return Buffer.concat([decipher.update(Buffer.from(body,'hex')),decipher.final()]).toString('utf8')
}
export function validGuestReceipt(token:unknown,guest:{receipt_hash:string;receipt_expires_at:string;claimed_by:string|null},now=Date.now()){
 if(guest.claimed_by||typeof token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(token)||! /^[a-f0-9]{64}$/.test(guest.receipt_hash)||!Number.isFinite(Date.parse(guest.receipt_expires_at))||Date.parse(guest.receipt_expires_at)<=now)return false
 return timingSafeEqual(Buffer.from(receiptHash(token),'hex'),Buffer.from(guest.receipt_hash,'hex'))
}
export function guestCookieName(orderId:string){if(!UUID_RE.test(orderId))throw new Error('Invalid order');return 'bt_guest_'+orderId}
export function guestReceiptLink(site:string,orderId:string,token:string){if(!UUID_RE.test(orderId)||! /^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid receipt link');const url=new URL('/purchases/access',site);url.hash=new URLSearchParams({order:orderId,token}).toString();return url.href}

export function createGuestClaimProof(userId:string,email:string,secret:string,now=Date.now()){
 if(!UUID_RE.test(userId))throw new Error('Invalid account')
 const payload=Buffer.from(JSON.stringify({userId,email:email.toLowerCase(),expires:now+15*60*1000})).toString('base64url')
 const signature=createHmac('sha256',key(secret)).update('claim:'+payload).digest('hex')
 return payload+'.'+signature
}
export function validGuestClaimProof(proof:unknown,userId:string,email:string,secret:string,now=Date.now()){
 if(typeof proof!=='string'||proof.length>2000)return false
 const [payload,signature,...extra]=proof.split('.')
 if(extra.length||! /^[a-f0-9]{64}$/.test(signature||''))return false
 const expected=createHmac('sha256',key(secret)).update('claim:'+payload).digest()
 if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))return false
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return data.userId===userId&&data.email===email.toLowerCase()&&Number.isSafeInteger(data.expires)&&data.expires>now&&data.expires<=now+15*60*1000}catch{return false}
}
