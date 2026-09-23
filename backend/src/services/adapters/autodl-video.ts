import type {
  AIConfig,
  ProviderRequest,
  VideoGenerationRecord,
  VideoGenResponse,
  VideoPollResponse,
  VideoProviderAdapter,
} from './types.js'
import { joinConfiguredEndpoint } from './url.js'

export const AUTODL_H3_WORKFLOW_ID = 'minimax_h3_zm_u24'
export const AUTODL_H3_LIMITS = {
  minDuration: 1,
  maxDuration: 15,
  maxImages: 9,
  maxAudios: 3,
  maxPromptChars: 10_000,
} as const

const DEFAULT_SUBMIT_ENDPOINT = `/api/v1/comfyui/comfyui_workflow/${AUTODL_H3_WORKFLOW_ID}`
const DEFAULT_QUERY_ENDPOINT = '/api/v1/comfyui/comfyui_workflow/result/{taskId}'

function parseUrlArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value)
      ? value.map(item => String(item || '').trim()).filter(Boolean)
      : []
  } catch {
    return []
  }
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

const REF2VA_SECTIONS = [
  'subject_definitions:',
  'summary:',
  'retention_analysis:',
  'detailed_description:',
  'overall_soundscape:',
  'non_diegetic_music:',
] as const

function hasCompleteRef2VAFormat(prompt: string) {
  let cursor = -1
  for (const section of REF2VA_SECTIONS) {
    const next = prompt.toLowerCase().indexOf(section, cursor + 1)
    if (next < 0) return false
    cursor = next
  }
  return true
}

function promptImageName(prompt: string, imageNumber: number) {
  const pattern = new RegExp(`@图片${imageNumber}([^\\s，,。；;:：!?！？\\]）)]*)`, 'u')
  return prompt.match(pattern)?.[1]?.trim() || ''
}

function replaceLegacyImageLabels(prompt: string) {
  return prompt.replace(/@图片(\d+)([^\s，,。；;:：!?！？\]）)]*)/gu, (_match, index, name) => {
    const suffix = String(name || '').trim()
    return `<Subject ${index}>${suffix ? ` (${suffix})` : ''}`
  })
}

/**
 * AutoDL's H3 workflow accepts a single prompt string. When reference media is
 * present, encode that string using MiniMax H3's official Ref2VA six-section
 * contract while preserving the user's shot directions verbatim.
 */
export function formatH3ReferencePrompt(
  prompt: string,
  imageCount: number,
  audioCount: number,
  duration: number,
) {
  const source = prompt.trim()
  if ((!imageCount && !audioCount) || hasCompleteRef2VAFormat(source)) return source

  const definitions: string[] = []
  const retention: string[] = []
  for (let i = 1; i <= imageCount; i++) {
    const name = promptImageName(source, i)
    definitions.push(`<Subject ${i}> is the ${name ? `${name} ` : ''}visible reference derived from <Picture ${i}>; preserve its photographed identity, materials, proportions, and continuity.`)
    retention.push(`<Subject ${i}> (appears wherever directed in the target shots): fully_preserved - retain the visible identity and production details from <Picture ${i}> while following the requested action and framing.`)
  }
  for (let i = 1; i <= audioCount; i++) {
    definitions.push(`<Audio ${i}> is the ${i === 1 ? 'primary' : 'additional'} audio reference for timing, sound texture, or voice delivery.`)
    retention.push(`<Audio ${i}>: reference - follow its audible characteristics where the target direction calls for them without assuming a 1:1 signal copy.`)
  }

  const taskTypes = ['reference generation', audioCount ? 'audio reference' : ''].filter(Boolean).join(' + ')
  const subjects = imageCount
    ? Array.from({ length: imageCount }, (_, index) => `<Subject ${index + 1}>`).join(', ')
    : 'the requested visuals'
  const audioSummary = audioCount
    ? ` Audio references ${Array.from({ length: audioCount }, (_, index) => `<Audio ${index + 1}>`).join(', ')} guide the requested sound.`
    : ''

  return [
    'subject_definitions:',
    definitions.join('\n'),
    '',
    'summary:',
    `[${taskTypes}] Create a ${duration}-second target video using ${subjects} as stable references while following the requested live-action visual style, shot order, action, camera, and continuity.${audioSummary}`,
    '',
    'retention_analysis:',
    retention.join('\n'),
    '',
    'detailed_description:',
    `The target video must preserve the visual medium, character identity, costume, environment, prop, lighting, and continuity requirements stated below.\n[Shot 1] ${replaceLegacyImageLabels(source)}`,
    '',
    'overall_soundscape:',
    audioCount
      ? 'Use the referenced audio characteristics where directed, with physically grounded ambience, dialogue, and action sounds synchronized to the visible events.'
      : 'Use physically grounded ambience, dialogue, and action sounds synchronized to the visible events described in the target direction.',
    '',
    'non_diegetic_music:',
    'Follow any explicit music direction in the target prompt; otherwise N/A.',
  ].join('\n')
}

function assertPublicUrls(values: string[], label: string) {
  if (values.some(value => !/^https?:\/\//i.test(value))) {
    throw new Error(`AutoDL MiniMax H3 ${label}必须使用公网 HTTP(S) URL`)
  }
}

function taskEndpoint(template: string, taskId: string) {
  const encoded = encodeURIComponent(taskId)
  return template
    .replace(/\{taskId\}/gi, encoded)
    .replace(/\{task_id\}/gi, encoded)
}

function responseData(result: any) {
  return result?.data && typeof result.data === 'object' ? result.data : result
}

function responseError(result: any, fallback: string) {
  const data = responseData(result)
  const error = data?.error
  if (typeof error === 'string' && error) return error
  return error?.message || data?.message || result?.msg || result?.message || fallback
}

function videoUrlFromResult(result: any): string | null {
  const data = responseData(result)
  const results = Array.isArray(data?.results) ? data.results : []
  const item = results.find((entry: any) => entry?.type === 'video')
    || results.find((entry: any) => String(entry?.file_type || '').toLowerCase() === 'mp4')
    || results.find((entry: any) => /^https?:\/\//i.test(String(entry?.url || '')))
  return item?.url || data?.video_url || data?.videoUrl || data?.url || null
}

export class AutoDLVideoAdapter implements VideoProviderAdapter {
  provider = 'autodl'

  buildGenerateRequest(config: AIConfig, record: VideoGenerationRecord): ProviderRequest {
    const workflowId = String(record.model || config.model || AUTODL_H3_WORKFLOW_ID).trim()
    if (workflowId !== AUTODL_H3_WORKFLOW_ID) {
      throw new Error(`AutoDL MiniMax H3 工作流必须为 ${AUTODL_H3_WORKFLOW_ID}`)
    }

    const prompt = String(record.prompt || '').trim()
    if (!prompt) throw new Error('AutoDL MiniMax H3 提示词不能为空')
    if (prompt.length > AUTODL_H3_LIMITS.maxPromptChars) {
      throw new Error(`AutoDL MiniMax H3 提示词不能超过 ${AUTODL_H3_LIMITS.maxPromptChars} 个字符`)
    }

    const videos = parseUrlArray(record.referenceVideoUrls)
    if (videos.length) throw new Error('AutoDL MiniMax H3 工作流不支持参考视频，仅支持参考图片和参考音频')
    if (record.referenceFileUrl || record.referenceLinkUrl) {
      throw new Error('AutoDL MiniMax H3 工作流不支持文件或链接参考素材')
    }

    const images = unique([
      record.imageUrl,
      record.firstFrameUrl,
      record.lastFrameUrl,
      ...parseUrlArray(record.referenceImageUrls),
    ])
    const audios = unique(parseUrlArray(record.referenceAudioUrls))
    if (images.length > AUTODL_H3_LIMITS.maxImages) {
      throw new Error(`AutoDL MiniMax H3 参考图片最多 ${AUTODL_H3_LIMITS.maxImages} 张`)
    }
    if (audios.length > AUTODL_H3_LIMITS.maxAudios) {
      throw new Error(`AutoDL MiniMax H3 参考音频最多 ${AUTODL_H3_LIMITS.maxAudios} 个`)
    }
    assertPublicUrls(images, '参考图片')
    assertPublicUrls(audios, '参考音频')

    const duration = this.normalizeDuration(record.duration)
    const formattedPrompt = formatH3ReferencePrompt(prompt, images.length, audios.length, duration)
    if (formattedPrompt.length > AUTODL_H3_LIMITS.maxPromptChars) {
      throw new Error(`AutoDL MiniMax H3 Ref2VA 提示词不能超过 ${AUTODL_H3_LIMITS.maxPromptChars} 个字符`)
    }

    const body: Record<string, unknown> = {
      prompt: formattedPrompt,
      duration,
      resolution: this.normalizeResolution(record.resolution, record.aspectRatio),
    }
    const seed = Number(record.seed)
    if (record.seed !== null && record.seed !== undefined && Number.isSafeInteger(seed)) body.seed = seed
    images.forEach((url, index) => { body[`ref_image_${index}`] = url })
    audios.forEach((url, index) => { body[`ref_audio_${index}`] = url })

    return {
      url: joinConfiguredEndpoint(config.baseUrl, config.endpoint || DEFAULT_SUBMIT_ENDPOINT),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.apiKey,
      },
      body,
    }
  }

  parseGenerateResponse(result: any): VideoGenResponse {
    if (result?.code && String(result.code).toLowerCase() !== 'success') {
      throw new Error(String(responseError(result, 'AutoDL 工作流提交失败')))
    }
    const taskId = responseData(result)?.task_id
    if (taskId) return { isAsync: true, taskId: String(taskId) }
    const videoUrl = videoUrlFromResult(result)
    if (videoUrl) return { isAsync: false, videoUrl }
    throw new Error(String(responseError(result, 'AutoDL 响应中没有 task_id 或视频 URL')))
  }

  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    const endpoint = taskEndpoint(config.queryEndpoint || DEFAULT_QUERY_ENDPOINT, taskId)
    return {
      url: joinConfiguredEndpoint(config.baseUrl, endpoint),
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.apiKey,
      },
      body: undefined,
    }
  }

  parsePollResponse(result: any): VideoPollResponse {
    if (result?.code && String(result.code).toLowerCase() !== 'success') {
      return { status: 'failed', error: String(responseError(result, 'AutoDL 查询任务失败')) }
    }
    const status = String(responseData(result)?.status || '').toUpperCase()
    const videoUrl = videoUrlFromResult(result)
    if (videoUrl || ['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE'].includes(status)) {
      if (!videoUrl) return { status: 'failed', error: 'AutoDL 任务已完成，但响应中没有视频 URL' }
      return { status: 'completed', videoUrl }
    }
    if (['FAILED', 'ERROR', 'CANCELLED', 'CANCELED'].includes(status)) {
      return { status: 'failed', error: String(responseError(result, 'AutoDL 视频生成失败')) }
    }
    return { status: status === 'QUEUED' ? 'pending' : 'processing' }
  }

  extractVideoUrl(result: any): string | null {
    return videoUrlFromResult(result)
  }

  private normalizeDuration(value?: number | null) {
    const duration = Math.round(Number(value ?? 5))
    if (!Number.isFinite(duration)) return 5
    return Math.min(AUTODL_H3_LIMITS.maxDuration, Math.max(AUTODL_H3_LIMITS.minDuration, duration))
  }

  private normalizeResolution(resolution?: string | null, aspectRatio?: string | null) {
    const tier = String(resolution || '').toLowerCase() === '480p' ? '480p' : '768p'
    const ratio = String(aspectRatio || '16:9').trim()
    if (ratio === '1:1') return `${tier}(1:1)`
    if (ratio === '9:16' || ratio === '3:4') return `${tier}竖`
    return `${tier}横`
  }
}
