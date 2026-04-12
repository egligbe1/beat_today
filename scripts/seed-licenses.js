const { createClient } = require('@supabase/supabase-js')
require('@next/env').loadEnvConfig(process.cwd())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const DEFAULT_LICENSE_TEXT = ` # LICENSE AGREEMENT
This agreement is made between {{PRODUCER_NAME}} (Producer) and {{BUYER_NAME}} (Artist) for the track "{{TRACK_TITLE}}".

## 1. GRANT OF LICENSE
Producer grants Artist a non-exclusive license to use the track for the following purposes:
- Streaming: Up to {{STREAM_LIMIT}} streams.
- Music Videos: Up to {{MV_LIMIT}} videos.
- Radio: {{RADIO_RIGHTS}}.

## 2. OWNERSHIP
Producer retains full copyright ownership of the composition and recording.

## 3. RESTRICTIONS
Artist may not sell, loan, or transfer the track to any third party.

Signed: {{PRODUCER_NAME}}
Date: {{DATE}}
`

async function seedLicenses() {
  console.log("Seeding Platform Default Licenses...")

  // Fetch all producers to give them default templates if they don't have them
  const { data: producers } = await supabase.from('users_profiles').select('id').eq('role', 'producer')

  if (!producers) return

  const templates = [
    { type: 'basic', name: 'Basic Lease (MP3)', streaming_limit: 50000, mv_limit: 1, radio: 'No Broadcasting', non_profit: true },
    { type: 'premium', name: 'Premium Lease (WAV)', streaming_limit: 500000, mv_limit: 2, radio: 'Limited Broadcasting', non_profit: false },
    { type: 'unlimited', name: 'Unlimited Lease', streaming_limit: 9999999, mv_limit: 99, radio: 'Full Broadcasting', non_profit: false },
    { type: 'exclusive', name: 'Exclusive Rights', streaming_limit: 9999999, mv_limit: 99, radio: 'Full Broadcasting', non_profit: false }
  ]

  for (const producer of producers) {
    for (const t of templates) {
      const { error } = await supabase.from('license_templates').upsert({
        producer_id: producer.id,
        type: t.type,
        name: t.name,
        streaming_limit: t.streaming_limit,
        music_video_limit: t.mv_limit,
        radio_broadcasting: t.radio !== 'No Broadcasting',
        is_non_profit_only: t.non_profit,
        contract_text: DEFAULT_LICENSE_TEXT
      }, { onConflict: 'producer_id, type' })
      
      if (error) console.error(`Error for ${producer.id} / ${t.type}:`, error)
    }
  }

  console.log("License Seeding Complete!")
}

seedLicenses()
