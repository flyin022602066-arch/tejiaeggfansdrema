import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const generation = readFileSync(new URL('../src/services/generation.ts', import.meta.url), 'utf8')
const virtualAssets = readFileSync(new URL('../src/services/virtual-assets.ts', import.meta.url), 'utf8')
const settingsRoute = readFileSync(new URL('../src/routes/settings.ts', import.meta.url), 'utf8')
const settingsView = readFileSync(new URL('../../frontend/app/pages/settings.vue', import.meta.url), 'utf8')
const episodeView = readFileSync(new URL('../../frontend/app/views/drama/episode.vue', import.meta.url), 'utf8')

test('virtual asset key remains isolated from image and video provider keys', () => {
  assert.match(settingsRoute, /getEggfansVirtualAssetKey/)
  assert.match(settingsRoute, /app\.get\('\/virtual-assets'/)
  assert.match(settingsRoute, /app\.put\('\/virtual-assets'/)
  assert.match(settingsView, /settingsAPI\.setVirtualAssets/)
  assert.match(settingsView, /https:\/\/api\.mjing\.cc/)
})

test('only sd storyboard character references are replaced by provider URIs', () => {
  assert.match(generation, /isSdSeries\s*=\s*isEggfansStandard\s*&&\s*\/\^sd/)
  assert.match(generation, /mapStoryboardCharacterReferencesToUris/)
  assert.match(virtualAssets, /schema\.storyboardCharacters/)
  assert.match(virtualAssets, /ensureCharacterVirtualAssetUri\(character\.id\)/)
  assert.match(virtualAssets, /normalizeNonCharacter\(ref\)/)
})

test('character cards expose URI status and a manual retry action', () => {
  assert.match(episodeView, /assetVirtualUri\(c\)/)
  assert.match(episodeView, /characterAPI\.virtualAsset/)
  assert.match(episodeView, /virtualAssetCreate/)
})
