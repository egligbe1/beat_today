import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, FolderOpen, Music } from 'lucide-react'
import CollectionActions from './CollectionActions'

export default async function CollectionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'producer') redirect('/dashboard/unauthorized')

  const { data: collections } = await supabase
    .from('collections')
    .select('*, collection_beats(beat_id)')
    .eq('producer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: beats } = await supabase
    .from('beats')
    .select('id, title, cover_url')
    .eq('producer_id', user.id)
    .eq('status', 'active')

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white">Albums & Collections</h1>
          <p className="text-text-muted text-sm mt-1">Group your beats into albums, EPs, and compilations.</p>
        </div>
        <CollectionActions beats={beats || []} mode="create" />
      </div>

      {collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collections.map((col: any) => (
            <div key={col.id} className="bg-bg-surface rounded-3xl border border-border-subtle overflow-hidden group">
              <div className="relative h-40 bg-bg-elevated overflow-hidden">
                {col.cover_url ? (
                  <Image src={col.cover_url} alt={col.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderOpen className="w-12 h-12 text-text-muted opacity-20" />
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    col.is_published
                      ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {col.is_published ? 'Live' : 'Draft'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-black/40 text-white border border-white/10">
                    {col.collection_type}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-black text-white text-lg">{col.title}</h3>
                  {col.description && <p className="text-sm text-text-muted mt-1 line-clamp-2">{col.description}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Music className="w-3.5 h-3.5" /> {col.collection_beats?.length || 0} tracks
                  </span>
                  <CollectionActions
                    collectionId={col.id}
                    collectionTitle={col.title}
                    collectionDesc={col.description || ''}
                    collectionType={col.collection_type}
                    isPublished={col.is_published}
                    currentBeatIds={col.collection_beats?.map((b: any) => b.beat_id) || []}
                    beats={beats || []}
                    mode="edit"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-bg-surface rounded-3xl border-2 border-dashed border-border-subtle space-y-4">
          <FolderOpen className="w-12 h-12 text-text-muted opacity-30 mx-auto" />
          <p className="font-bold text-text-muted">No collections yet</p>
          <p className="text-sm text-text-muted">Group your beats into albums and EPs to give buyers a richer experience.</p>
        </div>
      )}
    </div>
  )
}
