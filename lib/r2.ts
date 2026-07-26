import 'server-only'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
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
export function presignUpload(bucket: string, key: string, contentType: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn })
}

/** Presigned GET URL for a private object (optionally forcing a download filename). */
export function presignDownload(key: string, opts: { bucket?: string; expiresIn?: number; filename?: string } = {}): Promise<string> {
  const { bucket = R2_PRIVATE_BUCKET, expiresIn = 3600, filename } = opts
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"` } : {}),
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
  const chunks: Buffer[] = []
  // @ts-expect-error Node stream is async-iterable at runtime
  for await (const c of res.Body) chunks.push(Buffer.from(c))
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
