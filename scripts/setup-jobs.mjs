// Defaults to printing a plan. Run --apply only after the new API and migration
// are deployed and the user has authorized enabling these production jobs.
import { Client } from '@upstash/qstash'
const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
if (!site || !site.startsWith('https://')) throw new Error('Set the deployed HTTPS NEXT_PUBLIC_SITE_URL')
const plan = [
  { destination: `${site}/api/cron/watermark`, cron: '*/5 * * * *', method: 'POST' },
  { destination: `${site}/api/cron/deliver-licenses`, cron: '*/5 * * * *', method: 'POST' },
  { destination: `${site}/api/cron/clear-funds`, cron: '0 * * * *', method: 'POST' },
  { destination: `${site}/api/cron/payouts`, cron: '*/15 * 1,15 * *', method: 'POST' },
  { destination: `${site}/api/cron/payouts?reconcile_only=1`, cron: '15 * * * *', method: 'POST' },
]
if (!process.argv.includes('--apply')) console.log(JSON.stringify(plan, null, 2))
else {
  if (!process.env.QSTASH_TOKEN) throw new Error('Set QSTASH_TOKEN without putting it in source control')
  const client = new Client({ token: process.env.QSTASH_TOKEN })
  const existing = await client.schedules.list()
  for (const schedule of plan) {
    if (existing.some(item => item.destination === schedule.destination)) {
      console.log(`Existing schedule retained: ${schedule.destination}`)
      continue
    }
    await client.schedules.create(schedule)
    console.log(`Created schedule: ${schedule.destination}`)
  }
}
