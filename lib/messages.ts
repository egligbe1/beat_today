import type {ChatMessage} from '@/lib/types'
export function mergeMessages(current:ChatMessage[],incoming:ChatMessage[]):ChatMessage[] {
 const messages=new Map(current.map(message=>[message.id,message]))
 for(const message of incoming){const previous=messages.get(message.id);messages.set(message.id,{...previous,...message,is_read:!!previous?.is_read||message.is_read})}
 return [...messages.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||microsecondRemainder(a.created_at)-microsecondRemainder(b.created_at)||a.id.localeCompare(b.id))
}
export function messageCursor(message:ChatMessage|undefined) {
 return message?{created_at:message.created_at,id:message.id}:null
}

// Postgres timestamps may have six fractional digits. Preserve them in cursors;
// converting to Date.toISOString() would truncate microseconds and repeat rows.
export function validMessageTimestamp(value:string) {
 return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))
}
function microsecondRemainder(value:string) {
 return Number((value.match(/\.(\d+)/)?.[1]||'').padEnd(6,'0').slice(3,6))
}
