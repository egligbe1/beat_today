/* eslint-disable */
// One-off connectivity check for Cloudflare R2. Verifies endpoint, credentials,
// and both bucket names by doing a put -> get -> delete round-trip.
//   node scripts/r2-preflight.js
require('dotenv').config({ path: '.env.local' })
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const endpoint = process.env.CLOUDFLARE_S3_API_ENDPOINT
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const PUBLIC_BUCKET = process.env.CLOUDFLARE_S3_PUBLIC_BUCKET
const PRIVATE_BUCKET = process.env.CLOUDFLARE_S3_PRIVATE_BUCKET
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL

function assert(name, val) {
  if (!val) { console.error(`❌ Missing env: ${name}`); process.exit(1) }
}
assert('CLOUDFLARE_S3_API_ENDPOINT', endpoint)
assert('CLOUDFLARE_R2_ACCESS_KEY_ID', accessKeyId)
assert('CLOUDFLARE_R2_SECRET_ACCESS_KEY', secretAccessKey)
assert('CLOUDFLARE_S3_PUBLIC_BUCKET', PUBLIC_BUCKET)
assert('CLOUDFLARE_S3_PRIVATE_BUCKET', PRIVATE_BUCKET)

const client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

async function streamToString(body) {
  const chunks = []
  for await (const c of body) chunks.push(Buffer.from(c))
  return Buffer.concat(chunks).toString('utf8')
}

async function roundTrip(bucket) {
  const key = `_preflight/${Date.now()}.txt`
  const payload = 'beattoday-r2-ok'
  process.stdout.write(`\nBucket "${bucket}":\n`)
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload, ContentType: 'text/plain' }))
  console.log('  ✅ PUT ok')
  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const text = await streamToString(got.Body)
  console.log('  ✅ GET ok ->', text === payload ? 'content matches' : `MISMATCH (${text})`)
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log('  ✅ DELETE ok')
  return key
}

;(async () => {
  console.log('R2 endpoint:', endpoint)
  console.log('Public URL :', PUBLIC_URL || '(none)')
  try {
    await roundTrip(PRIVATE_BUCKET)
    const pubKey = await roundTrip(PUBLIC_BUCKET)
    if (PUBLIC_URL) {
      console.log(`\nℹ️  Public objects would be served at: ${PUBLIC_URL}/<key>`)
      console.log(`   (e.g. ${PUBLIC_URL}/covers/... )`)
    }
    console.log('\n🎉 R2 connectivity verified — safe to migrate.')
  } catch (err) {
    console.error('\n❌ R2 error:', err.name, '-', err.message)
    if (err.$metadata) console.error('   HTTP', err.$metadata.httpStatusCode)
    console.error('\nCheck: bucket names, endpoint account id, and that the API token has Object Read & Write on these buckets.')
    process.exit(1)
  }
})()
