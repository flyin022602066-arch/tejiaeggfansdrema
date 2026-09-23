import fs from 'fs/promises'
import path from 'path'
import { getAbsolutePath } from '../utils/storage.js'

const UGUU_ENDPOINT = 'https://uguu.se/upload.php'

function extensionFromMime(mime: string): string {
  const value = mime.toLowerCase()
  if (value.includes('png')) return '.png'
  if (value.includes('jpeg') || value.includes('jpg')) return '.jpg'
  if (value.includes('webp')) return '.webp'
  if (value.includes('mp4')) return '.mp4'
  if (value.includes('webm')) return '.webm'
  if (value.includes('mpeg') || value.includes('mp3')) return '.mp3'
  if (value.includes('wav')) return '.wav'
  return '.bin'
}

async function sourceToBlob(value: string, mimeHint: string): Promise<{ blob: Blob; name: string }> {
  const source = value.startsWith('/') ? value.slice(1) : value
  if (source.startsWith('data:')) {
    const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
    if (!match) throw new Error('无效的 data URL')
    const mime = match[1] || mimeHint || 'application/octet-stream'
    const bytes = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]))
    return { blob: new Blob([bytes], { type: mime }), name: `reference${extensionFromMime(mime)}` }
  }
  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`读取远程素材失败 (${response.status})`)
    const mime = response.headers.get('content-type')?.split(';')[0] || mimeHint
    const bytes = Buffer.from(await response.arrayBuffer())
    const remoteName = path.basename(new URL(value).pathname) || `reference${extensionFromMime(mime)}`
    return { blob: new Blob([bytes], { type: mime }), name: remoteName }
  }
  const absolute = source.startsWith('static/') ? getAbsolutePath(source) : source
  const bytes = await fs.readFile(absolute)
  return { blob: new Blob([bytes], { type: mimeHint }), name: path.basename(absolute) || `reference${extensionFromMime(mimeHint)}` }
}

// Shared by alternate image hosts; kept separate from the Uguu endpoint logic.
export const sourceToBlobForImageHost = sourceToBlob

export async function uploadFileToUguu(value: string, mimeHint = 'application/octet-stream'): Promise<string> {
  const { blob, name } = await sourceToBlob(value, mimeHint)
  const form = new FormData()
  form.append('files[]', blob, name)
  const response = await fetch(UGUU_ENDPOINT, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`Uguu upload failed (${response.status})`)
  const payload = await response.json() as { success?: boolean; files?: Array<{ url?: string }> }
  const url = payload.files?.[0]?.url
  if (!payload.success || !url || !/^https?:\/\//i.test(url)) throw new Error('Uguu returned no public URL')
  return url
}

export function isPublicHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
