import { getCachedAuthContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const { user, profile } = await getCachedAuthContext()
  
  if (!user) redirect('/login')
  if (!profile) redirect('/complete-profile')

  const supabase = createClient()

  // Only fetch producer settings if the user is a producer
  const { data: settings } = profile.role === 'producer' 
    ? await supabase.from('producer_settings').select('*').eq('user_id', user.id).single()
    : { data: null }
  
  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-fade-in">
        <div>
           <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Account Settings</h1>
           <p className="text-text-muted">Update your public profile and manage your account details.</p>
        </div>

        <SettingsForm profile={profile} settings={settings} role={profile.role} />
    </div>
  )
}
