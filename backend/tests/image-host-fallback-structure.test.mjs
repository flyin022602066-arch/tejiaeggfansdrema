import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

test('Eggfans image host key is persisted through settings API without returning the secret', () => {
  const service = read('src/services/app-settings.ts')
  const route = read('src/routes/settings.ts')
  assert.match(service, /EGGFANS_IMAGE_HOST_KEY/)
  assert.match(service, /getEggfansImageHostKey/)
  assert.match(service, /setEggfansImageHostKey/)
  assert.match(route, /app\.get\('\/image-host'/)
  assert.match(route, /app\.put\('\/image-host'/)
  assert.doesNotMatch(route, /getEggfansImageHostKey\(\).*success/)
})

test('public asset uploads use Uguu then the documented Eggfans fallback', () => {
  const host = read('src/services/image-host.ts')
  const upload = read('src/routes/upload.ts')
  const generation = read('src/services/generation.ts')
  assert.match(host, /https:\/\/imageproxy\.zhongzhuan\.chat\/api\/upload/)
  assert.match(host, /Authorization: `Bearer \$\{key\}`/)
  assert.match(host, /uploadUguu = dependencies\.uploadUguu \|\| uploadFileToUguu/)
  assert.match(host, /uploadFileToEggfans\(/)
  assert.match(upload, /uploadFileToImageHost\(/)
  assert.match(generation, /uploadFileToImageHost\(/)
})
