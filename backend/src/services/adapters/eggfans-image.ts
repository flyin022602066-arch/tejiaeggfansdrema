import { OpenAIImageAdapter } from './openai-image.js'
import { joinConfiguredEndpoint } from './url.js'
import type { AIConfig } from './types.js'

export class EggfansImageAdapter extends OpenAIImageAdapter {
  provider = 'eggfans'

  buildGenerateRequest(config: AIConfig, record: Parameters<OpenAIImageAdapter['buildGenerateRequest']>[1]) {
    const request = super.buildGenerateRequest(config, record)
    request.url = joinConfiguredEndpoint(config.baseUrl, config.endpoint || '/images/generations')
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
