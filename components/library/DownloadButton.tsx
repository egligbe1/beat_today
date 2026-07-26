'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { showToast } from '@/lib/utils/toast'
import { cn } from '@/lib/utils'

interface DownloadButtonProps {
  orderId: string
  beatId: string
  fileType: 'mp3' | 'wav' | 'stems'
  label: string
  className?: string
}

export default function DownloadButton({ orderId, beatId, fileType, label, className }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      // Fetch the signed URL as JSON, THEN open it — never navigate straight to
      // the API (that would just show the JSON response).
      const res = await fetch(`/api/download?beat_id=${beatId}&file=${fileType}&order_id=${orderId}`)
      const data = await res.json()

      if (!res.ok || !data.url) {
        showToast.error(data.error || 'Failed to generate download link.')
        return
      }

      // The presigned URL sets Content-Disposition: attachment, so navigating
      // to it triggers a download (the `download` attr is ignored cross-origin).
      const a = document.createElement('a')
      a.href = data.url
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      showToast.error('Download failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-3 rounded-full bg-accent-orange/10 border border-accent-orange/20 text-sm text-accent-orange font-bold uppercase tracking-[0.15em] hover:bg-accent-orange/20 transition-all disabled:opacity-50 justify-center',
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? 'Preparing...' : label}
    </button>
  )
}
