import type {
  VideoProviderAdapter,
  ProviderRequest,
  AIConfig,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
} from './types.js'
import { joinConfiguredEndpoint } from './url.js'

function parseUrlArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : []
  } catch {
    return []
  }
}

function isGrokModel(model: string) {
  return model.toLowerCase().includes('grok')
}

function taskEndpoint(template: string, taskId: string) {
  const encoded = encodeURIComponent(taskId)
  return template
    .replace(/\{taskId\}/gi, encoded)
    .replace(/\{task_id\}/gi, encoded)
}

function resultBody(result: any) {
  return result?.data && typeof result.data === 'object' ? result.data : result
}

function extractVideoUrl(result: any): string | null {
  const body = resultBody(result)
  const task = body?.task && typeof body.task === 'object' ? body.task : body
  return task?.video_url
    || task?.videoUrl
    || task?.url
    || task?.content?.url
    || task?.output?.url
    || task?.output?.video_url
    || task?.data?.video_url
    || null
}

export class EggfansVideoAdapter implements VideoProviderAdapter {
  provider = 'eggfans'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const model = record.model || config.model
    const grok = isGrokModel(model)
    const endpoint = grok ? '/v1/video/create' : (config.endpoint || '/videos')
    const referenceImages = parseUrlArray(record.referenceImageUrls)
    const firstImage = record.firstFrameUrl || record.imageUrl || referenceImages[0] || ''

    const body: Record<string, unknown> = {
      model,
      prompt: record.prompt || '',
      duration: record.duration || 5,
      aspect_ratio: record.aspectRatio || '16:9',
    }

    if (firstImage) body.image_url = firstImage
    if (referenceImages.length) body.reference_images = referenceImages
    if (record.lastFrameUrl) body.last_frame_url = record.lastFrameUrl

    const referenceVideos = parseUrlArray(record.referenceVideoUrls)
    const referenceAudios = parseUrlArray(record.referenceAudioUrls)
    if (referenceVideos.length) body.reference_videos = referenceVideos
    if (referenceAudios.length) body.reference_audios = referenceAudios
    if (record.generateAudio !== null && record.generateAudio !== undefined) {
      body.generate_audio = record.generateAudio !== 0 && record.generateAudio !== false
    }
    if (record.resolution) body.resolution = record.resolution

    return {
      url: joinConfiguredEndpoint(config.baseUrl, endpoint),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    const videoUrl = extractVideoUrl(result)
    if (videoUrl) return { isAsync: false, videoUrl }

    const body = resultBody(result)
    const taskId = body?.task_id || body?.taskId || body?.id || result?.task_id || result?.id
    if (taskId) return { isAsync: true, taskId: String(taskId) }
    throw new Error('No task id or video URL in EggFans response')
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    const grok = isGrokModel(config.model)
    const template = grok
      ? '/v1/video/status/{taskId}'
      : (config.queryEndpoint || '/videos/{taskId}')
    return {
      url: joinConfiguredEndpoint(config.baseUrl, taskEndpoint(template, taskId)),
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    const body = resultBody(result)
    const task = body?.task && typeof body.task === 'object' ? body.task : body
    const status = String(task?.status || task?.state || '').toLowerCase()
    const videoUrl = extractVideoUrl(result)

    if (videoUrl || ['success', 'succeeded', 'completed', 'done'].includes(status)) {
      return { status: 'completed', videoUrl: videoUrl || undefined }
    }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      const error = task?.error?.message || task?.error || task?.message || 'Video generation failed'
      return { status: 'failed', error: String(error) }
    }
    return { status: status === 'pending' ? 'pending' : 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return extractVideoUrl(result)
  }
}
