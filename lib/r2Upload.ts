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
  const contentType = (params.contentType || (params.file as File).type || 'application/octet-stream').toLowerCase()

  const presignRes = await fetch('/api/uploads/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purpose: params.purpose,
      verification_version:1,
      beatId: params.beatId,
      ext: params.ext,
      contentType,
      size: params.file.size,
    }),
  })
  if (!presignRes.ok) {
    const msg = await presignRes.json().catch(() => ({}))
    throw new Error(msg.error || 'Failed to prepare upload')
  }
  const { uploadUrl, ticket } = await presignRes.json()
  if(!ticket)throw new Error('Refresh this page before uploading.')

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: params.file,
    headers: { 'Content-Type': contentType },
  })
  if (!putRes.ok) throw new Error('Upload failed — please try again')

  // Reuse the same ticket if publication succeeded but its response was lost.
  for(let attempt=0;attempt<4;attempt++){
    let response:Response
    try{response=await fetch('/api/uploads/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})})}
    catch(error){if(attempt===3)throw error;await new Promise(resolve=>setTimeout(resolve,2000));continue}
    const result=await response.json().catch(()=>null)
    if(response.ok&&result?.key)return {key:result.key,publicUrl:result.publicUrl}
    if((!result||[502,503,504,524].includes(response.status))&&attempt<3){await new Promise(resolve=>setTimeout(resolve,Math.min(10,Number(response.headers.get('Retry-After'))||2)*1000));continue}
    throw new Error(result?.error||'Your file could not be verified. Please try again.')
  }
  throw new Error('Your file could not be verified. Please try again.')
}
