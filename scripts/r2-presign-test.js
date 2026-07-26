/* eslint-disable */
require('dotenv').config({ path: '.env.local' })
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const c = new S3Client({ region: 'auto', endpoint: process.env.CLOUDFLARE_S3_API_ENDPOINT, credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY } })
const bucket = process.env.CLOUDFLARE_S3_PRIVATE_BUCKET
const pubBucket = process.env.CLOUDFLARE_S3_PUBLIC_BUCKET
const pubUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
;(async () => {
  const key = `_test/presign-${Date.now()}.txt`
  const ct = 'text/plain'
  const putUrl = await getSignedUrl(c, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: ct }), { expiresIn: 600 })
  const put = await fetch(putUrl, { method: 'PUT', body: 'presigned-upload-ok', headers: { 'Content-Type': ct } })
  console.log('presigned PUT (private):', put.status, put.ok ? 'OK' : 'FAIL')
  const getUrl = await getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: 'attachment; filename="beat.mp3"' }), { expiresIn: 600 })
  const got = await fetch(getUrl)
  console.log('presigned GET (private):', got.status, 'content:', (await got.text()) === 'presigned-upload-ok' ? 'matches' : 'MISMATCH')
  await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  const pubKey = `_test/pub-${Date.now()}.txt`
  const pput = await getSignedUrl(c, new PutObjectCommand({ Bucket: pubBucket, Key: pubKey, ContentType: ct }), { expiresIn: 600 })
  await fetch(pput, { method: 'PUT', body: 'public-ok', headers: { 'Content-Type': ct } })
  const pubFetch = await fetch(`${pubUrl}/${pubKey}`)
  console.log('public URL fetch:', pubFetch.status, pubFetch.ok ? `OK (${await pubFetch.text()})` : 'FAIL — is Public Access enabled on the public bucket?')
  await c.send(new DeleteObjectCommand({ Bucket: pubBucket, Key: pubKey }))
  console.log('\nAll presign paths tested.')
})().catch(e => { console.error('ERROR:', e.name, e.message); process.exit(1) })
