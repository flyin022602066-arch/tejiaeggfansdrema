import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

test('asset UI exposes the public URL and a manual retry action', () => {
  const episode = read('app/views/drama/episode.vue')

  assert.match(episode, /function assetPublicUrl\(item\)/)
  assert.match(episode, /retryAssetPublicUpload\(kind, id\)/)
  assert.match(episode, /episode\.asset\.publicUrl/)
  assert.match(episode, /episode\.asset\.uploadPublic/)
})

test('manual asset uploads persist the image-host result', () => {
  const episode = read('app/views/drama/episode.vue')
  const api = read('app/composables/useApi.ts')

  assert.match(episode, /public_url: res\.public_url \|\| null/)
  assert.match(api, /assetPublicUrl: \(kind:/)
})

test('video references prefer the persisted public URL', () => {
  const episode = read('app/views/drama/episode.vue')

  assert.match(episode, /pushRef\(assetPublicUrl\(scene\) \|\| scene\?\.image_url/)
  assert.match(episode, /pushRef\(assetPublicUrl\(char\) \|\| char\?\.image_url/)
  assert.match(episode, /pushRef\(assetPublicUrl\(prop\) \|\| prop\?\.image_url/)
})

test('project asset library uses the same public URL and retry flow', () => {
  const detail = read('app/views/drama/detail.vue')

  assert.match(detail, /public_url: res\.public_url \|\| null/)
  assert.match(detail, /function retryMaterialPublicUrl\(m\)/)
  assert.match(detail, /matPublicUrl\(editTarget\)/)
  assert.match(detail, /uploadAPI\.assetPublicUrl\(m\.kindKey, m\.id\)/)
})
