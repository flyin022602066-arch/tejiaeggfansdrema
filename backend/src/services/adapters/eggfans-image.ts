import { OpenAIImageAdapter } from './openai-image.js'
import { joinConfiguredEndpoint } from './url.js'
import type { AIConfig } from './types.js'

export class EggfansImageAdapter extends OpenAIImageAdapter {
  provider = 'eggfans'

  buildGenerateRequest(config: AIConfig, record: Parameters<OpenAIImageAdapter['buildGenerateRequest']>[1]) {
    const request = super.buildGenerateRequest(config, record)
    const isEdit = request.body instanceof FormData
    const endpoint = ensureV1ImageEndpoint(isEdit ? '/images/edits' : (config.endpoint || '/images/generations'))
    // Keep the configured Eggfans host as-is. `api.eggfans.com` is the live
    // OpenAI-compatible gateway; rewriting it to the legacy `.org` host can
    // fail TLS before the request reaches the provider.
    request.url = joinConfiguredEndpoint(config.baseUrl, endpoint)
    return request
  }

  buildPollRequest(config: AIConfig, taskId: string) {
    const request = super.buildPollRequest(config, taskId)
    const endpoint = (config.queryEndpoint || '/images/task/{taskId}')
      .replace(/\{taskId\}/gi, encodeURIComponent(taskId))
      .replace(/\{task_id\}/gi, encodeURIComponent(taskId))
    request.url = joinConfiguredEndpoint(config.baseUrl, endpoint)
    return request
  }
}

function ensureV1ImageEndpoint(endpoint: string) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return normalized.startsWith('/v1/') ? normalized : `/v1${normalized}`
}
