import {createHash} from 'node:crypto'
export const PAYMENT_CASE_EVENTS=new Set(['refund.pending','refund.processing','refund.needs-attention','refund.failed','refund.processed','charge.dispute.create','charge.dispute.remind','charge.dispute.resolve'])
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}}
function text(value:unknown,max=100){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):null}
/** Use only after authenticating the exact raw webhook body. Never save card/customer data. */
export function paymentCaseEvent(event:unknown,rawBody:string){
 const envelope=record(event),type=envelope.event
 if(typeof type!=='string'||!PAYMENT_CASE_EVENTS.has(type))return null
 const data=record(envelope.data),transaction=record(data.transaction)
 const candidate=data.transaction_reference??transaction.reference
 const reference=typeof candidate==='string'&&/^[A-Za-z0-9._=-]{1,150}$/.test(candidate)?candidate:null
 const numeric=typeof data.amount==='number'?data.amount:typeof data.amount==='string'&&/^\d{1,16}$/.test(data.amount)?Number(data.amount):null
 const amount=numeric!==null&&Number.isSafeInteger(numeric)&&numeric>=0?numeric:null
 const currency=typeof data.currency==='string'&&/^[A-Z]{3}$/.test(data.currency)?data.currency:null
 return {p_hash:createHash('sha256').update(rawBody).digest('hex'),p_event:type,p_reference:reference,p_amount:amount,p_currency:currency,p_summary:{status:text(data.status),resolution:text(data.resolution),provider_case_id:typeof data.id==='number'&&Number.isSafeInteger(data.id)?String(data.id):text(data.id),refund_reference:text(data.refund_reference),reference_matched:reference!==null}}
}
