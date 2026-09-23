/**
 * 应用级全局设置（app_settings key-value 表）
 * AI 内容语言：所有 Agent 产出（剧本/提取/分镜/提示词）统一使用的目标语言
 * 层次约束：本模块只依赖 db，严禁反向 import agents/*（agents/context.ts 会引用本模块）
 *
 * 注意：刻意做成同步 API（better-sqlite3 驱动的 .get()/.run()），
 * 供 agents/context.ts 的同步 buildAgentRequestContext 内部直接调用
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import {
  normalizeVideoAssetReferenceMode,
  type VideoAssetReferenceMode,
} from './video-reference-mode.js'

export const CONTENT_LANGUAGES = ['zh', 'en', 'ja', 'ko'] as const
export type ContentLanguage = typeof CONTENT_LANGUAGES[number]

const CONTENT_LANGUAGE_KEY = 'content_language'
export const EGGFANS_IMAGE_HOST_KEY = 'eggfans_image_host_api_key'
export const EGGFANS_VIRTUAL_ASSET_KEY = 'eggfans_virtual_asset_api_key'
export const VIDEO_ASSET_REFERENCE_MODE_KEY = 'video_asset_reference_mode'

function isContentLanguage(v: unknown): v is ContentLanguage {
  return typeof v === 'string' && (CONTENT_LANGUAGES as readonly string[]).includes(v)
}

/** 读取全局内容语言；未设置或值非法时回退 'zh'（保持历史默认行为） */
export function getContentLanguage(): ContentLanguage {
  const row = db.select().from(schema.appSettings)
    .where(eq(schema.appSettings.key, CONTENT_LANGUAGE_KEY))
    .get()
  return isContentLanguage(row?.value) ? row.value : 'zh'
}

/** 写入全局内容语言（upsert） */
export function setContentLanguage(lang: ContentLanguage): ContentLanguage {
  if (!isContentLanguage(lang)) throw new Error(`Invalid content language: ${lang}`)
  db.insert(schema.appSettings)
    .values({ key: CONTENT_LANGUAGE_KEY, value: lang, updatedAt: now() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: lang, updatedAt: now() },
    })
    .run()
  return lang
}

/** Read the optional Eggfans image-host key without exposing it to the UI. */
export function getEggfansImageHostKey(): string {
  const row = db.select().from(schema.appSettings)
    .where(eq(schema.appSettings.key, EGGFANS_IMAGE_HOST_KEY))
    .get()
  return String(row?.value || '').trim()
}

/** Persist (or clear) the optional Eggfans image-host key. */
export function setEggfansImageHostKey(value: string): boolean {
  const key = String(value || '').trim()
  if (!key) {
    db.delete(schema.appSettings).where(eq(schema.appSettings.key, EGGFANS_IMAGE_HOST_KEY)).run()
    return false
  }
  db.insert(schema.appSettings)
    .values({ key: EGGFANS_IMAGE_HOST_KEY, value: key, updatedAt: now() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: key, updatedAt: now() },
    })
    .run()
  return true
}

/** Read the Mijing virtual-asset key without exposing the secret to the UI. */
export function getEggfansVirtualAssetKey(): string {
  const row = db.select().from(schema.appSettings)
    .where(eq(schema.appSettings.key, EGGFANS_VIRTUAL_ASSET_KEY))
    .get()
  return String(row?.value || '').trim()
}

/** Persist or clear the virtual-asset key used only by the local backend. */
export function setEggfansVirtualAssetKey(value: string): boolean {
  const key = String(value || '').trim()
  if (!key) {
    db.delete(schema.appSettings).where(eq(schema.appSettings.key, EGGFANS_VIRTUAL_ASSET_KEY)).run()
    return false
  }
  db.insert(schema.appSettings)
    .values({ key: EGGFANS_VIRTUAL_ASSET_KEY, value: key, updatedAt: now() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: key, updatedAt: now() },
    })
    .run()
  return true
}

/** Read the last video asset reference mode. Existing installs default to URI mode. */
export function getVideoAssetReferenceMode(): VideoAssetReferenceMode {
  const row = db.select().from(schema.appSettings)
    .where(eq(schema.appSettings.key, VIDEO_ASSET_REFERENCE_MODE_KEY))
    .get()
  return normalizeVideoAssetReferenceMode(row?.value)
}

/** Persist the user's preferred mode for subsequently created video tasks. */
export function setVideoAssetReferenceMode(value: VideoAssetReferenceMode): VideoAssetReferenceMode {
  const mode = normalizeVideoAssetReferenceMode(value)
  db.insert(schema.appSettings)
    .values({ key: VIDEO_ASSET_REFERENCE_MODE_KEY, value: mode, updatedAt: now() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: mode, updatedAt: now() },
    })
    .run()
  return mode
}
