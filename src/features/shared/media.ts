import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { LeadraMediaFile, LookupKind, LookupValue, MediaType } from '../../lib/types'

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(String(reader.result))
    }
    reader.onerror = () => reject(new Error('Unable to read image file.'))
    reader.readAsDataURL(file)
  })
}

export function useLookupThumbnailSources(lookupValues: LookupValue[]) {
  const [sources, setSources] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const inlineSources: Record<string, string> = {}
    const storageItems = lookupValues
      .filter((value) => value.thumbnailPath)
      .map((value) => ({ id: value.id, path: value.thumbnailPath! }))
      .filter((item) => {
        if (item.path.startsWith('data:') || item.path.startsWith('blob:')) {
          inlineSources[item.id] = item.path
          return false
        }
        return true
      })

    setSources(inlineSources)
    if (!supabase || !isSupabaseConfigured || storageItems.length === 0) return undefined

    async function loadSignedSources() {
      const entries = await Promise.all(storageItems.map(async (item) => {
        const { data, error } = await supabase!.storage.from('company-assets').createSignedUrl(item.path, 60 * 60)
        return error || !data?.signedUrl ? null : [item.id, data.signedUrl] as const
      }))
      if (!cancelled) {
        setSources({
          ...inlineSources,
          ...Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))),
        })
      }
    }

    void loadSignedSources()
    return () => {
      cancelled = true
    }
  }, [lookupValues])

  return sources
}

export function safeAssetFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'thumbnail'
}

export async function uploadLookupThumbnail(kind: LookupKind, lookupId: string, file: File): Promise<string> {
  if (!supabase || !isSupabaseConfigured) return fileToDataUrl(file)
  const path = `lookup-thumbnails/${kind}/${lookupId}/${Date.now()}-${safeAssetFileName(file.name)}`
  const { error } = await supabase.storage.from('company-assets').upload(path, file, {
    contentType: file.type || 'image/*',
    upsert: true,
  })
  if (error) throw new Error(error.message)
  return path
}

export async function removeLookupThumbnail(path: string): Promise<void> {
  if (!supabase || !isSupabaseConfigured || path.startsWith('data:')) return
  await supabase.storage.from('company-assets').remove([path])
}

export function fileToMedia(file: File): Promise<LeadraMediaFile> {
  const type = mediaTypeForFile(file)
  return fileToDataUrl(file).then((url) => ({
    id: `media-${Date.now()}-${file.name}`,
    type,
    url,
    name: file.name,
    sizeBytes: file.size,
    includeInPdf: type === 'image',
  }))
}

function mediaTypeForFile(file: File): MediaType {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('video/') || /\.(mp4|mov|m4v|avi|webm|mkv)$/i.test(name)) return 'video'
  return 'unsupported'
}
