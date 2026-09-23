/**
 * OpenAI DALL-E 图片生成 Adapter
 * 文生图端点: /v1/images/generations (注意 /v1 前缀)
 * 参考生图端点: /v1/images/edits (multipart/form-data, image[] 文件上传)
 * 响应格式: { data: [{ url: "..." }] } 或 { data: [{ b64_json: "..." }] }
 */
import type {
  ImageProviderAdapter,
  ProviderRequest,
  AIConfig,
  ImageGenerationRecord,
  ImageGenResponse,
  ImagePollResponse,
} from './types'
import { joinProviderUrl } from './url'
import { parseDataUrl } from '../../utils/storage.js'

export class OpenAIImageAdapter implements ImageProviderAdapter {
  provider = 'openai'

  buildGenerateRequest(config: AIConfig, record: ImageGenerationRecord): ProviderRequest {
    const model = record.model || config.model || 'gpt-image-2'
    const isGptImage = model.startsWith('gpt-image-')
    // GPT Image 2/2.5 variants accept flexible pixel dimensions (up to 4K).
    // Treating suffixed models as generic GPT Image models silently collapsed
    // 3840x2160 to the legacy 1536x1024 landscape preset.
    const isGptImage2 = /^gpt-image-2(?:[.\-]|$)/i.test(model)
    const size = isGptImage2
      ? this.normalizeGptImage2Size(record.size)
      : isGptImage
      ? this.normalizeGptImageSize(record.size)
      : record.size || '1024x1024'

    // 有参考图 → 走 edits（multipart 上传图片文件）；无参考图 → 纯文生图 generations
    const refs = this.parseReferenceImages(record.referenceImages)
    if (refs.length) {
      return this.buildEditsRequest(config, model, record.prompt, size, refs, record)
    }

    const body: any = {
      model,
      prompt: record.prompt,
      size,
      n: this.normalizeImageCount(record.n),
    }

    if (record.quality) body.quality = record.quality
    if (record.moderation) body.moderation = record.moderation
    if (record.format) body.format = record.format
    if (record.responseFormat) {
      body.response_format = record.responseFormat
    } else if (!isGptImage) {
      body.response_format = 'url'
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/images/generations'),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  private parseReferenceImages(raw?: string | null): string[] {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
      return []
    }
  }

  /**
   * /v1/images/edits：参考图以 multipart/form-data 的 image[] 文件上传。
   * 参考图在 generation.ts 已归一化为 data URL（本地压缩 / 远程下载），
   * 这里只做 base64 → Blob 的转换；multipart 边界由 fetch 自动设置，不要手填 Content-Type。
   */
  private buildEditsRequest(
    config: AIConfig,
    model: string,
    prompt: string | null | undefined,
    size: string,
    refs: string[],
    options: ImageGenerationRecord,
  ): ProviderRequest {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', prompt || '')
    form.append('size', size)
    form.append('n', String(this.normalizeImageCount(options.n)))
    if (options.quality) form.append('quality', options.quality)
    if (options.moderation) form.append('moderation', options.moderation)
    if (options.responseFormat) form.append('response_format', options.responseFormat)

    let appended = 0
    for (const ref of refs) {
      const parsed = parseDataUrl(ref)
      if (!parsed) continue
      const buffer = Buffer.from(parsed.data, 'base64')
      const ext = parsed.mimeType === 'image/png' ? 'png' : parsed.mimeType === 'image/webp' ? 'webp' : 'jpg'
      form.append('image[]', new Blob([buffer], { type: parsed.mimeType }), `reference-${++appended}.${ext}`)
    }
    if (!appended) {
      throw new Error('参考图片无法解析为可上传的文件（仅支持 data URL 形式的图片）')
    }

    return {
      url: joinProviderUrl(config.baseUrl, '/v1', '/images/edits'),
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: form,
    }
  }

  private normalizeGptImageSize(size?: string | null): string {
    const allowed = ['1024x1024', '1536x1024', '1024x1536', 'auto']
    if (!size) return '1024x1024'

    const normalized = size.toLowerCase()
    if (allowed.includes(normalized)) return normalized

    const [width, height] = normalized.split('x').map(Number)
    if (!width || !height) return 'auto'
    if (width === height) return '1024x1024'
    return width > height ? '1536x1024' : '1024x1536'
  }

  private normalizeGptImage2Size(size?: string | null): string {
    if (!size) return '1024x1024'
    const normalized = size.toLowerCase()
    if (normalized === 'auto') return 'auto'

    const [rawWidth, rawHeight] = normalized.split('x').map(Number)
    if (!rawWidth || !rawHeight) return 'auto'

    const width = this.roundToMultiple(Math.min(4096, Math.max(256, rawWidth)), 16)
    const height = this.roundToMultiple(Math.min(4096, Math.max(256, rawHeight)), 16)
    return `${width}x${height}`
  }

  private roundToMultiple(value: number, multiple: number): number {
    return Math.max(multiple, Math.round(value / multiple) * multiple)
  }

  private normalizeImageCount(value?: number | null): number {
    const count = Number(value || 1)
    if (!Number.isFinite(count)) return 1
    return Math.min(10, Math.max(1, Math.trunc(count)))
  }

  parseGenerateResponse(result: any): ImageGenResponse {
    // OpenAI DALL-E 3 目前是同步返回，但规范上也有异步 task 模式
    const imageUrl = result.data?.[0]?.url || result.url
    if (imageUrl) {
      return { isAsync: false, imageUrl }
    }
    // b64_json 模式
    const b64 = result.data?.[0]?.b64_json
    if (b64) {
      // 对于 base64，返回特殊标记，实际处理在 extractImageBase64
      return { isAsync: false, imageUrl: undefined }
    }
    if (result.task_id || (result.id && result.status)) {
      return { isAsync: true, taskId: result.task_id || result.id }
    }
    throw new Error('No image URL in response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: joinProviderUrl(config.baseUrl, '/v1', `/images/task/${taskId}`),
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): ImagePollResponse {
    if (result.status === 'completed') {
      return {
        status: 'completed',
        imageUrl: result.image_url || result.data?.[0]?.url || null,
      }
    }
    if (result.status === 'failed') {
      return { status: 'failed', error: result.error?.message || 'Generation failed' }
    }
    return { status: result.status || 'processing' }
  }

  extractImageUrl(result: any): string | null {
    return result.data?.[0]?.url || result.image_url || null
  }

  extractImageBase64(result: any): { data: string; mimeType: string } | null {
    const b64 = result.data?.[0]?.b64_json
    if (b64) {
      return { data: b64, mimeType: 'image/png' }
    }
    return null
  }
}
