'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, MessageCircle, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CommentDrawerProps {
  beatId: string
  onClose: () => void
  onCommentAdded: () => void
}

export default function CommentDrawer({ beatId, onClose, onCommentAdded }: CommentDrawerProps) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/beats/${beatId}/comments`)
      .then(r => r.json())
      .then(data => {
        setComments(data)
        setLoading(false)
      })
  }, [beatId])

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || posting) return
    setPosting(true)
    try {
      const res = await fetch(`/api/beats/${beatId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      })
      const comment = await res.json()
      if (!comment.error) {
        setComments([comment, ...comments])
        setNewComment('')
        onCommentAdded()
      }
    } finally {
      setPosting(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]" />
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        exit={{ y: '100%' }} 
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 h-[70vh] bg-bg-surface border-t border-white/10 rounded-t-[40px] z-[100] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
           <div>
             <h3 className="text-white font-black uppercase tracking-widest text-sm">Comments</h3>
             <p className="text-[10px] text-text-muted mt-1 font-bold">{comments.length} thoughts shared</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
             <X className="w-5 h-5 text-white" />
           </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
           {loading ? (
             <div className="h-full flex items-center justify-center">
               <Loader2 className="w-8 h-8 text-accent-orange animate-spin opacity-50" />
             </div>
           ) : comments.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
               <MessageCircle className="w-16 h-16 mb-4" />
               <p className="font-black uppercase tracking-widest text-xs">Be the first to speak</p>
             </div>
           ) : (
             comments.map((comment) => (
               <div key={comment.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                    <img src={comment.users_profiles.avatar_url || '/default-avatar.webp'} alt={`${comment.users_profiles.handle} avatar`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-black text-white hover:text-accent-orange transition-colors">@{comment.users_profiles.handle}</span>
                       <span className="text-[10px] text-text-muted">{formatDistanceToNow(new Date(comment.created_at))} ago</span>
                    </div>
                    <p className="text-sm text-text-muted leading-relaxed">{comment.content}</p>
                  </div>
               </div>
             ))
           )}
        </div>

        <form onSubmit={submitComment} className="p-6 bg-black/40 border-t border-white/5 flex gap-3 pb-safe">
           <input 
             value={newComment}
             onChange={(e) => setNewComment(e.target.value)}
             placeholder="Join the conversation..."
             className="flex-1 h-12 bg-white/5 rounded-2xl border border-white/10 px-5 text-sm font-medium focus:outline-none focus:border-accent-orange transition-all"
           />
           <button 
             disabled={!newComment.trim() || posting}
             className="w-12 h-12 bg-accent-orange text-white rounded-2xl flex items-center justify-center hover:bg-orange-600 transition-all disabled:opacity-50 disabled:grayscale"
           >
             {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
           </button>
        </form>
      </motion.div>
    </>
  )
}
