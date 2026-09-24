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

export const EGGFANS_VIDEO_MODEL = 'sd-2.5-C'
export const EGGFANS_VIDEO_RESOLUTION = '720p'
export const EGGFANS_VIDEO_LIMITS = {
  minDuration: 4,
  maxDuration: 30,
  maxImages: 30,
  maxVideos: 10,
  maxAudios: 10,
} as const

export function isGrokModel(model: string) {
  return model.toLowerCase().includes('grok')
}

export interface EggfansStandardVideoInput {
  model: string
  duration?: number | null
  resolution?: string | null
  imageRefs?: string[]
  videoRefs?: string[]
  audioRefs?: string[]
  firstImage?: string | null
  lastImage?: string | null
  fileUrl?: string | null
  linkUrl?: string | null
}

export function validateEggfansStandardVideoInput(input: EggfansStandardVideoInput): string | null {
  const model = String(input.model || '').trim()
  if (!model) return 'EggFans 标准视频模型名称不能为空'

  const duration = Number(input.duration ?? 10)
  if (!Number.isInteger(duration) || duration < EGGFANS_VIDEO_LIMITS.minDuration || duration > EGGFANS_VIDEO_LIMITS.maxDuration) {
    return `EggFans ${model} 时长必须为 ${EGGFANS_VIDEO_LIMITS.minDuration}-${EGGFANS_VIDEO_LIMITS.maxDuration} 秒整数`
  }

  if (input.resolution && input.resolution.toLowerCase() !== EGGFANS_VIDEO_RESOLUTION) {
    return `EggFans ${model} 分辨率仅支持 ${EGGFANS_VIDEO_RESOLUTION}`
  }

  const imageRefs = input.imageRefs || []
  const videoRefs = input.videoRefs || []
  const audioRefs = input.audioRefs || []
  if (imageRefs.length > EGGFANS_VIDEO_LIMITS.maxImages
    || videoRefs.length > EGGFANS_VIDEO_LIMITS.maxVideos
    || audioRefs.length > EGGFANS_VIDEO_LIMITS.maxAudios) {
    return `EggFans ${model} 参考素材超限：图片≤30、视频≤10、音频≤10`
  }

  const isVirtualAssetUri = (value: string) => /^asset:\/\/.+/i.test(value)
  if (imageRefs.some(url => !/^https:\/\//i.test(url) && !isVirtualAssetUri(url))) {
    return `EggFans ${model} 参考图片必须使用公网 HTTPS URL 或虚拟资产 URI`
  }
  const mediaUrls = [...videoRefs, ...audioRefs, input.firstImage, input.lastImage].filter(Boolean) as string[]
  if (mediaUrls.some(url => !/^https:\/\//i.test(url))) {
    return `EggFans ${model} 参考视频、音频和首尾帧必须使用公网 HTTPS URL`
  }

  if (input.lastImage && !input.firstImage) {
    return `EggFans ${model} 尾帧必须与首帧同时传入`
  }
  if ((input.firstImage || input.lastImage) && imageRefs.length + videoRefs.length + audioRefs.length > 0) {
    return `EggFans ${model} 的 first_image/last_image 不能与 image_refs/video_refs/audio_refs 混用`
  }
  if (input.fileUrl || input.linkUrl) {
    return `EggFans ${model} 不支持 file/link 参考素材`
  }

  return null
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
    const model = record.model || config.model || EGGFANS_VIDEO_MODEL
    const grok = isGrokModel(model)
    const endpoint = grok ? '/v1/video/create' : (config.endpoint || '/v1/videos')
    const referenceImages = parseUrlArray(record.referenceImageUrls)
    const referenceVideos = parseUrlArray(record.referenceVideoUrls)
    const referenceAudios = parseUrlArray(record.referenceAudioUrls)
    const firstImage = record.firstFrameUrl || record.imageUrl || ''

    if (!grok) {
      const validationError = validateEggfansStandardVideoInput({
        model,
        duration: record.duration,
        resolution: record.resolution,
        imageRefs: referenceImages,
        videoRefs: referenceVideos,
        audioRefs: referenceAudios,
        firstImage,
        lastImage: record.lastFrameUrl,
        fileUrl: record.referenceFileUrl,
        linkUrl: record.referenceLinkUrl,
      })
      if (validationError) throw new Error(validationError)

      const body: Record<string, unknown> = {
        model,
        prompt: record.prompt || '',
        duration: Number(record.duration ?? 10),
        resolution: EGGFANS_VIDEO_RESOLUTION,
        aspect_ratio: record.aspectRatio || '16:9',
      }
      if ((referenceImages.length || firstImage) && (record.face === true || record.face === 1)) body.face = true
      if (referenceImages.length) body.image_refs = referenceImages
      if (referenceVideos.length) body.video_refs = referenceVideos
      if (referenceAudios.length) body.audio_refs = referenceAudios
      if (firstImage) body.first_image = firstImage
      if (record.lastFrameUrl) body.last_image = record.lastFrameUrl

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

    // Existing Grok compatibility remains isolated from the Eggfans standard-video contract.
    const body: Record<string, unknown> = {
      model,
      prompt: record.prompt || '',
      duration: record.duration || 5,
      aspect_ratio: record.aspectRatio || '16:9',
    }

    if (firstImage) body.image_url = firstImage
    if (referenceImages.length) body.reference_images = referenceImages
    if (record.lastFrameUrl) body.last_frame_url = record.lastFrameUrl

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
      : (config.queryEndpoint || '/v1/videos/{taskId}')
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
