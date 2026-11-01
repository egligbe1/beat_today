export class RequestError extends Error {
 constructor(message:string,public status=400){super(message);this.name='RequestError'}
}
/** Bound streamed input even when Content-Length is absent or dishonest. */
export async function readRequestText(request:Request,maxBytes=20000):Promise<string> {
 const declared=request.headers.get('content-length')
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))throw new RequestError('Request too large',413)
 const reader=request.body?.getReader()
 if(!reader)return ''
 const chunks:Uint8Array[]=[];let size=0
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new RequestError('Request too large',413)}chunks.push(value)}
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new RequestError('Invalid request encoding')}
}
export async function readJsonObject(request:Request,maxBytes=20000):Promise<Record<string,unknown>> {
 const text=await readRequestText(request,maxBytes)
 try{const body:unknown=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();return body as Record<string,unknown>}
 catch{throw new RequestError('Invalid JSON request')}
}
export function safeRequestError(error:unknown,fallback='Request could not be processed') {
 return {message:error instanceof RequestError?error.message:fallback,status:error instanceof RequestError?error.status:500}
}
export function validRequestOrigin(request:Request,siteOrigin:string) {
 const origin=request.headers.get('origin')
 if(origin)return origin===siteOrigin
 return request.headers.get('sec-fetch-site')!=='cross-site'
}
