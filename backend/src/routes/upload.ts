import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { success, badRequest } from '../utils/response.js'
import { saveUploadedFile, generateImageThumb } from '../utils/storage.js'
import { uploadFileToImageHost } from '../services/image-host.js'

const app = new Hono()

// POST /upload/image
app.post('/image', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || !(file instanceof File)) {
    return badRequest(c, '文件必填')
  }

  const buffer = await file.arrayBuffer()
  const path = await saveUploadedFile(buffer, 'uploads', file.name)
  // 同步生成列表页缩略图，上传图与生图走同一套展示链路（失败不影响上传结果）
  await generateImageThumb(path)
  let publicUrl = ''
  let publicUploadError = ''
  try {
    publicUrl = (await uploadFileToImageHost(path, file.type || 'image/png')).url
  } catch (error) {
    publicUploadError = (error as Error).message || '公共图床上传失败'
  }
  return success(c, {
    url: `/${path}`,
    path,
    public_url: publicUrl || null,
    public_upload_error: publicUploadError || null,
  })
})

type AssetKind = 'character' | 'scene' | 'prop'

async function findAsset(kind: AssetKind, id: number) {
  if (kind === 'character') {
    const [item] = await db.select().from(schema.characters).where(eq(schema.characters.id, id))
    return item
  }
  if (kind === 'scene') {
    const [item] = await db.select().from(schema.scenes).where(eq(schema.scenes.id, id))
    return item
  }
  const [item] = await db.select().from(schema.props).where(eq(schema.props.id, id))
  return item
}

async function saveAssetPublicUrl(kind: AssetKind, id: number, publicUrl: string) {
  if (kind === 'character') {
    await db.update(schema.characters).set({
      publicUrl,
      virtualAssetId: null,
      virtualAssetUri: null,
      virtualAssetSourceUrl: null,
      virtualAssetStatus: null,
    }).where(eq(schema.characters.id, id))
  } else if (kind === 'scene') {
    await db.update(schema.scenes).set({ publicUrl }).where(eq(schema.scenes.id, id))
  } else {
    await db.update(schema.props).set({ publicUrl }).where(eq(schema.props.id, id))
  }
}

// POST /upload/asset-public-url - retry the image-bed upload for an existing asset.
app.post('/asset-public-url', async (c) => {
  const body = await c.req.json()
  const kind = String(body.kind || '') as AssetKind
  const id = Number(body.id)
  if (!['character', 'scene', 'prop'].includes(kind) || !Number.isInteger(id) || id <= 0) {
    return badRequest(c, '资产类型或 ID 无效')
  }

  const item = await findAsset(kind, id)
  if (!item) return badRequest(c, '资产不存在')
  const source = item.localPath || item.imageUrl
  if (!source) return badRequest(c, '请先上传或生成资产图片')

  try {
    const publicUrl = (await uploadFileToImageHost(source, 'image/png')).url
    await saveAssetPublicUrl(kind, id, publicUrl)
    return success(c, { public_url: publicUrl })
  } catch (error) {
    return badRequest(c, `上传图床失败：${(error as Error).message}`)
  }
})

const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v'])
const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
const VIDEO_MAX = 50 * 1024 * 1024 // 50MB

const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.aac'])
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac'])
const AUDIO_MAX = 20 * 1024 * 1024 // 20MB

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

async function saveMediaUpload(
  c: any,
  kind: 'video' | 'audio',
  allowedExt: Set<string>,
  allowedMime: Set<string>,
  maxBytes: number,
) {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) {
    return badRequest(c, '文件必填')
  }
  const label = kind === 'video' ? '视频' : '音频'
  const ext = extOf(file.name)
  // MIME 可伪造，扩展名兜底；空 / octet-stream 视为未知类型，仅按扩展名校验
  const mimeKnown = file.type && file.type !== 'application/octet-stream'
  if (!allowedExt.has(ext) || (mimeKnown && !allowedMime.has(file.type))) {
    return badRequest(c, `仅支持 ${Array.from(allowedExt).join('/')} 格式的${label}文件`)
  }
  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > maxBytes) {
    return badRequest(c, `${label}文件大小不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`)
  }
  const path = await saveUploadedFile(buffer, 'uploads', file.name)
  return success(c, { url: `/${path}`, path })
}

// POST /upload/video — 参考视频上传（Seedance 多模态参考用）
app.post('/video', async (c) => saveMediaUpload(c, 'video', VIDEO_EXT, VIDEO_MIME, VIDEO_MAX))

// POST /upload/audio — 参考音频上传（Seedance 多模态参考用）
app.post('/audio', async (c) => saveMediaUpload(c, 'audio', AUDIO_EXT, AUDIO_MIME, AUDIO_MAX))

export default app
