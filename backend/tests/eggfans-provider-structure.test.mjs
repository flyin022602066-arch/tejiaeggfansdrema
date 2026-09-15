import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const aiService = readFileSync(new URL('../src/services/ai.ts', import.meta.url), 'utf8')
const route = readFileSync(new URL('../src/routes/aiConfigs.ts', import.meta.url), 'utf8')
const registry = readFileSync(new URL('../src/services/adapters/registry.ts', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../../frontend/app/pages/settings.vue', import.meta.url), 'utf8')

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
})
