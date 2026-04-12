'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Loader2, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { showToast } from '@/lib/utils/toast'

interface Beat { id: string; title: string; cover_url: string | null }

interface Props {
  mode: 'create' | 'edit'
  beats: Beat[]
  collectionId?: string
  collectionTitle?: string
  collectionDesc?: string
  collectionType?: string
  isPublished?: boolean
  currentBeatIds?: string[]
}

export default function CollectionActions({
  mode,
  beats,
  collectionId,
  collectionTitle,
  collectionDesc,
  collectionType = 'album',
  isPublished = false,
  currentBeatIds = [],
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [form, setForm] = useState({
    title: collectionTitle || '',
    description: collectionDesc || '',
    type: collectionType,
    is_published: isPublished,
    selectedBeats: new Set<string>(currentBeatIds),
  })

  const toggleBeat = (id: string) => {
    setForm(prev => {
      const next = new Set(prev.selectedBeats)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...prev, selectedBeats: next }
    })
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (mode === 'create') {
        const { data: col, error } = await supabase
          .from('collections')
          .insert({
            producer_id: user.id,
            title: form.title,
            description: form.description || null,
            collection_type: form.type,
            is_published: form.is_published,
          })
          .select('id')
          .single()

        if (error) throw error

        // Insert beats
        const beatInserts = Array.from(form.selectedBeats).map((bid, i) => ({
          collection_id: col.id,
          beat_id: bid,
          position: i,
        }))
        if (beatInserts.length > 0) {
          await supabase.from('collection_beats').insert(beatInserts)
        }
      } else if (collectionId) {
        await supabase
          .from('collections')
          .update({
            title: form.title,
            description: form.description || null,
            collection_type: form.type,
            is_published: form.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq('id', collectionId)

        // Replace beat list
        await supabase.from('collection_beats').delete().eq('collection_id', collectionId)
        const beatInserts = Array.from(form.selectedBeats).map((bid, i) => ({
          collection_id: collectionId,
          beat_id: bid,
          position: i,
        }))
        if (beatInserts.length > 0) {
          await supabase.from('collection_beats').insert(beatInserts)
        }
      }

      setOpen(false)
      showToast.success('Collection saved!')
      router.refresh()
    } catch (err: any) {
      showToast.error('Failed to save collection: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!collectionId) return
    setIsDeleting(true)
    try {
      await supabase.from('collections').delete().eq('id', collectionId)
      showToast.success('Collection deleted')
      setShowDeleteConfirm(false)
      router.refresh()
    } catch (err: any) {
      showToast.error('Failed to delete: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {mode === 'create' ? (
        <button
          onClick={() => setOpen(true)}
          className="h-12 px-6 bg-accent-orange hover:bg-[#ff6a1f] text-white rounded-xl font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" /> New Collection
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(true)} className="p-2 text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} disabled={loading} className="p-2 text-text-muted hover:text-red-500 rounded-lg hover:bg-red-500/5 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-bg-surface rounded-3xl border border-border-subtle shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">{mode === 'create' ? 'New Collection' : 'Edit Collection'}</h2>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
                  placeholder="Album title"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange resize-none"
                  placeholder="About this collection..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
                  >
                    <option value="album">Album</option>
                    <option value="ep">EP</option>
                    <option value="compilation">Compilation</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border-subtle hover:border-accent-orange transition-colors">
                    <input
                      type="checkbox"
                      checked={form.is_published}
                      onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm font-bold text-white">Publish</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 block">Select Beats ({form.selectedBeats.size} selected)</label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 bg-bg-primary rounded-xl p-3 border border-border-subtle">
                  {beats.map(beat => {
                    const selected = form.selectedBeats.has(beat.id)
                    return (
                      <button
                        key={beat.id}
                        type="button"
                        onClick={() => toggleBeat(beat.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                          selected ? 'bg-accent-orange/10 border border-accent-orange/20' : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          selected ? 'bg-accent-orange border-accent-orange' : 'border-border-subtle'
                        }`}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm text-white truncate">{beat.title}</span>
                      </button>
                    )
                  })}
                  {beats.length === 0 && <p className="text-xs text-text-muted p-2">No active beats found.</p>}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading || !form.title.trim()}
              className="w-full h-12 bg-accent-orange text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#ff6a1f] transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === 'create' ? 'Create Collection' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Collection"
        description={`Are you sure you want to delete "${collectionTitle}"? All your settings for this collection will be removed, but your beats will remain safe.`}
        confirmLabel="Delete Collection"
        onConfirm={handleDelete}
        isLoading={isDeleting}
        variant="danger"
      />
    </>
  )
}
