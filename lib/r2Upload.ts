'use client'

// Browser-side helper: ask our API for a presigned URL, then PUT the file
// straight to R2. Keeps large files off the serverless request path.
export type UploadPurpose = 'cover' | 'master' | 'stems' | 'avatar' | 'producerTag'

export async function uploadToR2(params: {
  purpose: UploadPurpose
  file: Blob
  beatId?: string
  ext?: string
  contentType?: string
}): Promise<{ key: string; publicUrl: string | null }> {
  const contentType = params.contentType || (params.file as File).type || 'application/octet-stream'

  const presignRes = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purpose: params.purpose,
      beatId: params.beatId,
      ext: params.ext,
      contentType,
    }),
  })
  if (!presignRes.ok) {
    const msg = await presignRes.json().catch(() => ({}))
    throw new Error(msg.error || 'Failed to prepare upload')
  }
  const { uploadUrl, key, publicUrl } = await presignRes.json()

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: params.file,
    headers: { 'Content-Type': contentType },
  })
  if (!putRes.ok) throw new Error('Upload failed — please try again')

  return { key, publicUrl }
}
