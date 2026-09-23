import { getEggfansImageHostKey } from './app-settings.js'
import { sourceToBlobForImageHost, uploadFileToUguu } from './uguu.js'

const EGGFANS_IMAGE_HOST_ENDPOINT = 'https://imageproxy.zhongzhuan.chat/api/upload'

export type ImageHostProvider = 'uguu' | 'eggfans'
export type ImageHostResult = { url: string; provider: ImageHostProvider }

function parseEggfansUrl(payload: any): string {
  const candidates = [
    payload?.url,
    payload?.image_url,
    payload?.data?.url,
    payload?.data?.image_url,
    payload?.data?.link,
    payload?.data?.src,
    typeof payload?.data === 'string' ? payload.data : '',
  ]
  return candidates.find(value => typeof value === 'string' && /^https?:\/\//i.test(value)) || ''
}

async function uploadFileToEggfans(value: string, mimeHint: string, key: string): Promise<string> {
  const { blob, name } = await sourceToBlobForImageHost(value, mimeHint)
  const form = new FormData()
  form.append('file', blob, name)
  const response = await fetch(EGGFANS_IMAGE_HOST_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  const text = await response.text()
  let payload: any = null
  try { payload = text ? JSON.parse(text) : null } catch { /* non-JSON response */ }
  if (!response.ok) throw new Error(`Eggfans image host upload failed (${response.status})`)
  const url = parseEggfansUrl(payload) || (text.match(/https?:\/\/[^\s"']+/i)?.[0] || '')
  if (!url) throw new Error('Eggfans image host returned no public URL')
  return url
}

export type ImageHostDependencies = {
  uploadUguu?: (value: string, mimeHint: string) => Promise<string>
  uploadEggfans?: (value: string, mimeHint: string, key: string) => Promise<string>
  getEggfansKey?: () => string
}

export async function uploadFileToImageHost(
  value: string,
  mimeHint = 'application/octet-stream',
  dependencies: ImageHostDependencies = {},
): Promise<ImageHostResult> {
  const uploadUguu = dependencies.uploadUguu || uploadFileToUguu
  const uploadEggfans = dependencies.uploadEggfans || uploadFileToEggfans
  const getKey = dependencies.getEggfansKey || getEggfansImageHostKey
  let uguuError = ''
  try { return { url: await uploadUguu(value, mimeHint), provider: 'uguu' } } catch (error) { uguuError = (error as Error).message }
  const key = getKey()
  if (!key) throw new Error(`Uguu 上传失败：${uguuError}；未配置 Eggfans 图床 Key`)
  try { return { url: await uploadEggfans(value, mimeHint, key), provider: 'eggfans' } } catch (error) {
    throw new Error(`Uguu 上传失败：${uguuError}；Eggfans 图床上传失败：${(error as Error).message}`)
  }
}

export { EGGFANS_IMAGE_HOST_ENDPOINT }
