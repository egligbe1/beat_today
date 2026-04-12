'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Play, Pause, MoreVertical, Music, TrendingUp, Filter } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePlayerStore } from '@/lib/stores/playerStore'
import TrackImage from '@/components/beats/TrackImage'
import Modal from '@/components/ui/Modal'
import { showToast } from '@/lib/utils/toast'
import { Trash2 } from 'lucide-react'

import { useAuth } from '@/components/providers/AuthProvider'

export default function ProducerBeatsDashboard() {
  const { user, loading: authLoading } = useAuth()
  const [beats, setBeats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [beatToDelete, setBeatToDelete] = useState<any>(null)
  const supabase = createClient()

  const { currentBeat, isPlaying, togglePlay, setBeat } = usePlayerStore()

  useEffect(() => {
    async function loadBeats() {
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('beats')
        .select(`
          id, 
          title, 
          genre, 
          bpm, 
          status, 
          watermark_status, 
          is_free, 
          price_mp3, 
          cover_url, 
          mp3_preview_url, 
          play_count, 
          created_at, 
          users_profiles!producer_id(handle, display_name)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Error fetching beats:', fetchError)
        showToast.error(`Failed to load beats: ${fetchError.message}`)
      }
      
      if (data) setBeats(data)
      setLoading(false)
    }
    
    if (!authLoading) {
      loadBeats()
    }
  }, [supabase, user, authLoading])

  const [statusFilter, setStatusFilter] = useState('all')
  const [genreFilter, setGenreFilter] = useState('all')

  const filteredBeats = beats.filter(beat => {
    const statusMatch = statusFilter === 'all' || beat.status === statusFilter
    const genreMatch = genreFilter === 'all' || beat.genre === genreFilter
    return statusMatch && genreMatch
  })

  const confirmDelete = async () => {
    if (!beatToDelete) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/beats/${beatToDelete.id}`, {
        method: 'DELETE',
      })
      
      const result = await response.json()
      
      // If the response is not OK and it's NOT a success result (our API now returns success: true for missing beats)
      if (!response.ok && !result.success) {
        throw new Error(result.error || 'Failed to delete')
      }
      
      // Update UI state
      setBeats(prev => prev.filter(b => b.id !== beatToDelete.id))
      
      if (result.message && result.message.includes('already removed')) {
        showToast.success('Track was already removed.')
      } else {
        showToast.success('Track and associated files deleted successfully.')
      }
      
      setBeatToDelete(null)
    } catch (err: any) {
      console.error('Deletion error:', err)
      showToast.error('Failed to delete track: ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePlay = (beat: any) => {
    if (beat.watermark_status !== 'done') {
      showToast.error('Audio is still being processed. Please wait a moment.')
      return
    }
    if (currentBeat?.id === beat.id) {
      togglePlay()
    } else {
      setBeat({
        id: beat.id,
        title: beat.title,
        producer_name: beat.users_profiles.display_name,
        cover_url: beat.cover_url,
        mp3_preview_url: beat.mp3_preview_url,
      })
    }
  }

  if (loading) {
     return <div className="p-8 text-center text-text-muted animate-pulse">Loading tracks...</div>
  }

  const GENRES = Array.from(new Set(beats.map(b => b.genre)))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">My Beats</h1>
          <p className="text-text-muted text-sm mt-1">Manage your uploaded catalog and track performance.</p>
        </div>
        <Link 
          href="/dashboard/upload" 
          className="h-12 px-6 bg-[#FF5500] hover:bg-[#ff6a1f] text-white rounded-xl font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg hover:shadow-[#FF5500]/20 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Upload New Beat
        </Link>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border-subtle flex flex-col md:flex-row items-center justify-between gap-4">
           <div className="flex items-center gap-2 text-text-muted">
               <Music className="w-4 h-4" /> 
               <span className="font-bold uppercase tracking-widest text-xs">{filteredBeats.length} Tracks Found</span>
           </div>
           
           <div className="flex flex-wrap items-center gap-3">
               <select 
                 value={statusFilter} 
                 onChange={(e) => setStatusFilter(e.target.value)}
                 className="bg-bg-primary text-xs font-bold uppercase tracking-widest text-text-muted px-3 py-2 rounded-lg border border-border-subtle focus:outline-none focus:border-accent-orange transition-all cursor-pointer"
               >
                   <option value="all">All Status</option>
                   <option value="active">Active</option>
                   <option value="draft">Draft</option>
                   <option value="pending">Pending</option>
               </select>

               <select 
                 value={genreFilter} 
                 onChange={(e) => setGenreFilter(e.target.value)}
                 className="bg-bg-primary text-xs font-bold uppercase tracking-widest text-text-muted px-3 py-2 rounded-lg border border-border-subtle focus:outline-none focus:border-accent-orange transition-all cursor-pointer"
               >
                  <option value="all">All Genres</option>
                  {GENRES.map(g => (
                    <option key={g as string} value={g as string}>{g as string}</option>
                  ))}
               </select>
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-bg-primary/50 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
                <th className="p-4 pl-6">Track Info</th>
                <th className="p-4">Status</th>
                <th className="p-4">Genre</th>
                <th className="p-4">BPM</th>
                <th className="p-4 text-center">Plays</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredBeats.length === 0 ? (
                <tr>
                   <td colSpan={6} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                         <div className="w-20 h-20 bg-bg-primary rounded-full flex items-center justify-center border border-border-subtle shadow-inner">
                            <Music className="w-8 h-8 text-text-muted opacity-20" />
                         </div>
                         <div className="space-y-2">
                            <h3 className="text-xl font-black uppercase text-white">No beats match your filters</h3>
                            <p className="text-text-muted text-sm max-w-xs mx-auto">Try adjusting your filters or upload a new track to get started.</p>
                         </div>
                      </div>
                   </td>
                </tr>
              ) : (
                filteredBeats.map((beat) => {
                  const active = currentBeat?.id === beat.id && isPlaying
                  return (
                    <tr key={beat.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-4">
                          {/* Play Button & Cover */}
                          <div className={`relative w-12 h-12 rounded-lg overflow-hidden bg-bg-elevated flex-shrink-0 border border-white/5 transition-all ${beat.watermark_status === 'done' ? 'cursor-pointer group-hover:border-white/20' : 'opacity-50 cursor-not-allowed'}`} onClick={() => handlePlay(beat)}>
                             <TrackImage src={beat.cover_url} alt={beat.title} />
                             <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                {beat.watermark_status === 'done' ? (
                                  active ? <Pause className="w-5 h-5 text-[#FF5500] fill-current" /> : <Play className="w-5 h-5 text-white fill-current ml-1" />
                                ) : (
                                  <Music className="w-4 h-4 text-white/40 animate-pulse" />
                                )}
                             </div>
                          </div>
                          
                          <div className="min-w-0">
                            <Link href={`/beats/${beat.id}`} className="block hover:text-[#FF5500] transition-colors">
                                <h4 className="font-bold text-white text-sm truncate">{beat.title}</h4>
                            </Link>
                            <p className="text-xs text-text-muted mt-0.5 truncate">${beat.price_mp3} Basic License</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              beat.status === 'active' 
                                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                  : beat.status === 'draft'
                                  ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                  : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' // pending/review
                          }`}>
                             {beat.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                             {beat.status}
                          </span>
                          
                          {beat.watermark_status !== 'done' && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              beat.watermark_status === 'failed' ? 'text-red-400' : 'text-accent-gold'
                            }`}>
                              {beat.watermark_status === 'failed' ? (
                                <>Error Tagging</>
                              ) : (
                                <><span className="w-1 h-1 rounded-full bg-accent-gold animate-bounce" /> Processing Audio</>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-text-muted font-medium">{beat.genre}</td>
                      <td className="p-4 text-sm text-text-muted font-medium">{beat.bpm}</td>
                      <td className="p-4 text-center">
                         <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted font-bold">
                            <TrendingUp className="w-3.5 h-3.5 text-accent-gold" /> {beat.play_count || 0}
                         </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                         <div className="relative inline-block text-left group/menu">
                            <button className="p-2 text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                            {/* Simple Dropdown Menu */}
                            <div className="absolute right-0 top-full mt-1 w-40 bg-bg-surface border border-border-subtle rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 overflow-hidden">
                                {beat.status === 'draft' ? (
                                  <Link href={`/dashboard/upload?id=${beat.id}`} className="block w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-accent-orange hover:bg-white/5 transition-colors text-left">
                                      Continue Upload
                                  </Link>
                                ) : (
                                  <Link href={`/dashboard/beats/edit/${beat.id}`} className="block w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 transition-colors text-left">
                                      Edit Track
                                  </Link>
                                )}
                                <button 
                                  onClick={() => setBeatToDelete(beat)}
                                  className="block w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-500/80 hover:text-red-500 hover:bg-red-500/5 transition-colors text-left"
                                >
                                    Delete
                                </button>
                            </div>
                         </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!beatToDelete}
        onClose={() => setBeatToDelete(null)}
        title="Delete Track"
        description={`Are you sure you want to delete "${beatToDelete?.title}"? This action cannot be undone and will remove the track from the marketplace.`}
        confirmLabel="Delete Track"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}
