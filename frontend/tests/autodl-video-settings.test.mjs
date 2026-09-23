import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const settings = readFileSync(new URL('../app/pages/settings.vue', import.meta.url), 'utf8')
const episode = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8')
const ai = readFileSync(new URL('../../backend/src/services/ai.ts', import.meta.url), 'utf8')
const route = readFileSync(new URL('../../backend/src/routes/aiConfigs.ts', import.meta.url), 'utf8')
const generation = readFileSync(new URL('../../backend/src/services/generation.ts', import.meta.url), 'utf8')

test('AutoDL MiniMax H3 preset exposes workflow endpoints and documented limits', () => {
  assert.match(settings, /AutoDL · MiniMax H3/)
  assert.match(settings, /https:\/\/autodl\.art/)
  assert.match(settings, /minimax_h3_zm_u24/)
  assert.match(settings, /comfyui_workflow\/result\/\{taskId\}/)
  assert.match(settings, /1–15 秒 · 480p \/ 768p · 最多 9 图 \/ 3 音频/)
})

test('AutoDL is accepted only as a video provider and uses a non-billable GET probe', () => {
  assert.match(ai, /video:\s*\[[^\]]*'autodl'/s)
  assert.doesNotMatch(ai, /text:\s*\[[^\]]*'autodl'/s)
  assert.doesNotMatch(ai, /image:\s*\[[^\]]*'autodl'/s)
  const probeStart = route.indexOf("if (p === 'autodl')")
  const probe = route.slice(probeStart, route.indexOf("if (p === 'aliyun')", probeStart))
  assert.match(probe, /method: 'GET'/)
  assert.match(probe, /Authorization: apiKey \|\| ''/)
  assert.doesNotMatch(probe, /Bearer/)
})

test('AutoDL UI and generation path enforce provider-specific media behavior', () => {
  assert.match(episode, /autodl: \['480p', '720p'\]/)
  assert.match(episode, /isAutoDLH3/)
  assert.match(episode, /isAutoDLH3\.value \? 1/)
  assert.match(generation, /needsPublicHostedMedia = isEggfansStandard \|\| isAutoDL/)
  assert.match(generation, /normalizePublicHostedMediaUrls\(params\.referenceAudioUrls/)
  assert.match(generation, /isAutoDL\s*\? uniqueMediaValues\(params\.referenceVideoUrls\)/)
})
