import 'server-only'
import { attachmentDisposition } from './security'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 storage adapter (S3-compatible).
 *
 * Two buckets:
 *  - PUBLIC  (covers, watermarked previews, avatars, producer/platform tags) —
 *    served directly over the r2.dev / custom-domain public URL.
 *  - PRIVATE (clean masters, stems) — never public; handed out only as
 *    short-lived presigned download URLs after a verified purchase.
 */

export const R2_PUBLIC_BUCKET = process.env.CLOUDFLARE_S3_PUBLIC_BUCKET!
export const R2_PRIVATE_BUCKET = process.env.CLOUDFLARE_S3_PRIVATE_BUCKET!
const PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '')

let _client: S3Client | null = null
function r2(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_S3_API_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _client
}

/** Full public URL for an object in the public bucket. */
export function publicUrl(key: string): string {
  return `${PUBLIC_URL}/${key.replace(/^\/+/, '')}`
}

/** Presigned PUT URL for a browser to upload a file directly to R2. */
export function presignUpload(bucket: string, key: string, contentType: string, expiresIn = 600, size?: number): Promise<string> {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn, signableHeaders:new Set(['content-type']) })
}

/** Presigned GET URL for a private object (optionally forcing a download filename). */
export function presignDownload(key: string, opts: { bucket?: string; expiresIn?: number; filename?: string } = {}): Promise<string> {
  const { bucket = R2_PRIVATE_BUCKET, expiresIn = 3600, filename } = opts
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(filename ? { ResponseContentDisposition: attachmentDisposition(filename) } : {}),
    }),
    { expiresIn }
  )
}

/** Server-side upload of an in-memory buffer (e.g. the watermarked preview). */
export async function putObject(bucket: string, key: string, body: Buffer | Uint8Array, contentType: string): Promise<string> {
  await r2().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
  return key
}

/** Server-side download of an object into a Buffer (e.g. the master to watermark). */
export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const maxBytes = 300 * 1024 * 1024
  if ((res.ContentLength || 0) > maxBytes) throw new Error('Audio source exceeds processing limit')
  const chunks: Buffer[] = []
  let size = 0
  // @ts-expect-error Node stream is async-iterable at runtime
  for await (const c of res.Body) {
    size += c.length
    if (size > maxBytes) throw new Error('Audio source exceeds processing limit')
    chunks.push(Buffer.from(c))
  }
  return Buffer.concat(chunks)
}

/** List object keys under a prefix. */
export async function listObjects(bucket: string, prefix: string): Promise<string[]> {
  const res = await r2().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
  return (res.Contents || []).map((o) => o.Key!).filter(Boolean)
}

/** Delete a set of keys from a bucket (no-op on empty). */
export async function deleteObjects(bucket: string, keys: string[]): Promise<void> {
  const clean = keys.filter(Boolean)
  if (clean.length === 0) return
  await r2().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: clean.map((Key) => ({ Key })) } }))
}

export async function objectInfo(bucket:string,key:string){
 try{return await r2().send(new HeadObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(15000)})}
 catch(error){if((error as {$metadata?:{httpStatusCode?:number}})?.$metadata?.httpStatusCode===404)return null;throw error}
}
export async function objectBytes(bucket:string,key:string,start:number,end:number,etag:string){
 const result=await r2().send(new GetObjectCommand({Bucket:bucket,Key:key,Range:`bytes=${start}-${end}`,IfMatch:etag}),{abortSignal:AbortSignal.timeout(20000)})
 const chunks:Buffer[]=[];let size=0
 for await(const chunk of result.Body as unknown as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>end-start+1)throw new Error('Unexpected object range');chunks.push(Buffer.from(chunk))}
 if(size!==end-start+1)throw new Error('Incomplete object range')
 return Buffer.concat(chunks)
}
export async function objectToFile(bucket:string,key:string,etag:string,path:string,expectedSize:number){
 const {createWriteStream}=await import('node:fs'),{Readable,Transform}=await import('node:stream'),{pipeline}=await import('node:stream/promises')
 const result=await r2().send(new GetObjectCommand({Bucket:bucket,Key:key,IfMatch:etag}),{abortSignal:AbortSignal.timeout(45000)})
 let size=0
 const bound=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>expectedSize)callback(new Error('Upload size changed'));else callback(null,chunk)}})
 await pipeline(Readable.from(result.Body as unknown as AsyncIterable<Uint8Array>),bound,createWriteStream(path,{flags:'wx',mode:0o600}))
 if(size!==expectedSize)throw new Error('Upload size changed')
}
export async function publishVerifiedObject(source:string,key:string,bucket:string,etag:string,contentType:string,metadata:Record<string,string>){
 await r2().send(new CopyObjectCommand({Bucket:bucket,Key:key,CopySource:`${R2_PRIVATE_BUCKET}/${source.split('/').map(encodeURIComponent).join('/')}`,CopySourceIfMatch:etag,MetadataDirective:'REPLACE',Metadata:metadata,ContentType:contentType}),{abortSignal:AbortSignal.timeout(30000)})
}
export async function putVerifiedImage(bucket:string,key:string,bytes:Buffer,metadata:Record<string,string>){
 await r2().send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:'image/webp',Metadata:metadata}),{abortSignal:AbortSignal.timeout(20000)})
}
/** Only the new temporary staging object, after publication; never a clean asset. */
export async function removeUploadStage(key:string){
 if(!/^quarantine\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp3|wav|zip|webp|png|jpe?g)$/.test(key))throw new Error('Invalid staging key')
 await r2().send(new DeleteObjectCommand({Bucket:R2_PRIVATE_BUCKET,Key:key}),{abortSignal:AbortSignal.timeout(15000)})
}
