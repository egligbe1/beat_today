'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Music } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrackImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  priority?: boolean
}

export default function TrackImage({ src, alt, className, priority }: TrackImageProps) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div className={cn(
        "w-full h-full bg-bg-primary flex items-center justify-center text-text-muted",
        className
      )}>
        <Music className="w-1/3 h-1/3 opacity-20" />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className={cn("object-cover", className)}
      onError={() => setError(true)}
    />
  )
}
