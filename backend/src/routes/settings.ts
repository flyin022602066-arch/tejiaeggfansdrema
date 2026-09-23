/**
 * 应用设置路由 — 全局配置的读写入口（当前：AI 内容语言）
 */
import { Hono } from 'hono'
import {
  getContentLanguage,
  setContentLanguage,
  CONTENT_LANGUAGES,
  type ContentLanguage,
  getEggfansImageHostKey,
  setEggfansImageHostKey,
  getEggfansVirtualAssetKey,
  setEggfansVirtualAssetKey,
  getVideoAssetReferenceMode,
  setVideoAssetReferenceMode,
} from '../services/app-settings.js'
import { isVideoAssetReferenceMode } from '../services/video-reference-mode.js'
import { VIRTUAL_ASSET_API_BASE } from '../services/virtual-asset-client.js'
import { success, badRequest } from '../utils/response.js'

const app = new Hono()

// GET /content-language — 当前 AI 内容语言
app.get('/content-language', async (c) => {
  return success(c, { language: await getContentLanguage() })
})

// PUT /content-language — 设置 AI 内容语言（body: { language: 'zh'|'en'|'ja'|'ko' }）
app.put('/content-language', async (c) => {
  const body = await c.req.json().catch(() => null)
  const language = body?.language
  if (!(CONTENT_LANGUAGES as readonly string[]).includes(language)) {
    return badRequest(c, `language 必须是 ${CONTENT_LANGUAGES.join(' / ')} 之一`)
  }
  const saved = await setContentLanguage(language as ContentLanguage)
  return success(c, { language: saved })
})

// Eggfans 图床 Key 只在本地后端保存；前端只能读取是否已配置。
app.get('/image-host', (c) => success(c, { configured: !!getEggfansImageHostKey() }))

app.put('/image-host', async (c) => {
  const body = await c.req.json().catch(() => null)
  const value = String(body?.api_key || body?.apiKey || '').trim()
  if (value.length > 4096) return badRequest(c, '图床 Key 无效')
  return success(c, { configured: setEggfansImageHostKey(value) })
})

app.get('/virtual-assets', (c) => success(c, {
  configured: !!getEggfansVirtualAssetKey(),
  base_url: VIRTUAL_ASSET_API_BASE,
}))

app.put('/virtual-assets', async (c) => {
  const body = await c.req.json().catch(() => null)
  const value = String(body?.api_key || body?.apiKey || '').trim()
  if (value.length > 4096) return badRequest(c, '虚拟资产 Key 无效')
  return success(c, {
    configured: setEggfansVirtualAssetKey(value),
    base_url: VIRTUAL_ASSET_API_BASE,
  })
})

app.get('/video-reference-mode', (c) => success(c, {
  asset_reference_mode: getVideoAssetReferenceMode(),
}))

app.put('/video-reference-mode', async (c) => {
  const body = await c.req.json().catch(() => null)
  const mode = body?.asset_reference_mode
  if (!isVideoAssetReferenceMode(mode)) {
    return badRequest(c, 'asset_reference_mode must be uri or url')
  }
  return success(c, {
    asset_reference_mode: setVideoAssetReferenceMode(mode),
  })
})

export default app
