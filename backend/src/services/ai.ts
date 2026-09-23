/**
 * AI 服务抽象层 — 从数据库配置中获取 provider 和 API key
 */
import { db, schema } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { logTaskProgress, logTaskWarn } from '../utils/task-logger.js'
import { joinProviderUrl } from './adapters/url.js'

export type ServiceType = 'text' | 'image' | 'video'

export interface AIConfig {
  provider: string
  baseUrl: string
  apiKey: string
  model: string
  endpoint?: string | null
  queryEndpoint?: string | null
  /** 采样温度，null 表示不设置（跟随服务商默认）。存于 ai_service_configs.settings JSON */
  temperature?: number | null
}

/** 从 settings JSON 解析 temperature；非法值一律视为未设置 */
export function parseConfigTemperature(settingsRaw: string | null | undefined): number | null {
  if (!settingsRaw) return null
  try {
    const t = JSON.parse(settingsRaw)?.temperature
    return typeof t === 'number' && Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

export const officialProviders: Record<ServiceType, readonly string[]> = {
  text: ['openai', 'gemini', 'volcengine', 'eggfans'],
  image: ['openai', 'gemini', 'volcengine', 'eggfans'],
  video: ['volcengine', 'minimax', 'eggfans', 'autodl'],
}

export function isOfficialProvider(serviceType?: string | null, provider?: string | null): boolean {
  const providers = officialProviders[serviceType as ServiceType]
  return !!providers && providers.includes((provider || '').toLowerCase())
}

export function getTextProviderBaseUrl(config: AIConfig) {
  const provider = config.provider.toLowerCase()

  if (provider === 'openai') {
    return joinProviderUrl(config.baseUrl, '/v1', '')
  }

  // Eggfans exposes an OpenAI-compatible API under /v1.  The settings
  // connectivity probe already checks /v1/models; keep Agent chat requests on
  // the same prefix or rewrites will hit /chat/completions at the host root.
  if (provider === 'eggfans') {
    return joinProviderUrl(config.baseUrl, '/v1', '')
  }

  if (provider === 'gemini') {
    return joinProviderUrl(config.baseUrl, '/v1beta', '')
  }

  if (provider === 'volcengine') {
    return joinProviderUrl(config.baseUrl, '/api/v3', '')
  }

  return config.baseUrl
}

/** Accept legacy settings that stored multiple models in one comma-delimited string. */
export function parseModelList(raw: string | null | undefined): string[] {
  if (!raw) return []
  const normalize = (value: string) => value === 'gemini-3-pro-preview' ? 'gemini-3.1-pro-preview' : value
  try {
    const parsed = JSON.parse(raw)
    const values = Array.isArray(parsed) ? parsed : [parsed]
    return values.flatMap(value => typeof value === 'string' ? value.split(/[，,]/) : [])
      .map(value => value.trim())
      .filter(Boolean)
      .map(normalize)
  } catch {
    return raw.split(/[，,]/).map(value => value.trim()).filter(Boolean).map(normalize)
  }
}

/** Repair UTF-8 text that was accidentally decoded as latin1 by a provider. */
export function repairProviderText(value: string): string {
  if (!/[ÃÂâåæçèéï¿½]/.test(value)) return value
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8')
    return repaired.includes('\ufffd') ? value : repaired
  } catch {
    return value
  }
}

// Agent 多步循环会逐步重复解析同一配置，相同配置只打一次日志避免刷屏
const lastLoggedActiveConfigKey = new Map<string, string>()
const lastLoggedConfigByIdKey = new Map<number, string>()

export async function getActiveConfig(serviceType: ServiceType): Promise<AIConfig | null> {
  const rows = (await db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.serviceType, serviceType))
  )
    .filter(r => r.isActive && isOfficialProvider(serviceType, r.provider))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0)) // 高优先级优先

  const active = rows[0]
  if (!active) {
    logTaskWarn('AIConfig', 'active-config-missing', { serviceType })
    return null
  }

  const models = parseModelList(active.model)
  const logKey = `${active.id}:${models[0] || ''}`
  if (lastLoggedActiveConfigKey.get(serviceType) !== logKey) {
    lastLoggedActiveConfigKey.set(serviceType, logKey)
    logTaskProgress('AIConfig', 'active-config-selected', {
      serviceType,
      configId: active.id,
      provider: active.provider,
      model: models[0] || '',
      priority: active.priority,
    })
  }
  return {
    provider: active.provider || '',
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: models[0] || '',
    endpoint: active.endpoint,
    queryEndpoint: active.queryEndpoint,
    temperature: parseConfigTemperature(active.settings),
  }
}

export async function getTextConfig(): Promise<AIConfig> {
  const config = await getActiveConfig('text')
  if (!config) throw new Error('未配置文本模型，请先到「设置」页添加并启用 AI 服务')
  return config
}

/**
 * 取某服务类型当前启用且优先级最高的官方配置 ID（创建集时自动锁定用）
 */
export async function getActiveConfigId(serviceType: ServiceType): Promise<number | null> {
  const rows = (await db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.serviceType, serviceType))
  )
    .filter(r => r.isActive && isOfficialProvider(serviceType, r.provider))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  return rows[0]?.id ?? null
}

export async function getConfigById(id: number): Promise<AIConfig | null> {
  const [row] = await db.select().from(schema.aiServiceConfigs)
    .where(eq(schema.aiServiceConfigs.id, id))
  if (!row || !row.isActive) {
    logTaskWarn('AIConfig', 'config-by-id-missing', { configId: id })
    return null
  }
  if (!isOfficialProvider(row.serviceType as ServiceType, row.provider)) {
    logTaskWarn('AIConfig', 'config-by-id-unsupported-provider', {
      configId: id,
      serviceType: row.serviceType,
      provider: row.provider,
    })
    return null
  }
  const models = parseModelList(row.model)
  const logKey = `${row.provider}:${models[0] || ''}:${row.serviceType}`
  if (lastLoggedConfigByIdKey.get(id) !== logKey) {
    lastLoggedConfigByIdKey.set(id, logKey)
    logTaskProgress('AIConfig', 'config-by-id-selected', {
      configId: id,
      provider: row.provider,
      model: models[0] || '',
      serviceType: row.serviceType,
    })
  }
  return {
    provider: row.provider || '',
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    model: models[0] || '',
    endpoint: row.endpoint,
    queryEndpoint: row.queryEndpoint,
    temperature: parseConfigTemperature(row.settings),
  }
}
