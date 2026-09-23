import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const aiService = readFileSync(new URL('../src/services/ai.ts', import.meta.url), 'utf8')
const route = readFileSync(new URL('../src/routes/aiConfigs.ts', import.meta.url), 'utf8')
const registry = readFileSync(new URL('../src/services/adapters/registry.ts', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../../frontend/app/pages/settings.vue', import.meta.url), 'utf8')
const episode = readFileSync(new URL('../../frontend/app/views/drama/episode.vue', import.meta.url), 'utf8')

test('EggFans is selectable for all service types', () => {
  assert.match(aiService, /text: \[[^\]]*'eggfans'/)
  assert.match(aiService, /image: \[[^\]]*'eggfans'/)
  assert.match(aiService, /video: \[[^\]]*'eggfans'/)
  assert.match(settings, /const providers = \[[^\]]*'eggfans'/)
})

test('EggFans adapters and custom endpoints are wired end to end', () => {
  assert.match(registry, /eggfans: new EggfansImageAdapter\(\)/)
  assert.match(registry, /eggfans: new EggfansVideoAdapter\(\)/)
  assert.match(route, /endpoint: body\.endpoint \|\| null/)
  assert.match(route, /queryEndpoint: body\.query_endpoint \|\| null/)
  assert.match(route, /updates\.endpoint = body\.endpoint \|\| null/)
  assert.match(route, /updates\.queryEndpoint = body\.query_endpoint \|\| null/)
  assert.match(settings, /v-model="cfgForm\.endpoint"/)
  assert.match(settings, /v-model="cfgForm\.query_endpoint"/)
  assert.match(settings, /https:\/\/vip\.eggfans\.asia/)
  assert.match(settings, /https:\/\/vip\.eggfans\.work/)
  assert.match(settings, /sd-2\.5-C/)
  assert.match(settings, /\/v1\/videos/)
  assert.match(settings, /\/v1\/videos\/\{taskId\}/)
})

test('Eggfans aggregate APIs and VIP video APIs keep separate configured hosts', () => {
  assert.match(settings, /image:\s*\{[\s\S]*?eggfans:\s*\{[^}]*baseUrl:\s*'https:\/\/api\.eggfans\.com'/)
  assert.match(settings, /video:\s*\{[\s\S]*?eggfans:\s*\{[^}]*baseUrl:\s*'https:\/\/vip\.eggfans\.asia'/)
  assert.match(settings, /service_type:\s*'text'[^\n]*base_url:\s*'https:\/\/api\.eggfans\.com'/)
  assert.match(settings, /service_type:\s*'image'[^\n]*base_url:\s*'https:\/\/api\.eggfans\.com'/)
  assert.match(settings, /service_type:\s*'video'[^\n]*provider:\s*'eggfans'[^\n]*base_url:\s*'https:\/\/vip\.eggfans\.asia'/)
})

test('EggFans pricing model discovery is filtered to requested families', () => {
  assert.match(route, /app\.get\('\/eggfans-models'/)
  assert.match(route, /api\.eggfans\.com\/api\/pricing_new/)
  assert.match(route, /\^\(gpt\|gemini\|doubao\)-/i)
  assert.match(settings, /aiConfigAPI\.eggfansModels\(\)/)
  assert.match(settings, /eggfan[sS]ModelOptions/)
})

test('Settings model presets support multi-select and persist the complete model list', () => {
  assert.match(settings, /v-model="cfgSelectedModels"\s+type="checkbox"/)
  assert.match(settings, /cfgForm\.modelStr = cfgSelectedModels\.value\.join\(', '\)/)
  assert.match(settings, /function parseCfgModels\(value\)/)
})

test('Scene image model selection is isolated from character and prop image model', () => {
  assert.match(episode, /MODEL_STORE_KEYS = \{[^}]*scene: 'huobao:model:scene-image'/s)
  assert.match(episode, /const sceneModel = ref\(/)
  assert.match(episode, /v-model="sceneModel"/)
  assert.match(episode, /sceneAPI\.generateImage\(id, epId\.value, bareModelName\(sceneModel\.value\)/)
  assert.match(episode, /characterAPI\.generateImage\(id, epId\.value, bareModelName\(imageModel\.value\)/)
  assert.match(episode, /propAPI\.generateImage\(id, epId\.value, bareModelName\(imageModel\.value\)/)
})

test('EggFans text agents use the OpenAI-compatible /v1 base path', () => {
  const ai = aiService
  assert.match(ai, /provider === 'eggfans'/)
  assert.match(ai, /joinProviderUrl\(config\.baseUrl, '\/v1', ''\)/)
})

test('EggFans sd-2.5 family workbench exposes the documented fixed parameters', () => {
  assert.match(episode, /eggfans:\s*\['720p'\]/)
  assert.match(episode, /EGGFANS_SD25_MODEL_RE\s*=\s*\/\^sd-2\\\.5-/)
  assert.match(episode, /isWan3Video\.value\s*\|\|\s*isEggfansSd25\.value\s*\?\s*30/)
  assert.match(episode, /isEggfansSd25\.value\s*\?\s*30\s*:\s*isWan3Video\.value\s*\?\s*10\s*:\s*9/)
  assert.match(episode, /resolution:\s*episodeResolution\.value/)
})

test('workbench exposes and persists the project-wide video aspect ratio', () => {
  assert.match(episode, /v-model="dramaAspectRatio"/)
  assert.match(episode, /:label="t\('episode\.topbar\.aspectRatio'\)"/)
  assert.match(episode, /const aspectRatioOptions = computed/)
  assert.match(episode, /dramaAPI\.update\(dramaId, \{ aspect_ratio: val \}\)/)
  assert.match(episode, /aspect_ratio:\s*dramaAspectRatio\.value/)
})

test('asset image controls default to documented 4K high quality and low moderation', () => {
  assert.match(episode, /size:\s*'3840x2160'/)
  assert.match(episode, /quality:\s*'high'/)
  assert.match(episode, /moderation:\s*'low'/)
  assert.match(episode, /v-model="batchImageParams\.moderation"/)
})
