/**
 * Converts a File (image) to a WebP Blob using the browser's Canvas API.
 * This ensures all uploaded cover art is optimized and has a consistent format.
 */
export async function convertToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Only process images
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'))
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            return reject(new Error('Could not get canvas context'))
          }

          // Maintain aspect ratio or force square if needed?
          // For now, we maintain original dimensions but convert format.
          canvas.width = img.width
          canvas.height = img.height
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0)
          
          // Convert to WebP Blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Canvas toBlob failed'))
              }
            },
            'image/webp',
            quality
          )
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image into element'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
