'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Upload, Lock, AlertCircle, CheckCircle2, Save, Loader2, X } from 'lucide-react'
import { getTierLimits } from '@/lib/tierLimits'
import { convertToWebP } from '@/lib/utils/storageUtils'
import { uploadToR2 } from '@/lib/r2Upload'
import { useAuth } from '@/components/providers/AuthProvider'

const GENRES = [
  'Afrobeats', 'Amapiano', 'Afro-drill', 'Trap Dancehall', 'Dancehall',
  'Gengetone', 'Bongo Flava', 'Highlife', 'Fuji', 'Afrobeats x Trap',
  'Shatta', 'Afrosoul', 'Afro-R&B', 'South African Hip-Hop', 'Gqom',
  'Kwaito', 'UK Afroswing', 'Afro-bashment', 'Instrumental Hip-Hop', 'Global'
]

const KEYS = ['C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m', 'A', 'Am', 'A#', 'A#m', 'B', 'Bm']

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tier, setTier] = useState<string>('free')
  const [beatCount, setBeatCount] = useState(0)
  const [beatId, setBeatId] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [collaborators, setCollaborators] = useState<{ handle: string, percentage: string }[]>([])

  const [form, setForm] = useState({
    title: '',
    genre: 'Afrobeats',
    bpm: '',
    key: 'C',
    tags: '',
    price_mp3: '19.99',
    price_wav: '39.99',
    price_trackout: '99.99',
    price_exclusive: '499.99',
    is_free: false,
  })

  const [files, setFiles] = useState<{
    cover: File | null
    mp3Clean: File | null
    stemsZip: File | null
  }>({ cover: null, mp3Clean: null, stemsZip: null })

  const limits = getTierLimits(tier)
  const atLimit = limits.max_beats !== Infinity && beatCount >= limits.max_beats

  // Load existing draft or init new beatId
  useEffect(() => {
    async function init() {
      if (!user) return

      const [settingsResult, countResult] = await Promise.all([
        supabase.from('producer_settings').select('subscription_tier').eq('user_id', user.id).single(),
        supabase.from('beats').select('id', { count: 'exact', head: true }).eq('producer_id', user.id).eq('status', 'active'),
      ])

      setTier(settingsResult.data?.subscription_tier || 'free')
      setBeatCount(countResult.count || 0)

      // Check if we are resuming a draft
      const draftId = searchParams.get('id')
      if (draftId) {
        const { data: draft } = await supabase
          .from('beats')
          .select('*')
          .eq('id', draftId)
          .eq('producer_id', user.id)
          .single()
        
        if (draft) {
          setBeatId(draft.id)
          setForm({
            title: draft.title || '',
            genre: draft.genre || 'Afrobeats',
            bpm: draft.bpm?.toString() || '',
            key: draft.key || 'C',
            tags: draft.mood_tags?.join(', ') || '',
            price_mp3: draft.price_mp3?.toString() || '19.99',
            price_wav: draft.price_wav?.toString() || '39.99',
            price_trackout: draft.price_trackout?.toString() || '99.99',
            price_exclusive: draft.price_exclusive?.toString() || '499.99',
            is_free: draft.is_free || false,
          })
        }
      } else {
        setBeatId(crypto.randomUUID())
      }

      setChecking(false)
    }

    if (!authLoading) {
      if (!user) {
        router.push('/login')
      } else {
        init()
      }
    }
  }, [supabase, searchParams, user, authLoading, router])

  // Auto-save metadata
  const saveDraft = useCallback(async (formData: any) => {
    if (!beatId || !user || !formData.title.trim()) return

    setIsSaving(true)
    try {
      await supabase.from('beats').upsert({
        id: beatId,
        producer_id: user.id,
        title: formData.title,
        genre: formData.genre,
        bpm: parseInt(formData.bpm) || null,
        key: formData.key,
        mood_tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
        price_mp3: formData.is_free ? 0 : parseFloat(formData.price_mp3),
        price_wav: limits.wav_upload && !formData.is_free ? parseFloat(formData.price_wav) : null,
        price_trackout: limits.stems_upload && !formData.is_free ? parseFloat(formData.price_trackout) : null,
        price_exclusive: formData.is_free ? null : parseFloat(formData.price_exclusive),
        is_free: formData.is_free,
        status: 'draft',
      })
    } catch (err) {
      console.error('Auto-save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [beatId, supabase, limits, user])

  // Debounced auto-save effect
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    
    if (form.title) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft(form)
      }, 1500)
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [form, saveDraft])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files![0]
      setFiles(prev => ({ ...prev, [e.target.name]: file }))
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!user || !beatId) throw new Error('Not authenticated')

      if (atLimit) throw new Error(`Limit reached on ${tier.toUpperCase()} plan.`)

      if (!files.cover) throw new Error('Please upload cover art')
      if (!files.mp3Clean) throw new Error('Please upload your beat (MP3 or WAV)')

      // Accept the clean master as MP3 or WAV. It is the single file the producer
      // uploads: buyers who purchase download it; browsers hear an auto-tagged
      // preview generated from it.
      const cleanIsWav = files.mp3Clean.type.includes('wav') || files.mp3Clean.name.toLowerCase().endsWith('.wav')
      const cleanExt = cleanIsWav ? 'wav' : 'mp3'

      // Upload all files directly to R2 via presigned URLs (parallel).
      const coverWebp = await convertToWebP(files.cover!).catch(() => files.cover!)
      const [coverRes, masterRes, stemsRes] = await Promise.all([
        uploadToR2({ purpose: 'cover', file: coverWebp, beatId, ext: 'webp', contentType: 'image/webp' }),
        uploadToR2({ purpose: 'master', file: files.mp3Clean, beatId, ext: cleanExt, contentType: files.mp3Clean.type || 'audio/mpeg' }),
        (limits.stems_upload && files.stemsZip)
          ? uploadToR2({ purpose: 'stems', file: files.stemsZip, beatId, ext: 'zip', contentType: files.stemsZip.type || 'application/zip' })
          : Promise.resolve(null),
      ])

      const masterKey = masterRes.key

      // Update beat with files and set status to 'pending'
      const { error: dbError } = await supabase.from('beats').upsert({
        id: beatId,
        producer_id: user.id,
        title: form.title,
        genre: form.genre,
        bpm: parseInt(form.bpm) || null,
        key: form.key,
        mood_tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        price_mp3: form.is_free ? 0 : parseFloat(form.price_mp3),
        price_wav: limits.wav_upload && !form.is_free ? parseFloat(form.price_wav) : null,
        price_trackout: limits.stems_upload && !form.is_free ? parseFloat(form.price_trackout) : null,
        price_exclusive: form.is_free ? null : parseFloat(form.price_exclusive),
        is_free: form.is_free,
        cover_url: coverRes.publicUrl || undefined,
        // Private R2 keys — the download route presigns them per purchase. Store
        // the clean master in the column matching its real format.
        file_mp3_url: cleanIsWav ? undefined : masterKey,
        file_wav_url: cleanIsWav ? masterKey : undefined,
        file_stems_url: stemsRes?.key || undefined,
        status: 'pending', // IMPORTANT: Moved to pending while watermarking
      })

      if (dbError) throw dbError

      // Process collaborators
      if (collaborators.length > 0) {
         const handles = collaborators.map(c => c.handle.replace('@', ''))
         const { data: usersInfo } = await supabase.from('users_profiles').select('id, handle').in('handle', handles)
         if (usersInfo) {
           const splitsToInsert = collaborators.map(c => {
             const u = usersInfo.find(u => u.handle === c.handle.replace('@', ''))
             if (!u) return null
             return { beat_id: beatId, collaborator_id: u.id, split_percentage: Number(c.percentage) }
           }).filter(Boolean)
           
           if (splitsToInsert.length > 0) {
             await supabase.from('beat_collaborators').delete().eq('beat_id', beatId) // clear existing drafts
             await supabase.from('beat_collaborators').insert(splitsToInsert as any)
           }
         }
      }

      // Auto-generate the tagged preview from the clean master the producer
      // just uploaded — no separate "preview" file required.
      if (masterKey) {
        await fetch('/api/audio/queue-watermark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ beat_id: beatId, storage_path: masterKey }),
        })
      }

      router.push('/dashboard/beats')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-text-muted animate-pulse">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black uppercase tracking-tight">Upload Beat</h1>
          {isSaving && (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 animate-pulse">
              <Loader2 className="w-3 h-3 text-accent-orange animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Saving Draft...</span>
            </div>
          )}
          {!isSaving && form.title && (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
              <Save className="w-3 h-3 text-green-500/50" />
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted/50">Draft Saved</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest text-text-muted">
            {limits.max_beats === Infinity ? '∞' : `${beatCount} / ${limits.max_beats}`} beats
          </span>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            tier.toLowerCase() === 'pro' ? 'bg-accent-orange/10 text-accent-orange' :
            tier.toLowerCase() === 'starter' ? 'bg-accent-gold/10 text-accent-gold' :
            'bg-white/5 text-text-muted'
          }`}>{tier.toUpperCase()}</span>
        </div>
      </div>

      {/* Beat limit banner */}
      {atLimit && (
        <div className="bg-accent-orange/10 border border-accent-orange/30 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-accent-orange flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-white">Beat Upload Limit Reached</p>
            <p className="text-sm text-text-muted mt-1">
              You&apos;ve used all {limits.max_beats} beat slots on the {tier.toUpperCase()} plan. Upgrade to upload more beats.
            </p>
            <Link href="/dashboard/subscription" className="inline-block mt-3 px-5 py-2 bg-accent-orange text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-all">
              Upgrade Plan
            </Link>
          </div>
        </div>
      )}

      {/* Approaching limit warning */}
      {!atLimit && limits.max_beats !== Infinity && beatCount >= limits.max_beats - 5 && (
        <div className="bg-accent-gold/10 border border-accent-gold/20 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-accent-gold flex-shrink-0" />
          <p className="text-sm text-text-muted">
            <span className="text-accent-gold font-bold">{limits.max_beats - beatCount} beat slot{limits.max_beats - beatCount !== 1 ? 's' : ''} remaining</span> on your {tier.toUpperCase()} plan.{' '}
            <Link href="/dashboard/subscription" className="text-accent-orange hover:underline font-bold">Upgrade</Link> for more.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${atLimit ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Left: Metadata */}
        <div className="space-y-6">
          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-orange">Basic Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Beat Title</label>
                <input name="title" type="text" value={form.title} onChange={handleInputChange} required
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Genre</label>
                  <select name="genre" value={form.genre} onChange={handleInputChange}
                    className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white">
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">BPM</label>
                  <input name="bpm" type="number" value={form.bpm} onChange={handleInputChange} required placeholder="140"
                    className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Key</label>
                  <select name="key" value={form.key} onChange={handleInputChange}
                    className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white">
                    {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Tags</label>
                  <input name="tags" type="text" value={form.tags} onChange={handleInputChange} placeholder="dark, trap, melodic"
                    className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-bg-surface p-4 rounded-2xl border border-border-subtle flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white">Make this beat free</h3>
              <p className="text-xs text-text-muted mt-0.5">Buyers download for free — great for growing your audience</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" name="is_free" checked={form.is_free} onChange={handleInputChange} className="sr-only peer" />
              <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-accent-orange transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-[#00E676]">Collaborators & Splits</h2>
              <p className="text-xs text-text-muted mt-1 w-full relative">Add co-producers. Primary producer receives the remaining percentage.</p>
            </div>
            <div className="space-y-3">
              {collaborators.map((c, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input type="text" placeholder="@handle" value={c.handle} onChange={e => {
                    const newC = [...collaborators]; newC[i].handle = e.target.value; setCollaborators(newC);
                  }} className="flex-1 bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white" />
                  
                  <div className="flex items-center gap-3">
                    <div className="relative w-24 flex-shrink-0">
                      <input type="number" placeholder="%" value={c.percentage} onChange={e => {
                        const newC = [...collaborators]; newC[i].percentage = e.target.value; setCollaborators(newC);
                      }} className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-orange focus:outline-none transition-colors text-white" />
                    </div>
                    
                    <button type="button" onClick={() => setCollaborators(collaborators.filter((_, idx) => idx !== i))} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setCollaborators([...collaborators, {handle: '', percentage: ''}])} className="w-full h-12 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                 + Add Collaborator
              </button>
            </div>
          </div>

          <div className={`bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4 ${form.is_free ? 'opacity-40 pointer-events-none' : ''}`}>
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-gold">Pricing (USD)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">MP3 Lease</label>
                <input name="price_mp3" type="number" step="0.01" value={form.price_mp3} onChange={handleInputChange}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-gold focus:outline-none transition-colors text-white" />
              </div>
              <div className={!limits.wav_upload ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold flex items-center gap-1">
                  WAV Lease {!limits.wav_upload && <Lock className="w-3 h-3" />}
                </label>
                <input name="price_wav" type="number" step="0.01" value={form.price_wav} onChange={handleInputChange}
                  disabled={!limits.wav_upload}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-gold focus:outline-none transition-colors text-white disabled:opacity-50" />
                {!limits.wav_upload && <p className="text-[10px] text-accent-gold mt-1">Starter+ required</p>}
              </div>
              <div className={!limits.stems_upload ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold flex items-center gap-1">
                  Trackout {!limits.stems_upload && <Lock className="w-3 h-3" />}
                </label>
                <input name="price_trackout" type="number" step="0.01" value={form.price_trackout} onChange={handleInputChange}
                  disabled={!limits.stems_upload}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-gold focus:outline-none transition-colors text-white disabled:opacity-50" />
                {!limits.stems_upload && <p className="text-[10px] text-accent-orange mt-1">PRO required</p>}
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Exclusive</label>
                <input name="price_exclusive" type="number" step="0.01" value={form.price_exclusive} onChange={handleInputChange}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:border-accent-gold focus:outline-none transition-colors text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Files */}
        <div className="space-y-6">
          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-orange">Files</h2>

            {/* Cover Art */}
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Cover Art (1:1)</label>
              <input name="cover" type="file" accept="image/*" onChange={handleFileChange} required
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-white/5 file:text-white hover:file:bg-white/10 transition-all w-full" />
            </div>

            {/* The producer's single clean master (MP3 or WAV). Sold to buyers;
                the tagged preview is auto-generated from it. */}
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold">Your Beat — Clean Audio (MP3 or WAV)</label>
              <input name="mp3Clean" type="file" accept="audio/mpeg,audio/wav,audio/x-wav" onChange={handleFileChange} required
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-white/5 file:text-white hover:file:bg-white/10 transition-all w-full" />
              <p className="text-[10px] text-text-muted/70 mt-1.5 flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-green-500/60 flex-shrink-0 mt-0.5" />
                <span>Upload your finished beat — <b className="text-text-muted">untagged</b>. Listeners browsing hear an auto-generated tagged preview; buyers who purchase download this clean file. No need to tag anything yourself.</span>
              </p>
            </div>

            {/* Stems — PRO only */}
            <div className={!limits.stems_upload ? 'opacity-50' : ''}>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-widest font-bold flex items-center gap-2">
                Stems / Trackout ZIP
                {!limits.stems_upload && (
                  <span className="flex items-center gap-1 text-accent-orange text-[9px] bg-accent-orange/10 px-2 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" /> PRO ONLY
                  </span>
                )}
              </label>
              {limits.stems_upload ? (
                <input name="stemsZip" type="file" accept=".zip,.rar" onChange={handleFileChange}
                  className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-white/5 file:text-white hover:file:bg-white/10 transition-all w-full" />
              ) : (
                <div className="p-4 rounded-xl bg-bg-primary border border-border-subtle flex items-center justify-between">
                  <p className="text-xs text-text-muted">Unlock stems with PRO — sell trackout licenses for premium prices</p>
                  <Link href="/dashboard/subscription" className="text-xs text-accent-orange font-bold hover:underline">Go PRO →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Tier summary */}
          <div className="bg-bg-surface rounded-2xl border border-border-subtle p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Your Plan — {tier.toUpperCase()}</p>
            {[
              { label: `${limits.max_beats === Infinity ? 'Unlimited' : limits.max_beats} beat uploads`, ok: true },
              { label: 'MP3 preview + cover', ok: true },
              { label: 'WAV file uploads', ok: limits.wav_upload },
              { label: 'Stems / trackout uploads', ok: limits.stems_upload },
              { label: `${Math.round(limits.platform_fee * 100)}% platform fee`, ok: limits.platform_fee === 0 },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2">
                {ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  : <Lock className="w-3.5 h-3.5 text-text-muted/40 flex-shrink-0" />}
                <span className={`text-xs ${ok ? 'text-text-muted' : 'text-text-muted/40'}`}>{label}</span>
              </div>
            ))}
            {tier.toLowerCase() !== 'pro' && (
              <Link href="/dashboard/subscription" className="block text-center text-[10px] font-black uppercase tracking-widest text-accent-orange hover:underline mt-2">
                Upgrade for more →
              </Link>
            )}
          </div>

          <button type="submit" disabled={loading || atLimit}
            className="w-full h-14 bg-accent-orange text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-accent-orange/20 disabled:opacity-40">
            <Upload className="w-5 h-5" />
            {loading ? 'Processing audio...' : 'Publish Beat'}
          </button>

          <p className="text-[10px] text-center text-text-muted">
            By publishing, you agree to BeatToday&apos;s Producer Terms of Service.
          </p>
        </div>
      </form>
    </div>
  )
}
