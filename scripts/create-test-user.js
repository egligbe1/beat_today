const { createClient } = require('@supabase/supabase-js')
require('@next/env').loadEnvConfig(process.cwd())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createProducer() {
  const email = 'producer@test.com'
  const password = 'Password123!'
  const handle = 'testproducer'

  console.log(`Creating Test Producer: ${email}...`)

  // 1. Create User via Admin API (to set email_confirm: true)
  const { data: user, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'producer' }
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
        console.log("User already exists. Proceeding...")
    } else {
        console.log("Auth Error:", authError)
        return
    }
  }

  const userId = user?.user?.id || (await supabase.from('users_profiles').select('id').eq('handle', handle).single()).data?.id

  // 2. Ensure Profile exists with Producer role
  const { error: profileError } = await supabase
    .from('users_profiles')
    .upsert({
       id: userId,
       handle,
       display_name: 'Test Producer',
       role: 'producer',
       country: 'Ghana'
    })

  if (profileError) console.error("Profile Error:", profileError)

  // 3. Ensure Producer Settings exist
  const { error: settingsError } = await supabase
    .from('producer_settings')
    .upsert({
       user_id: userId,
       subscription_tier: 'PRO',
       paystack_account: 'SUB_TEST123'
    })

  if (settingsError) console.error("Settings Error:", settingsError)

  console.log("Verification account ready: Login with producer@test.com / Password123!")
}

createProducer()
