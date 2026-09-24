import test from 'node:test'
import assert from 'node:assert/strict'
import { EggfansImageAdapter } from '../src/services/adapters/eggfans-image.js'
import { getImageAdapter } from '../src/services/adapters/registry.js'
import {
  EGGFANS_VIDEO_LIMITS,
  EggfansVideoAdapter,
  validateEggfansStandardVideoInput,
} from '../src/services/adapters/eggfans-video.js'

const config = {
  provider: 'eggfans',
  baseUrl: 'https://vip.eggfans.asia',
  apiKey: 'test-key',
  model: 'sd-2.5-A',
  endpoint: '/v1/videos',
  queryEndpoint: '/v1/videos/{taskId}',
}

test('EggFans image uses the OpenAI-compatible endpoint without duplicating /v1', () => {
  const adapter = new EggfansImageAdapter()
  const request = adapter.buildGenerateRequest({ ...config, baseUrl: 'https://aggregator.example/v1', endpoint: '/images/generations' }, {
    id: 1,
    model: 'z-image-turbo',
    prompt: 'test prompt',
    size: '1024x1024',
  })

  assert.equal(adapter.provider, 'eggfans')
  assert.equal(request.url, 'https://aggregator.example/v1/images/generations')
  assert.equal(request.headers.Authorization, 'Bearer test-key')
  assert.equal(request.body.model, 'z-image-turbo')
})

test('EggFans image preserves the configured gateway host and exposes documented generation parameters', () => {
  const request = new EggfansImageAdapter().buildGenerateRequest({
    ...config,
    baseUrl: 'https://api.eggfans.com',
    endpoint: '/images/generations',
    model: 'gpt-image-2',
  }, {
    id: 8,
    prompt: 'test prompt',
    size: '1536x1024',
    quality: 'high',
    moderation: 'low',
    format: 'webp',
    responseFormat: 'b64_json',
    n: 3,
  })

  assert.equal(request.url, 'https://api.eggfans.com/v1/images/generations')
  assert.deepEqual(request.body, {
    model: 'gpt-image-2',
    prompt: 'test prompt',
    size: '1536x1024',
    n: 3,
    quality: 'high',
    moderation: 'low',
    format: 'webp',
    response_format: 'b64_json',
  })
})

test('EggFans GPT Image 2.5 variants preserve requested 4K dimensions', () => {
  const request = new EggfansImageAdapter().buildGenerateRequest({
    ...config,
    baseUrl: 'https://api.eggfans.com',
    endpoint: '/v1/images/generations',
    model: 'gpt-image-2.5-sunburst-c',
  }, {
    id: 11,
    prompt: '4K asset test',
    size: '3840x2160',
    quality: 'high',
    moderation: 'low',
    format: 'jpeg',
  })

  assert.equal(request.body.model, 'gpt-image-2.5-sunburst-c')
  assert.equal(request.body.size, '3840x2160')
  assert.equal(request.body.quality, 'high')
  assert.equal(request.body.moderation, 'low')
})

test('EggFans image forwards prompts longer than 1000 characters without truncation', () => {
  const prompt = 'a'.repeat(1501)
  const request = new EggfansImageAdapter().buildGenerateRequest({
    ...config,
    baseUrl: 'https://api.eggfans.com',
    endpoint: '/v1/images/generations',
    model: 'gpt-image-2',
  }, {
    id: 10,
    prompt,
    size: '1024x1024',
  })

  assert.equal(request.body.prompt, prompt)
  assert.equal(request.body.prompt.length, 1501)
})

test('EggFans Gemini image models use native generateContent with fixed 21:9 ratio', () => {
  const adapter = getImageAdapter('eggfans', 'gemini-3.1-flash-lite-image')
  const request = adapter.buildGenerateRequest({
    ...config,
    baseUrl: 'https://api.eggfans.com',
    model: 'gemini-3.1-flash-lite-image',
  }, {
    id: 12,
    model: 'gemini-3.1-flash-lite-image',
    prompt: 'cinematic scene',
    size: '3840x2160',
  })

  assert.equal(adapter.provider, 'gemini')
  assert.match(request.url, /\/v1beta\/models\/gemini-3\.1-flash-lite-image:generateContent/)
  assert.equal(request.body.generationConfig.imageConfig.aspectRatio, '21:9')
  assert.equal(request.body.generationConfig.imageConfig.imageSize, '4K')
})

test('EggFans reference image generation uses multipart /v1/images/edits', () => {
  const request = new EggfansImageAdapter().buildGenerateRequest({
    ...config,
    baseUrl: 'https://api.eggfans.com',
    endpoint: '/v1/images/generations',
    model: 'gpt-image-2',
  }, {
    id: 9,
    prompt: 'edit prompt',
    size: '1024x1024',
    quality: 'medium',
    moderation: 'low',
    responseFormat: 'url',
    n: 2,
    referenceImages: JSON.stringify(['data:image/png;base64,iVBORw0KGgo=']),
  })

  assert.equal(request.url, 'https://api.eggfans.com/v1/images/edits')
  assert.ok(request.body instanceof FormData)
  assert.equal(request.body.get('quality'), 'medium')
  assert.equal(request.body.get('moderation'), 'low')
  assert.equal(request.body.get('response_format'), 'url')
  assert.equal(request.body.get('n'), '2')
  assert.equal(request.body.getAll('image[]').length, 1)
})

test('EggFans synchronous response wins over a generic response id', () => {
  const response = new EggfansImageAdapter().parseGenerateResponse({
    id: 'response-id',
    data: [{ url: 'https://assets.example/image.png' }],
  })
  assert.deepEqual(response, { isAsync: false, imageUrl: 'https://assets.example/image.png' })
})

test('EggFans standard video honors configured create and query endpoints', () => {
  const adapter = new EggfansVideoAdapter()
  const request = adapter.buildGenerateRequest(config, {
    id: 2,
    model: 'sd-2.5-C',
    prompt: 'test video',
    duration: 30,
    resolution: '720p',
    aspectRatio: '9:16',
    referenceImageUrls: JSON.stringify(['https://assets.example/ref.png']),
    referenceVideoUrls: JSON.stringify(['https://assets.example/ref.mp4']),
    referenceAudioUrls: JSON.stringify(['https://assets.example/ref.mp3']),
    generateAudio: true,
    face: true,
  })

  assert.equal(request.url, 'https://vip.eggfans.asia/v1/videos')
  assert.equal(request.body.model, 'sd-2.5-C')
  assert.equal(request.body.duration, 30)
  assert.equal(request.body.resolution, '720p')
  assert.equal(request.body.aspect_ratio, '9:16')
  assert.deepEqual(request.body.image_refs, ['https://assets.example/ref.png'])
  assert.deepEqual(request.body.video_refs, ['https://assets.example/ref.mp4'])
  assert.deepEqual(request.body.audio_refs, ['https://assets.example/ref.mp3'])
  assert.equal(request.body.face, true)
  assert.equal('generate_audio' in request.body, false)
  assert.equal(
    adapter.buildPollRequest(config, 'task/123').url,
    'https://vip.eggfans.asia/v1/videos/task%2F123',
  )
  assert.deepEqual(adapter.parseGenerateResponse({ task_id: 'task-1' }), {
    isAsync: true,
    taskId: 'task-1',
  })
})

test('EggFans standard video omits face when the reference switch is disabled', () => {
  const request = new EggfansVideoAdapter().buildGenerateRequest(config, {
    id: 4,
    model: 'sd-2.5-C',
    prompt: 'face switch off',
    duration: 4,
    resolution: '720p',
    referenceImageUrls: JSON.stringify(['https://assets.example/ref.png']),
    face: false,
  })

  assert.equal('face' in request.body, false)
})

test('EggFans standard video keeps face disabled when no switch value is provided', () => {
  const request = new EggfansVideoAdapter().buildGenerateRequest(config, {
    id: 5,
    model: 'sd-2.5-C',
    prompt: 'face switch default',
    duration: 4,
    resolution: '720p',
    referenceImageUrls: JSON.stringify(['https://assets.example/ref.png']),
  })

  assert.equal('face' in request.body, false)
})

test('EggFans sd video preserves character virtual asset URIs in image_refs', () => {
  const request = new EggfansVideoAdapter().buildGenerateRequest(config, {
    id: 21,
    model: 'sd-2.5-C',
    prompt: 'virtual character reference',
    duration: 30,
    resolution: '720p',
    referenceImageUrls: JSON.stringify([
      'asset://characters/77',
      'https://assets.example/scene.png',
    ]),
  })

  assert.deepEqual(request.body.image_refs, [
    'asset://characters/77',
    'https://assets.example/scene.png',
  ])
})

test('EggFans standard video keeps legacy and newly configured model names unchanged', () => {
  const adapter = new EggfansVideoAdapter()
  for (const model of ['sd-2.5-A', 'sd-2.5-C']) {
    const request = adapter.buildGenerateRequest(config, {
      id: 20,
      model,
      prompt: 'model passthrough',
      duration: 4,
      resolution: '720p',
    })
    assert.equal(request.body.model, model)
  }
})

test('EggFans standard video maps first and last frame without reference arrays', () => {
  const request = new EggfansVideoAdapter().buildGenerateRequest(config, {
    id: 3,
    model: 'sd-2.5-A',
    prompt: 'first and last frame',
    duration: 4,
    resolution: '720p',
    firstFrameUrl: 'https://assets.example/first.png',
    lastFrameUrl: 'https://assets.example/last.png',
  })

  assert.equal(request.body.first_image, 'https://assets.example/first.png')
  assert.equal(request.body.last_image, 'https://assets.example/last.png')
  assert.equal('image_refs' in request.body, false)
})

test('EggFans standard video does not fail locally before submission when static references lack a public base URL', () => {
  const previous = process.env.PUBLIC_BASE_URL
  delete process.env.PUBLIC_BASE_URL
  try {
    const request = new EggfansVideoAdapter().buildGenerateRequest(config, {
      id: 31,
      model: 'sd-2.5-A',
      prompt: 'local reference fallback',
      duration: 4,
      resolution: '720p',
    })
    assert.equal(request.body.prompt, 'local reference fallback')
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_BASE_URL
    else process.env.PUBLIC_BASE_URL = previous
  }
})

test('EggFans sd-2.5 standard models accept documented duration and media limits', () => {
  for (const model of ['sd-2.5-A', 'sd-2.5-C']) {
    for (const duration of [4, 30]) {
      assert.equal(validateEggfansStandardVideoInput({ model, duration, resolution: '720p' }), null)
    }
  }
  assert.equal(validateEggfansStandardVideoInput({
    model: 'sd-2.5-A',
    duration: 10,
    imageRefs: Array.from({ length: EGGFANS_VIDEO_LIMITS.maxImages }, (_, i) => `https://assets.example/image-${i}.png`),
    videoRefs: Array.from({ length: EGGFANS_VIDEO_LIMITS.maxVideos }, (_, i) => `https://assets.example/video-${i}.mp4`),
    audioRefs: Array.from({ length: EGGFANS_VIDEO_LIMITS.maxAudios }, (_, i) => `https://assets.example/audio-${i}.mp3`),
  }), null)
})

test('EggFans sd-2.5 standard video rejects invalid parameters without locking the configured model name', () => {
  for (const duration of [3, 31, 4.5]) {
    assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration }) || '', /时长/)
  }
  assert.match(validateEggfansStandardVideoInput({ model: '', duration: 4 }) || '', /模型/)
  assert.equal(validateEggfansStandardVideoInput({ model: 'sd-2.5-C', duration: 4 }), null)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, resolution: '1080p' }) || '', /分辨率/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, imageRefs: ['http://assets.example/ref.png'] }) || '', /HTTPS/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, imageRefs: ['data:image/png;base64,AAAA'] }) || '', /HTTPS/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, imageRefs: ['ftp://assets.example/ref.png'] }) || '', /HTTPS/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, imageRefs: ['static/uploads/ref.png'] }) || '', /HTTPS/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, imageRefs: Array(31).fill('https://assets.example/ref.png') }) || '', /超限/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, videoRefs: Array(11).fill('https://assets.example/ref.mp4') }) || '', /超限/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, audioRefs: Array(11).fill('https://assets.example/ref.mp3') }) || '', /超限/)
  assert.match(validateEggfansStandardVideoInput({ model: 'sd-2.5-A', duration: 4, lastImage: 'https://assets.example/last.png' }) || '', /首帧/)
  assert.match(validateEggfansStandardVideoInput({
    model: 'sd-2.5-A',
    duration: 4,
    firstImage: 'https://assets.example/first.png',
    imageRefs: ['https://assets.example/ref.png'],
  }) || '', /不能.*混用/)
})

test('EggFans Grok models use the legacy Grok routes', () => {
  const adapter = new EggfansVideoAdapter()
  const grokConfig = { ...config, baseUrl: 'https://aggregator.example/v1', model: 'grok-video-3' }
  const request = adapter.buildGenerateRequest(grokConfig, {
    id: 4,
    model: 'grok-video-3',
    prompt: 'test grok video',
    imageUrl: 'https://assets.example/first.png',
  })

  assert.equal(request.url, 'https://aggregator.example/v1/video/create')
  assert.equal(request.body.image_url, 'https://assets.example/first.png')
  assert.equal(
    adapter.buildPollRequest(grokConfig, 'grok-1').url,
    'https://aggregator.example/v1/video/status/grok-1',
  )
  assert.deepEqual(adapter.parsePollResponse({ status: 'succeeded', video_url: 'https://assets.example/out.mp4' }), {
    status: 'completed',
    videoUrl: 'https://assets.example/out.mp4',
  })
})
