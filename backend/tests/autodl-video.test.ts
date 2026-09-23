import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AutoDLVideoAdapter } from '../src/services/adapters/autodl-video.js'
import { getVideoAdapter } from '../src/services/adapters/registry.js'

const adapter = new AutoDLVideoAdapter()
const config = {
  provider: 'autodl',
  baseUrl: 'https://autodl.art',
  apiKey: 'token-test',
  model: 'minimax_h3_zm_u24',
  endpoint: '/api/v1/comfyui/comfyui_workflow/minimax_h3_zm_u24',
  queryEndpoint: '/api/v1/comfyui/comfyui_workflow/result/{taskId}',
}

test('AutoDL H3 builds the documented workflow request without Bearer prefix', () => {
  const request = adapter.buildGenerateRequest(config, {
    id: 1,
    prompt: '电影感运镜',
    duration: 9,
    resolution: '720p',
    aspectRatio: '21:9',
    seed: 123,
    referenceImageUrls: JSON.stringify(['https://cdn.example/a.png', 'https://cdn.example/b.webp']),
    referenceAudioUrls: JSON.stringify(['https://cdn.example/a.mp3']),
  })

  assert.equal(request.url, 'https://autodl.art/api/v1/comfyui/comfyui_workflow/minimax_h3_zm_u24')
  assert.equal(request.method, 'POST')
  assert.equal(request.headers.Authorization, 'token-test')
  const body = request.body as Record<string, unknown>
  assert.match(String(body.prompt), /^subject_definitions:/)
  assert.match(String(body.prompt), /<Subject 1>.*<Picture 1>/)
  assert.match(String(body.prompt), /<Subject 2>.*<Picture 2>/)
  assert.match(String(body.prompt), /<Audio 1>/)
  assert.match(String(body.prompt), /summary:[\s\S]*retention_analysis:[\s\S]*detailed_description:[\s\S]*overall_soundscape:[\s\S]*non_diegetic_music:/)
  assert.match(String(body.prompt), /电影感运镜/)
  assert.deepEqual({ ...body, prompt: undefined }, {
    prompt: undefined,
    duration: 9,
    resolution: '768p横',
    seed: 123,
    ref_image_0: 'https://cdn.example/a.png',
    ref_image_1: 'https://cdn.example/b.webp',
    ref_audio_0: 'https://cdn.example/a.mp3',
  })
})

test('AutoDL H3 preserves an already formatted Ref2VA prompt', () => {
  const prompt = `subject_definitions:\n<Subject 1> is the actor in <Picture 1>.\nsummary:\n[reference generation] test\nretention_analysis:\n<Subject 1>: fully_preserved - test\ndetailed_description:\n[Shot 1] test\noverall_soundscape:\ntest\nnon_diegetic_music:\nN/A`
  const request = adapter.buildGenerateRequest(config, {
    id: 8,
    prompt,
    referenceImageUrls: JSON.stringify(['https://cdn.example/a.png']),
  })
  assert.equal(request.body.prompt, prompt)
})

test('AutoDL H3 maps duration and resolution to workflow enums', () => {
  const build = (duration: number, resolution: string, aspectRatio: string) => adapter.buildGenerateRequest(config, {
    id: 2,
    prompt: 'test',
    duration,
    resolution,
    aspectRatio,
  }).body

  assert.deepEqual(build(0, '480p', '9:16'), { prompt: 'test', duration: 1, resolution: '480p竖' })
  assert.deepEqual(build(30, '2K', '1:1'), { prompt: 'test', duration: 15, resolution: '768p(1:1)' })
  assert.deepEqual(build(5, '720p', '16:9'), { prompt: 'test', duration: 5, resolution: '768p横' })
})

test('AutoDL H3 enforces prompt and reference limits', () => {
  assert.throws(() => adapter.buildGenerateRequest(config, { id: 3, prompt: 'x'.repeat(10_001) }), /10000/)
  assert.throws(() => adapter.buildGenerateRequest(config, {
    id: 4,
    prompt: 'test',
    referenceVideoUrls: JSON.stringify(['https://cdn.example/ref.mp4']),
  }), /不支持参考视频/)
  assert.throws(() => adapter.buildGenerateRequest(config, {
    id: 5,
    prompt: 'test',
    referenceImageUrls: JSON.stringify(Array.from({ length: 10 }, (_, i) => `https://cdn.example/${i}.png`)),
  }), /最多 9 张/)
  assert.throws(() => adapter.buildGenerateRequest(config, {
    id: 6,
    prompt: 'test',
    referenceAudioUrls: JSON.stringify(Array.from({ length: 4 }, (_, i) => `https://cdn.example/${i}.mp3`)),
  }), /最多 3 个/)
  assert.throws(() => adapter.buildGenerateRequest(config, {
    id: 7,
    prompt: 'test',
    referenceImageUrls: JSON.stringify(['data:image/png;base64,AAAA']),
  }), /公网 HTTP\(S\) URL/)
})

test('AutoDL H3 parses submit and all documented polling states', () => {
  assert.deepEqual(adapter.parseGenerateResponse({ code: 'Success', data: { task_id: 'task-1', status: 'QUEUED' } }), {
    isAsync: true,
    taskId: 'task-1',
  })
  assert.deepEqual(adapter.parsePollResponse({ code: 'Success', data: { status: 'QUEUED' } }), { status: 'pending' })
  assert.deepEqual(adapter.parsePollResponse({ code: 'Success', data: { status: 'RUNNING' } }), { status: 'processing' })
  assert.deepEqual(adapter.parsePollResponse({ code: 'Success', data: {
    status: 'Completed',
    results: [{ type: 'video', file_type: 'mp4', url: 'https://cdn.example/out.mp4' }],
  } }), { status: 'completed', videoUrl: 'https://cdn.example/out.mp4' })
  assert.deepEqual(adapter.parsePollResponse({ code: 'Success', data: { status: 'FAILED', message: 'workflow error' } }), {
    status: 'failed',
    error: 'workflow error',
  })
})

test('AutoDL H3 poll endpoint and registry are wired', () => {
  const request = adapter.buildPollRequest(config, 'task/1')
  assert.equal(request.url, 'https://autodl.art/api/v1/comfyui/comfyui_workflow/result/task%2F1')
  assert.equal(request.headers.Authorization, 'token-test')
  assert.equal(getVideoAdapter('autodl').provider, 'autodl')
})
