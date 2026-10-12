export function fitWithin(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function decode(file) {
  try {
    return await createImageBitmap(file)
  } catch {
    // Fallback for formats createImageBitmap rejects (e.g. some HEIC files): let <img> decode it
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function resizeImage(file, maxEdge = 1200, quality = 0.8) {
  const source = await decode(file)
  const { width, height } = fitWithin(source.width, source.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, 0, 0, width, height)
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/jpeg', quality))
  return { type: 'image/jpeg', data: await blob.arrayBuffer() }
}
