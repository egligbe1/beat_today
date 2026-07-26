'use client'

import Link from 'next/link'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CountrySelect from '@/components/ui/CountrySelect'
import { User, Save, AlertCircle, CheckCircle2, Camera, Building2, CreditCard, Globe, Smartphone, Music, Lock, Upload, Edit2, X, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { showToast } from '@/lib/utils/toast'
import { convertToWebP } from '@/lib/utils/storageUtils'
import { uploadToR2 } from '@/lib/r2Upload'

const VERIFY_SUPPORTED = new Set(['Nigeria'])
const AUTO_VERIFY_COUNTRIES = new Set(['Nigeria', 'Ghana', 'Kenya', 'South Africa'])

// Mobile money networks per country
const MOBILE_MONEY_NETWORKS: Record<string, { code: string; name: string }[]> = {
  Ghana: [
    { code: 'MTN', name: 'MTN Mobile Money' },
    { code: 'VDF', name: 'Vodafone Cash' },
    { code: 'ATL', name: 'AirtelTigo Money' },
  ],
  Kenya: [
    { code: 'MPESA', name: 'M-Pesa (Safaricom)' },
  ],
  Nigeria: [
    { code: 'OPAY', name: 'OPay' },
    { code: 'PALMPAY', name: 'PalmPay' },
  ],
}

interface SettingsFormState {
  display_name: string
  bio: string
  avatar_url: string
  country: string
  // Bank account
  bank_name: string
  account_number: string
  account_name: string
  bank_code: string
  iban: string
  swift_code: string
  // Mobile money
  mobile_number: string
  mobile_network: string
  mobile_account_name: string
  // Default payout method
  default_payout: 'bank' | 'mobile_money'
  // Social
  social_website: string
  social_instagram: string
  social_twitter: string
  social_youtube: string
  social_soundcloud: string
  social_spotify: string
}

export default function SettingsForm({ profile, settings, role = 'producer' }: { profile: any; settings: any; role?: string }) {
  const isProducer = role === 'producer'
  const isPro = (settings?.subscription_tier || 'FREE').toUpperCase() === 'PRO'

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customTagUrl, setCustomTagUrl] = useState<string | null>(null)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bank' | 'mobile_money'>(
    settings?.bank_details?.default_payout === 'mobile_money' ? 'mobile_money' : 'bank'
  )

  const [banks, setBanks] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isFetchingBanks, setIsFetchingBanks] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const bd = settings?.bank_details || {}
  const bankData = bd.bank || bd // backwards-compat with old flat structure
  const mobileData = bd.mobile_money || {}

  const [form, setForm] = useState<SettingsFormState>({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    country: bankData.country || 'Ghana',
    // Bank
    bank_name: bankData.bank_name || '',
    account_number: bankData.account_number || '',
    account_name: bankData.account_name || '',
    bank_code: bankData.bank_code || '',
    iban: bankData.iban || '',
    swift_code: bankData.swift_code || '',
    // Mobile money
    mobile_number: mobileData.mobile_number || '',
    mobile_network: mobileData.network || '',
    mobile_account_name: mobileData.account_name || profile?.display_name || '',
    // Default
    default_payout: bd.default_payout || 'bank',
    // Social
    social_website: profile?.social_links?.website || '',
    social_instagram: profile?.social_links?.instagram || '',
    social_twitter: profile?.social_links?.twitter || '',
    social_youtube: profile?.social_links?.youtube || '',
    social_soundcloud: profile?.social_links?.soundcloud || '',
    social_spotify: profile?.social_links?.spotify || '',
  })

  const handleCancel = () => {
    setForm({
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
      avatar_url: profile?.avatar_url || '',
      country: bankData.country || 'Ghana',
      bank_name: bankData.bank_name || '',
      account_number: bankData.account_number || '',
      account_name: bankData.account_name || '',
      bank_code: bankData.bank_code || '',
      iban: bankData.iban || '',
      swift_code: bankData.swift_code || '',
      mobile_number: mobileData.mobile_number || '',
      mobile_network: mobileData.network || '',
      mobile_account_name: mobileData.account_name || profile?.display_name || '',
      default_payout: bd.default_payout || 'bank',
      social_website: profile?.social_links?.website || '',
      social_instagram: profile?.social_links?.instagram || '',
      social_twitter: profile?.social_links?.twitter || '',
      social_youtube: profile?.social_links?.youtube || '',
      social_soundcloud: profile?.social_links?.soundcloud || '',
      social_spotify: profile?.social_links?.spotify || '',
    })
    setEditMode(false)
  }

  // Check for existing custom tag (server checks R2; browser can't list)
  useEffect(() => {
    if (isPro && profile?.id) {
      fetch('/api/producer-tag')
        .then(r => r.json())
        .then(d => { if (d.url) setCustomTagUrl(`${d.url}?t=${Date.now()}`) })
        .catch(() => {})
    }
  }, [isPro, profile?.id])

  // Fetch banks when country changes (bank tab)
  useEffect(() => {
    if (!AUTO_VERIFY_COUNTRIES.has(form.country) || activeTab !== 'bank') {
      setBanks([])
      return
    }
    let active = true
    setBanks([]) // Clear banks immediately so old country banks do not show
    setIsFetchingBanks(true)
    fetch(`/api/payouts/banks?country=${encodeURIComponent(form.country)}&_t=${Date.now()}`)
      .then(r => r.json())
      .then(data => { if (active && data.success) setBanks(data.banks) })
      .catch(() => setBanks([]))
      .finally(() => { if (active) setIsFetchingBanks(false) })
    return () => { active = false }
  }, [form.country, activeTab])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleVerifyAccount = async () => {
    if (!form.account_number || !form.bank_code) {
      setError('Please enter account number and select a bank first.')
      return
    }
    setIsVerifying(true)
    setError(null)
    try {
      const res = await fetch(`/api/payouts/verify-bank?account_number=${form.account_number}&bank_code=${form.bank_code}`)
      const data = await res.json()
      if (data.success) {
        setForm(prev => ({ ...prev, account_name: data.account_name }))
        showToast.success(`Verified: ${data.account_name}`)
      } else {
        setError(data.error || 'Could not verify account.')
        showToast.error('Verification failed')
      }
    } catch {
      setError('An error occurred during verification.')
    } finally {
      setIsVerifying(false)
    }
  }


  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setLoading(true)
    setError(null)
    try {
      let file = e.target.files[0]

      // Convert to WebP for optimization
      try {
        const webpBlob = await convertToWebP(file)
        file = new File([webpBlob], `${file.name.split('.')[0]}.webp`, { type: 'image/webp' })
      } catch (err) {
        console.warn('WebP conversion failed, falling back to original format:', err)
      }

      const { publicUrl } = await uploadToR2({ purpose: 'avatar', file, ext: 'webp', contentType: 'image/webp' })
      if (!publicUrl) throw new Error('Upload failed')
      setForm(prev => ({ ...prev, avatar_url: publicUrl }))
      await supabase.from('users_profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
    } catch (err: any) {
      setError('Avatar upload failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTagUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !isPro) return
    setLoading(true)
    setError(null)
    try {
      const file = e.target.files[0]
      if (!file.name.toLowerCase().endsWith('.mp3')) {
        throw new Error('Please upload an MP3 file.')
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Tag file must be under 2MB.')
      }

      const { publicUrl } = await uploadToR2({ purpose: 'producerTag', file, ext: 'mp3', contentType: 'audio/mpeg' })
      if (!publicUrl) throw new Error('Upload failed')
      setCustomTagUrl(`${publicUrl}?t=${Date.now()}`)
      showToast.success('Custom tag uploaded!')
    } catch (err: any) {
      setError(err.message)
      showToast.error('Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    setVerificationMessage(null)


    try {
      // 1. Update Profile
      await supabase.from('users_profiles').update({
        display_name: form.display_name,
        bio: form.bio,
        avatar_url: form.avatar_url,
        social_links: {
          website: form.social_website || null,
          instagram: form.social_instagram || null,
          twitter: form.social_twitter || null,
          youtube: form.social_youtube || null,
          soundcloud: form.social_soundcloud || null,
          spotify: form.social_spotify || null,
        },
      }).eq('id', profile.id)

      // Build structured bank_details with both methods preserved (Only for producers)
      if (isProducer) {
        const selectedBank = banks.find(b => b.code === form.bank_code)
        const bankDetails: Record<string, any> = {
          default_payout: form.default_payout,
          bank: {
            country: form.country,
            bank_name: selectedBank?.name || form.bank_name,
            account_number: form.account_number,
            bank_code: selectedBank?.code || form.bank_code || '',
            iban: form.iban,
            swift_code: form.swift_code,
            account_name: form.account_name,
          },
          mobile_money: {
            country: form.country,
            network: form.mobile_network,
            network_name: MOBILE_MONEY_NETWORKS[form.country]?.find(n => n.code === form.mobile_network)?.name || form.mobile_network,
            mobile_number: form.mobile_number,
            account_name: form.mobile_account_name || form.display_name,
          },
        }

        // 2. Save to producer_settings AND wallets
        await Promise.all([
          supabase.from('producer_settings')
            .update({ bank_details: bankDetails })
            .eq('user_id', profile.id),
          supabase.from('wallets')
            .update({ bank_details: bankDetails })
            .eq('producer_id', profile.id)
        ])

        // 3. Register Paystack recipient(s)
        const activeMethod = form.default_payout

        if (activeMethod === 'bank' && AUTO_VERIFY_COUNTRIES.has(form.country) && form.account_number && form.bank_code) {
          const res = await fetch('/api/payouts/setup-recipient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'bank',
              country: form.country,
              account_number: form.account_number,
              bank_code: form.bank_code,
              account_name: form.account_name,
              bank_name: selectedBank?.name || form.bank_name,
            }),
          })
          const d = await res.json()
          if (!d.success) setError('Bank saved, but recipient setup failed: ' + d.error)
          else setVerificationMessage('Bank account verified and ready for automatic payouts.')
        }

        if (activeMethod === 'mobile_money' && form.mobile_number && form.mobile_network) {
          const res = await fetch('/api/payouts/setup-recipient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'mobile_money',
              country: form.country,
              mobile_number: form.mobile_number,
              mobile_network: form.mobile_network,
              account_name: form.mobile_account_name || form.display_name,
            }),
          })
          const d = await res.json()
          if (!d.success) setError('Mobile money saved, but recipient setup failed: ' + d.error)
          else setVerificationMessage('Mobile money account registered for automatic payouts.')
        }
      }


      setSuccess(true)
      showToast.success('Settings saved!')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      showToast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const filteredBanks = banks
    .filter(b => b.country === form.country)
    .filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const mobileNetworks = MOBILE_MONEY_NETWORKS[form.country] || []

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl relative">
      {/* Dynamic Mode Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-bg-surface/50 backdrop-blur-md p-6 rounded-3xl border border-border-subtle sticky top-20 z-50 shadow-2xl">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
            {editMode ? 'Edit Profile' : 'Producer Settings'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {editMode ? 'Modify your presence and payout methods.' : 'Review your professional profile and revenue settings.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {editMode ? (
            <>
              <button 
                type="button" 
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 h-11 rounded-xl bg-white/5 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 h-11 rounded-xl bg-accent-orange text-white text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
              </button>
            </>
          ) : (
            <button 
              type="button" 
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-6 h-11 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-bold">Settings updated successfully!</p>
          </div>
          {verificationMessage && <p className="text-xs text-white/70 ml-8">{verificationMessage}</p>}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={editMode ? 'edit' : 'view'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-8"
        >
          {/* Public Profile */}
          <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl space-y-6 sm:space-y-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-accent-orange" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Public Profile</h2>
            <p className="text-sm text-text-muted">Personalize your producer presence.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
          <div className="relative group/avatar">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-bg-primary border-2 border-border-subtle shadow-inner">
              {form.avatar_url ? (
                <Image src={form.avatar_url} alt="Profile" fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5">
                  <User className="w-10 h-10 text-text-muted" />
                </div>
              )}
            </div>
            {editMode && (
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent-orange flex items-center justify-center cursor-pointer hover:scale-110 hover:rotate-12 transition-all shadow-lg z-10">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </label>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Profile Photo</h3>
            <p className="text-xs text-text-muted">Upload a high-quality avatar to build trust with buyers.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Display Name</label>
            {editMode ? (
              <input type="text" name="display_name" value={form.display_name} onChange={handleChange} required
                placeholder="e.g. Metro Boomin"
                className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-orange transition-all text-white placeholder:text-white/20" />
            ) : (
              <div className="px-5 py-4 bg-white/5 rounded-2xl border border-white/5 text-sm text-white font-medium">
                {form.display_name || 'Not set'}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Short Bio</label>
            {editMode ? (
              <textarea name="bio" value={form.bio} onChange={handleChange} placeholder="Your sound, your story..."
                className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-orange transition-all text-white placeholder:text-white/20 min-h-[58px]" />
            ) : (
              <div className="px-5 py-4 bg-white/5 rounded-2xl border border-white/5 text-sm text-text-muted leading-relaxed italic">
                {form.bio || 'Professional music producer...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Producer Tag (PRO Perk) */}
      {isProducer && (
        <div className={`bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border-2 shadow-xl space-y-6 sm:space-y-8 transition-all ${isPro ? 'border-accent-orange/40' : 'border-border-subtle opacity-70 cursor-not-allowed'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 sm:w-6 sm:h-6 text-accent-orange" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white">Custom Producer Tag</h2>
                  {!isPro && <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-text-muted">PRO PERK</span>}
                </div>
                <p className="text-sm text-text-muted">Upload your personal voice tag to protect your previews.</p>
              </div>
            </div>
            {!isPro && (
              <Link href="/dashboard/subscription" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent-orange hover:scale-105 transition-all">
                Upgrade <Lock className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-bg-primary/50 border border-border-subtle space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Requirement</p>
                <ul className="text-xs text-text-muted space-y-1.5 list-disc list-inside">
                  <li>Must be an <strong className="text-white">MP3</strong> file</li>
                  <li>Recommend duration: <strong className="text-white">2-5 seconds</strong></li>
                  <li>File size limit: <strong className="text-white">2MB</strong></li>
                </ul>
              </div>

              <div className="relative group">
                <input
                  type="file"
                  accept="audio/mpeg"
                  onChange={handleTagUpload}
                  disabled={!isPro || loading}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  id="tag-upload"
                />
                <label htmlFor="tag-upload" className={`w-full h-14 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 text-sm font-bold transition-all ${isPro ? 'border-accent-orange/20 text-accent-orange hover:bg-accent-orange/5' : 'border-white/10 text-text-muted'}`}>
                  <Upload className="w-4 h-4" />
                  {loading ? 'Uploading...' : 'Click to Upload Tag'}
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {customTagUrl ? (
                <div className="p-6 rounded-2xl bg-bg-primary border border-accent-orange/20 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-orange">Current Active Tag</span>
                    <button
                      type="button"
                      onClick={() => setCustomTagUrl(null)}
                      className="text-[10px] font-bold text-text-muted hover:text-red-400"
                    >
                      Change Tag
                    </button>
                  </div>
                  <audio src={customTagUrl} controls className="w-full h-10 filter invert brightness-200" />
                </div>
              ) : (
                <div className="h-32 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center text-center p-6 gap-2">
                  <Music className="w-6 h-6 text-text-muted/30" />
                  <p className="text-xs text-text-muted/50">No custom tag uploaded yet.<br />Default watermarks will be used.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Social Links */}
      <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl space-y-6 sm:space-y-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Social Links</h2>
            <p className="text-sm text-text-muted">Let buyers find you on other platforms.</p>
          </div>
        </div>
        {editMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[
              { name: 'social_website', label: 'Website URL', placeholder: 'https://yoursite.com' },
              { name: 'social_instagram', label: 'Instagram Handle', placeholder: '@yourhandle' },
              { name: 'social_twitter', label: 'Twitter / X Handle', placeholder: '@yourhandle' },
              { name: 'social_youtube', label: 'YouTube Channel URL', placeholder: 'https://youtube.com/...' },
              { name: 'social_soundcloud', label: 'SoundCloud URL', placeholder: 'https://soundcloud.com/...' },
              { name: 'social_spotify', label: 'Spotify Artist URL', placeholder: 'https://open.spotify.com/...' },
            ].map(field => (
              <div key={field.name} className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">{field.label}</label>
                <input type="text" name={field.name} value={(form as any)[field.name]} onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-400 transition-all text-white placeholder:text-white/20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { name: 'social_website', icon: Globe, label: 'Website' },
              { name: 'social_instagram', icon: Camera, label: 'Instagram' },
              { name: 'social_twitter', icon: Globe, label: 'Twitter / X' },
              { name: 'social_youtube', icon: Music, label: 'YouTube' },
              { name: 'social_soundcloud', icon: Music, label: 'SoundCloud' },
              { name: 'social_spotify', icon: Music, label: 'Spotify' },
            ].map(social => {
              const value = (form as any)[social.name]
              if (!value) return null
              return (
                <a 
                  key={social.name}
                  href={value.startsWith('http') ? value : `https://${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-blue-400/50 transition-all group"
                >
                  <social.icon className="w-6 h-6 text-text-muted group-hover:text-blue-400 mb-2 transition-colors" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center line-clamp-1">{social.label}</span>
                  <div className="mt-2 text-[8px] text-blue-400/50 flex items-center gap-1 font-mono">
                    VISIT <ExternalLink className="w-2 h-2" />
                  </div>
                </a>
              )
            })}
            {Object.entries(form).filter(([k, v]) => k.startsWith('social_') && !v).length === 6 && (
              <div className="col-span-full py-8 text-center text-text-muted text-xs italic">
                No social links added yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payout Section (Only for Producers) */}
      {isProducer && (
        <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl space-y-6 sm:space-y-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-accent-gold/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent-gold" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Payout Details</h2>
              <p className="text-sm text-text-muted">Choose how you want to receive your earnings.</p>
            </div>
          </div>

        {editMode ? (
          <>
            {/* Country */}
            <div className="max-w-xs space-y-2">
              <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Payout Country</label>
              <CountrySelect
                value={form.country}
                onChange={(value) => {
                  setForm(prev => ({ ...prev, country: value, bank_code: '', bank_name: '', account_number: '', mobile_number: '', mobile_network: '' }))
                }}
                className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-gold transition-all text-white"
              />
            </div>

            {/* Method tabs */}
            <div className="flex gap-2 p-1 bg-bg-primary rounded-2xl border border-border-subtle">
              <button type="button"
                onClick={() => { setActiveTab('bank'); setForm(prev => ({ ...prev, default_payout: 'bank' })) }}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all flex-1 justify-center ${activeTab === 'bank' ? 'bg-accent-gold text-black' : 'text-text-muted hover:text-white'}`}>
                <Building2 className="w-4 h-4 flex-shrink-0" /> <span className="hidden xs:inline">Bank</span> Account
              </button>
              {(mobileNetworks.length > 0) && (
                <button type="button"
                  onClick={() => { setActiveTab('mobile_money'); setForm(prev => ({ ...prev, default_payout: 'mobile_money' })) }}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-widest transition-all flex-1 justify-center ${activeTab === 'mobile_money' ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-white'}`}>
                  <Smartphone className="w-4 h-4 flex-shrink-0" /> <span>Mobile Money</span>
                </button>
              )}
            </div>

            {/* Active method indicator */}
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
              Default payout: <span className={activeTab === 'bank' ? 'text-accent-gold' : 'text-accent-orange'}>
                {activeTab === 'bank' ? 'Bank Account' : 'Mobile Money'}
              </span>
            </p>

            {/* Bank Account Form */}
            {activeTab === 'bank' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Bank Name</label>
                    {AUTO_VERIFY_COUNTRIES.has(form.country) ? (
                      <div className="space-y-2">
                        <select name="bank_code" value={form.bank_code} onChange={handleChange}
                          className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-gold transition-all text-white appearance-none text-overflow-ellipsis">
                          <option value="">{isFetchingBanks ? 'Loading banks...' : 'Select Bank...'}</option>
                          {filteredBanks.map(b => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                          ))}
                        </select>
                        <input type="text" placeholder="Search banks..." value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-transparent border-b border-white/10 px-2 py-1 text-xs text-text-muted focus:border-accent-gold focus:outline-none transition-colors" />
                      </div>
                    ) : (
                      <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange}
                        placeholder="Enter Bank Name"
                        className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-gold transition-all text-white" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Account Holder Name</label>
                    <input type="text" name="account_name" value={form.account_name} onChange={handleChange}
                      placeholder="Name as it appears on bank account"
                      className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-gold transition-all text-white" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Account Number</label>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input type="text" name="account_number" value={form.account_number} onChange={handleChange}
                          placeholder="0123456789"
                          className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl pl-11 pr-4 py-4 text-sm font-mono focus:outline-none focus:border-accent-gold transition-all text-white" />
                      </div>
                      {VERIFY_SUPPORTED.has(form.country) && (
                        <button type="button" onClick={handleVerifyAccount}
                          disabled={isVerifying || !form.account_number || !form.bank_code}
                          className="px-6 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all disabled:opacity-30 min-w-[90px]">
                          {isVerifying ? '...' : 'Verify'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!AUTO_VERIFY_COUNTRIES.has(form.country) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">IBAN (if applicable)</label>
                      <input type="text" name="iban" value={form.iban} onChange={handleChange} placeholder="GB29NWBK60161331926819"
                        className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm font-mono focus:outline-none focus:border-accent-gold transition-all text-white uppercase" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">SWIFT / BIC</label>
                      <input type="text" name="swift_code" value={form.swift_code} onChange={handleChange} placeholder="ABCDUS33XXX"
                        className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm font-mono focus:outline-none focus:border-accent-gold transition-all text-white uppercase" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mobile_money' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Mobile Network</label>
                    <select name="mobile_network" value={form.mobile_network} onChange={handleChange}
                      className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-orange transition-all text-white appearance-none">
                      <option value="">Select Network...</option>
                      {mobileNetworks.map(n => (
                        <option key={n.code} value={n.code}>{n.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Mobile Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input type="tel" name="mobile_number" value={form.mobile_number} onChange={handleChange}
                        placeholder="0244000000"
                        className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl pl-11 pr-4 py-4 text-sm font-mono focus:outline-none focus:border-accent-orange transition-all text-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-w-sm">
                  <label className="text-[11px] font-black uppercase tracking-widest text-text-muted">Account Name (as registered on network)</label>
                  <input type="text" name="mobile_account_name" value={form.mobile_account_name} onChange={handleChange}
                    placeholder="Full name on mobile money account"
                    className="w-full bg-bg-primary/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-accent-orange transition-all text-white" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 rounded-[32px] bg-gradient-to-br from-white/[0.05] to-transparent border border-white/5 relative overflow-hidden group/payout">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              {form.default_payout === 'bank' ? <Building2 className="w-24 h-24" /> : <Smartphone className="w-24 h-24" />}
            </div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${form.account_number || form.mobile_number ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Active Payout Method</span>
              </div>

              {form.default_payout === 'bank' ? (
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-white uppercase tracking-tight">{form.bank_name || 'No Bank Set'}</h3>
                  <p className="text-accent-gold font-mono tracking-wider tabular-nums">{form.account_number ? `**** **** ${form.account_number.slice(-4)}` : 'No account number'}</p>
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <span>{form.account_name}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>{form.country}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-white uppercase tracking-tight">{form.mobile_network || 'No Network Set'}</h3>
                  <p className="text-accent-orange font-mono tracking-wider tabular-nums">{form.mobile_number || 'No number set'}</p>
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    <span>{form.mobile_account_name}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>{form.country}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
             <Lock className="w-4 h-4 text-accent-gold" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-gold">Secure Infrastructure</p>
            <p className="text-[11px] text-text-muted">Powered by Paystack. Payouts are processed every 2 weeks.</p>
          </div>
        </div>
        </div>
      )}


        </motion.div>
      </AnimatePresence>

      <div></div>
    </form>
  )
}
