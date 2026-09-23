import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeVideoAssetReferenceMode,
  resolveSdReferenceImages,
} from '../src/services/video-reference-mode.js'

test('defaults missing and legacy tasks to URI mode', () => {
  assert.equal(normalizeVideoAssetReferenceMode(undefined), 'uri')
  assert.equal(normalizeVideoAssetReferenceMode('invalid'), 'uri')
  assert.equal(normalizeVideoAssetReferenceMode('url'), 'url')
})

test('URI mode invokes only the virtual-asset resolver', async () => {
  let uriCalls = 0
  let urlCalls = 0
  const result = await resolveSdReferenceImages(
    'uri',
    async () => { uriCalls += 1; return ['asset://character/1'] },
    async () => { urlCalls += 1; return ['https://uguu.se/character.png'] },
  )

  assert.deepEqual(result, ['asset://character/1'])
  assert.equal(uriCalls, 1)
  assert.equal(urlCalls, 0)
})

test('URL mode invokes only the public URL resolver', async () => {
  let uriCalls = 0
  let urlCalls = 0
  const result = await resolveSdReferenceImages(
    'url',
    async () => { uriCalls += 1; return ['asset://character/1'] },
    async () => { urlCalls += 1; return ['https://uguu.se/character.png'] },
  )

  assert.deepEqual(result, ['https://uguu.se/character.png'])
  assert.equal(uriCalls, 0)
  assert.equal(urlCalls, 1)
})
