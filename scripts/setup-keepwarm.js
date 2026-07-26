/* eslint-disable */
// Creates (or replaces) a QStash schedule that pings the deployed site's
// /api/health every 10 minutes so Render's instance never idles out and
// cold-starts on a fresh visit.
//
// Usage:
//   node scripts/setup-keepwarm.js https://your-app.onrender.com
//   (or set KEEPWARM_URL in the environment)
require('dotenv').config({ path: '.env.local' })
const { Client } = require('@upstash/qstash')

const token = process.env.QSTASH_TOKEN
if (!token) { console.error('❌ Missing QSTASH_TOKEN in .env.local'); process.exit(1) }

const base = (process.argv[2] || process.env.KEEPWARM_URL || '').replace(/\/$/, '')
if (!base || !/^https?:\/\//.test(base)) {
  console.error('❌ Provide your public site URL, e.g.:\n   node scripts/setup-keepwarm.js https://your-app.onrender.com')
  process.exit(1)
}
if (base.includes('localhost')) { console.error('❌ Must be a public URL, not localhost.'); process.exit(1) }

const destination = `${base}/api/health`
const CRON = '*/10 * * * *' // every 10 minutes

;(async () => {
  const client = new Client({ token })

  // Remove any existing keep-warm schedules pointing at /api/health to avoid dupes.
  try {
    const existing = await client.schedules.list()
    for (const s of existing || []) {
      if (s.destination && s.destination.includes('/api/health')) {
        await client.schedules.delete(s.scheduleId)
        console.log('· removed old keep-warm schedule', s.scheduleId)
      }
    }
  } catch (e) { console.warn('· could not list existing schedules:', e.message) }

  const res = await client.schedules.create({
    destination,
    cron: CRON,
    method: 'GET',
  })

  console.log(`\n✅ Keep-warm schedule created`)
  console.log(`   id:          ${res.scheduleId}`)
  console.log(`   destination: ${destination}`)
  console.log(`   cadence:     every 10 minutes (${CRON})`)
  console.log(`\n   Render will now be pinged before it idles out (~15 min), so`)
  console.log(`   fresh visits hit a warm instance instead of a cold start.`)
})().catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
