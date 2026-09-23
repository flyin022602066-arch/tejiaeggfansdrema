import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const episode = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../app/composables/useApi.ts', import.meta.url), 'utf8')
const tasks = readFileSync(new URL('../../backend/src/routes/tasks.ts', import.meta.url), 'utf8')
const generation = readFileSync(new URL('../../backend/src/services/generation.ts', import.meta.url), 'utf8')

test('video reference mode is persisted and sent with every new task', () => {
  assert.match(api, /videoReferenceMode:.*\/settings\/video-reference-mode/)
  assert.match(api, /setVideoReferenceMode:.*\/settings\/video-reference-mode/)
  assert.match(episode, /asset_reference_mode:\s*videoAssetReferenceMode\.value/)
  assert.match(tasks, /assetReferenceMode:\s*videoBody!\.asset_reference_mode/)
  assert.match(generation, /assetReferenceMode:\s*normalizeVideoAssetReferenceMode\(params\.assetReferenceMode\)/)
})

test('toolbar exposes mutually exclusive URI and URL choices', () => {
  assert.match(episode, /videoAssetReferenceMode === 'uri'/)
  assert.match(episode, /videoAssetReferenceMode === 'url'/)
  assert.match(episode, /changeVideoAssetReferenceMode\('uri'\)/)
  assert.match(episode, /changeVideoAssetReferenceMode\('url'\)/)
})
