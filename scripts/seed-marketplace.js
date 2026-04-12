const { createClient } = require('@supabase/supabase-js')
require('@next/env').loadEnvConfig(process.cwd())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Need service key to bypass RLS for seeding

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const BEAT_DATA = [
  { title: 'LAGOS NIGHTS', genre: 'Afrobeats', bpm: 105, price: 29.99, cover: '/hero-studio.png' },
  { title: 'SOWETO SUNSET', genre: 'Amapiano', bpm: 112, price: 34.99, cover: '/genre-rnb.png' },
  { title: 'ACCRA DRILL', genre: 'Afro-drill', bpm: 140, price: 29.99, cover: '/genre-drill.png' },
  { title: 'PALM WINE', genre: 'Highlife', bpm: 98, price: 24.99, cover: '/genre-hiphop.png' },
  { title: 'ODOGWU', genre: 'Afrobeats', bpm: 100, price: 19.99, cover: '/genre-trap.png' },
  { title: 'LOG DRUM KING', genre: 'Amapiano', bpm: 113, price: 39.99, cover: '/cta-artist.png' },
  { title: 'KUMASI STREETS', genre: 'Afro-drill', bpm: 144, price: 29.99, cover: '/genre-drill.png' },
  { title: 'FELA VIBES', genre: 'Afrobeats', bpm: 110, price: 19.99, cover: '/cta-producer.png' },
]

async function seedMarketplace() {
  console.log("Starting Database Seeding...")

  // 1. Get or create a mock producer (We need their Auth ID)
  // Usually, you should sign up a user normally via Auth to get a valid UUID.
  // Assuming a user exists, let's just grab the first producer from users_profiles
  const { data: producers, error: pError } = await supabase
    .from('users_profiles')
    .select('id, handle')
    .eq('role', 'producer')
    .limit(1)

  if (pError || !producers || producers.length === 0) {
    console.error("No producer profiles found. Please create one via the UI first before seeding beats.")
    process.exit(1)
  }

  const producerId = producers[0].id

  // 2. Clear existing beats to ensure a premium, non-broken experience
  console.log("Clearing all existing beats...")
  const { error: dError } = await supabase.from('beats').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Basic catch-all delete
  if (dError) console.error("Could not clear beats:", dError)

  // 3. Insert mock beats
  console.log(`Found producer: ${producers[0].handle}. Injecting premium beats...`)
  
  const payload = BEAT_DATA.map(b => ({
    producer_id: producerId,
    title: b.title,
    genre: b.genre,
    bpm: b.bpm,
    price_mp3: b.price,
    price_wav: b.price + 20,
    price_trackout: b.price + 50,
    price_exclusive: b.price + 400,
    cover_url: b.cover,
    mp3_preview_url: '', // Empty until actual audio storage is wired
    status: 'active'
  }))

  const { data, error } = await supabase.from('beats').insert(payload)

  if (error) {
    console.error("Failed to seed beats:", error)
  } else {
    console.log(`Successfully seeded ${BEAT_DATA.length} premium tracks!`)
  }
}

seedMarketplace()
