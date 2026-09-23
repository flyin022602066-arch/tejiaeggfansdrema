import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const episode = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../app/composables/useApi.ts', import.meta.url), 'utf8')

test('asset regeneration waits for a new image path when an old asset already exists', () => {
  assert.match(episode, /function assetImageValue\(kind, id\)/)
  assert.match(episode, /function assetImageReady\(kind, id, previousImages = new Map\(\)\)/)
  assert.match(episode, /return !previous \|\| current !== previous/)
  assert.match(episode, /watchAssetImageResult\('scene', \[id\], 120, previousImages, imageGenerationTaskMap\(id, result\)\)/)
  assert.match(episode, /watchAssetImageResult\('character', \[id\], 120, previousImages, imageGenerationTaskMap\(id, result\)\)/)
  assert.match(episode, /watchAssetImageResult\('prop', \[id\], 120, previousImages, imageGenerationTaskMap\(id, result\)\)/)
})

test('asset generation refreshes only the affected card', () => {
  assert.match(api, /characterAPI = \{\s*get: \(id: number\) => api\.get\(`\/characters\/\$\{id\}`\)/)
  assert.match(api, /sceneAPI = \{\s*get: \(id: number\) => api\.get\(`\/scenes\/\$\{id\}`\)/)
  assert.match(api, /propAPI = \{\s*get: \(id: number\) => api\.get\(`\/props\/\$\{id\}`\)/)
  assert.match(episode, /async function refreshAssetCard\(kind, id\)/)
  assert.match(episode, /if \(current\) Object\.assign\(current, fresh\)/)
  assert.match(episode, /const task = await taskAPI\.get\(taskId\)/)

  const poller = episode.slice(
    episode.indexOf('function watchAssetImageResult'),
    episode.indexOf('async function genCharImg'),
  )
  assert.doesNotMatch(poller, /await refresh\(\)/)

  const generationHandlers = episode.slice(
    episode.indexOf('async function genCharImg'),
    episode.indexOf('function getVideoUrl'),
  )
  assert.doesNotMatch(generationHandlers, /\brefresh\(\)/)
})

test('asset thumbnails are cache-busted by the refreshed updated timestamp', () => {
  assert.match(episode, /function assetThumbSrc\(item\)/)
  assert.match(episode, /item\?\.updated_at \|\| item\?\.updatedAt/)
  assert.match(episode, /:src="assetThumbSrc\(c\)"/)
  assert.match(episode, /:src="assetThumbSrc\(s\)"/)
  assert.match(episode, /:src="assetThumbSrc\(p\)"/)
})
