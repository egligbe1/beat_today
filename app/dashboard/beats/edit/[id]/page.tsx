'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Upload, Save, Loader2, Music } from 'lucide-react'
import { convertToWebP } from '@/lib/utils/storageUtils'

const GENRES = [
  'Afrobeats', 'Amapiano', 'Afro-drill', 'Trap Dancehall', 'Dancehall',
  'Gengetone', 'Bongo Flava', 'Highlife', 'Fuji', 'Afrobeats x Trap',
  'Shatta', 'Afrosoul', 'Afro-R&B', 'South African Hip-Hop', 'Gqom',
  'Kwaito', 'UK Afroswing', 'Afro-bashment', 'Instrumental Hip-Hop', 'Global'
]

const KEYS = ['C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m', 'A', 'Am', 'A#', 'A#m', 'B', 'Bm']

export default function EditBeatPage() {
  const params = useParams()
  const beatId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    genre: 'Afrobeats',
    bpm: '',
    key: 'C',
    tags: '',
    status: 'active',
    price_mp3: '19.99',
    price_wav: '39.99',
    price_trackout: '99.99',
    price_exclusive: '499.99',
    is_free: false,
  })

  const [files, setFiles] = useState<{
    cover: File | null
    mp3Preview: File | null
    mp3Clean: File | null
    wavFile: File | null
    stemsZip: File | null
  }>({ cover: null, mp3Preview: null, mp3Clean: null, wavFile: null, stemsZip: null })

  useEffect(() => {
    async function loadBeat() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: beat, error } = await supabase
        .from('beats')
        .select('*')
        .eq('id', beatId)
        .eq('producer_id', user.id)
        .single()

      if (error || !beat) { router.push('/dashboard/beats'); return }

      setForm({
        title: beat.title || '',
        genre: beat.genre || 'Afrobeats',
        bpm: beat.bpm?.toString() || '',
        key: beat.key || 'C',
        tags: (beat.mood_tags || []).join(', '),
        status: beat.status || 'active',
        price_mp3: beat.price_mp3?.toString() || '19.99',
        price_wav: beat.price_wav?.toString() || '39.99',
        price_trackout: beat.price_trackout?.toString() || '99.99',
        price_exclusive: beat.price_exclusive?.toString() || '499.99',
        is_free: beat.is_free || false,
      })
      if (beat.cover_url) setCoverPreview(beat.cover_url)
      setLoading(false)
    }
    loadBeat()
  }, [beatId, supabase, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    if (e.target.name === 'mp3Preview') {
      // Upload same file to both beat-previews (public→watermarked) and beat-files (private→clean delivery)
      setFiles(prev => ({ ...prev, mp3Preview: file, mp3Clean: file }))
    } else {
      setFiles(prev => ({ ...prev, [e.target.name]: file }))
    }
    if (e.target.name === 'cover') {
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const uploadResults: Record<string, string> = {}
      const storagePaths: Record<string, string> = {}

      // Upload only changed files
      const fileTasks = [
        { name: 'cover', bucket: 'beat-covers', path: `${user.id}/${beatId}-cover-${Date.now()}.webp`, public: true },
        { name: 'mp3Preview', bucket: 'beat-previews', path: `${user.id}/${beatId}-preview-${Date.now()}.mp3`, public: true },
        { name: 'mp3Clean', bucket: 'beat-files', path: `${user.id}/${beatId}-clean.mp3`, public: false },
        { name: 'wavFile', bucket: 'beat-files', path: `${user.id}/${beatId}-main.wav`, public: false },
        { name: 'stemsZip', bucket: 'beat-files', path: `${user.id}/${beatId}-stems.zip`, public: false },
      ]

      await Promise.all(fileTasks.map(async (task) => {
        let file = (files as any)[task.name]
        if (!file) return

        // Convert cover to WebP before upload
        if (task.name === 'cover') {
          try {
            file = await convertToWebP(file)
          } catch (err) {
            console.error('WebP conversion failed, using original:', err)
          }
        }

        // Upsert (overwrite) existing file
        const { data, error: uploadError } = await supabase.storage
          .from(task.bucket)
          .upload(task.path, file, { upsert: true })

        if (uploadError) throw uploadError

        storagePaths[task.name] = task.path

        if (task.public) {
          const { data: { publicUrl } } = supabase.storage.from(task.bucket).getPublicUrl(task.path)
          uploadResults[task.name] = publicUrl
        } else {
          uploadResults[task.name] = data.path
        }
      }))

      // Build update payload (only include file fields if files were changed)
      const updatePayload: Record<string, any> = {
        title: form.title,
        genre: form.genre,
        bpm: parseInt(form.bpm),
        key: form.key,
        mood_tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        status: form.status,
        price_mp3: parseFloat(form.price_mp3),
        price_wav: parseFloat(form.price_wav),
        price_trackout: parseFloat(form.price_trackout),
        price_exclusive: parseFloat(form.price_exclusive),
        is_free: form.is_free,
        updated_at: new Date().toISOString(),
      }

      if (uploadResults.cover) updatePayload.cover_url = uploadResults.cover
      if (uploadResults.mp3Preview) updatePayload.mp3_preview_url = uploadResults.mp3Preview
      if (uploadResults.mp3Clean) updatePayload.file_mp3_url = uploadResults.mp3Clean
      if (uploadResults.wavFile) updatePayload.file_wav_url = uploadResults.wavFile
      if (uploadResults.stemsZip) updatePayload.file_stems_url = uploadResults.stemsZip

      const { error: dbError } = await supabase
        .from('beats')
        .update(updatePayload)
        .eq('id', beatId)
        .eq('producer_id', user.id)

      if (dbError) throw dbError

      // Queue watermark if MP3 preview was replaced
      if (storagePaths.mp3Preview) {
        fetch('/api/audio/queue-watermark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ beat_id: beatId, storage_path: storagePaths.mp3Preview }),
        }).catch(() => {/* cron will pick it up */})
      }

      router.push('/dashboard/beats')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent-orange" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/beats" className="p-2 rounded-xl bg-bg-surface border border-border-subtle hover:border-accent-orange transition-colors text-text-muted hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Edit Beat</h1>
          <p className="text-text-muted text-sm mt-0.5">Update your track details. Leave file fields empty to keep existing files.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Metadata */}
        <div className="space-y-6">
          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-orange">Basic Details</h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Beat Title</label>
              <input
                name="title"
                type="text"
                value={form.title}
                onChange={handleInputChange}
                className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-orange transition-colors text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Genre</label>
                <select
                  name="genre"
                  value={form.genre}
                  onChange={handleInputChange}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-orange transition-colors text-white"
                >
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">BPM</label>
                <input
                  name="bpm"
                  type="number"
                  value={form.bpm}
                  onChange={handleInputChange}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-orange transition-colors text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Key</label>
                <select
                  name="key"
                  value={form.key}
                  onChange={handleInputChange}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-orange transition-colors text-white"
                >
                  {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleInputChange}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-orange transition-colors text-white"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">Tags (comma separated)</label>
              <input
                name="tags"
                type="text"
                value={form.tags}
                onChange={handleInputChange}
                placeholder="dark, hard, melodic"
                className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-orange transition-colors text-white"
              />
            </div>
          </div>

          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-gold">Pricing (USD)</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'price_mp3', label: 'MP3 Lease' },
                { name: 'price_wav', label: 'WAV Lease' },
                { name: 'price_trackout', label: 'Trackout' },
                { name: 'price_exclusive', label: 'Exclusive' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">{field.label}</label>
                  <input
                    name={field.name}
                    type="number"
                    step="0.01"
                    value={(form as any)[field.name]}
                    onChange={handleInputChange}
                    className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent-gold transition-colors text-white"
                  />
                </div>
              ))}
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
        </div>

        {/* Right: Files */}
        <div className="space-y-6">
          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-orange">Cover Art</h2>
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-bg-primary border-2 border-dashed border-border-subtle group cursor-pointer hover:border-accent-orange transition-colors">
              {coverPreview ? (
                <Image src={coverPreview} alt="Cover preview" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Music className="w-12 h-12 text-text-muted opacity-30" />
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Current cover</span>
                </div>
              )}
              <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 hover:bg-black/50 transition-all group">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-white" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Replace Cover</span>
                </div>
                <input name="cover" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-accent-orange">Replace Files (Optional)</h2>
            <p className="text-xs text-text-muted">Leave empty to keep your existing files.</p>

            {[
              { name: 'mp3Preview', label: 'MP3 Preview', accept: 'audio/mpeg' },
              { name: 'wavFile', label: 'Main WAV File', accept: 'audio/wav' },
              { name: 'stemsZip', label: 'Stems ZIP', accept: '.zip' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted mb-2">{f.label}</label>
                <input
                  name={f.name}
                  type="file"
                  accept={f.accept}
                  onChange={handleFileChange}
                  className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-bg-primary file:text-accent-orange hover:file:bg-bg-elevated transition-all"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-14 bg-accent-orange hover:bg-[#ff6a1f] text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-accent-orange/20 disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Saving Changes...</>
            ) : (
              <><Save className="w-5 h-5" /> Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
