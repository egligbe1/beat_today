'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

import { showToast } from '@/lib/utils/toast'

interface DownloadButtonProps {
  orderId: string
  beatId: string
  fileType: 'mp3' | 'wav' | 'stems'
  label: string
}

export default function DownloadButton({ orderId, beatId, fileType, label }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/download?beat_id=${beatId}&file=${fileType}&order_id=${orderId}`)
      const data = await res.json()

      if (!res.ok || !data.url) {
        showToast.error(data.error || 'Failed to generate download link.')
        return
      }

      // Trigger browser download
      const a = document.createElement('a')
      a.href = data.url
      a.download = data.filename || `beat-${fileType}`
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
      className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-accent-orange/10 border border-accent-orange/20 text-sm text-accent-orange font-bold uppercase tracking-[0.15em] hover:bg-accent-orange/20 transition-all disabled:opacity-50 w-full justify-center"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {loading ? 'Preparing...' : label}
    </button>
  )
}
