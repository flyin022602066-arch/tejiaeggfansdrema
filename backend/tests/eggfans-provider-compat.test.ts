import test from 'node:test'
import assert from 'node:assert/strict'
import { EggfansImageAdapter } from '../src/services/adapters/eggfans-image.js'
import { EggfansVideoAdapter } from '../src/services/adapters/eggfans-video.js'

const config = {
  provider: 'eggfans',
  baseUrl: 'https://aggregator.example/v1',
  apiKey: 'test-key',
  model: 'aigc-video-vidu',
  endpoint: '/videos',
  queryEndpoint: '/videos/{taskId}',
}

test('EggFans image uses the OpenAI-compatible endpoint without duplicating /v1', () => {
  const adapter = new EggfansImageAdapter()
  const request = adapter.buildGenerateRequest({ ...config, endpoint: '/images/generations' }, {
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

test('EggFans standard video honors configured create and query endpoints', () => {
  const adapter = new EggfansVideoAdapter()
  const request = adapter.buildGenerateRequest(config, {
    id: 2,
    model: 'aigc-video-vidu',
    prompt: 'test video',
    duration: 6,
    aspectRatio: '16:9',
    referenceImageUrls: JSON.stringify(['https://assets.example/ref.png']),
  })

  assert.equal(request.url, 'https://aggregator.example/v1/videos')
  assert.equal(request.body.model, 'aigc-video-vidu')
  assert.equal(request.body.aspect_ratio, '16:9')
  assert.deepEqual(request.body.reference_images, ['https://assets.example/ref.png'])
  assert.equal(
    adapter.buildPollRequest(config, 'task/123').url,
    'https://aggregator.example/v1/videos/task%2F123',
  )
  assert.deepEqual(adapter.parseGenerateResponse({ task_id: 'task-1' }), {
    isAsync: true,
    taskId: 'task-1',
  })
})

test('EggFans Grok models use the legacy Grok routes', () => {
  const adapter = new EggfansVideoAdapter()
  const grokConfig = { ...config, model: 'grok-video-3' }
  const request = adapter.buildGenerateRequest(grokConfig, {
    id: 3,
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
