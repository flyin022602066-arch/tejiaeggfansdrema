import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

test('asset tables persist a separate public image-host URL', () => {
  const schema = read('src/db/schema.ts')
  const sqlite = read('src/db/sqlite-schema.ts')

  assert.equal((schema.match(/publicUrl: text\('public_url'\)/g) || []).length, 3)
  assert.match(sqlite, /characters:[\s\S]*public_url: 'TEXT'/)
  assert.match(sqlite, /scenes:[\s\S]*public_url: 'TEXT'/)
  assert.match(sqlite, /props:[\s\S]*public_url: 'TEXT'/)
})

test('manual image upload returns a public URL and supports retry', () => {
  const upload = read('src/routes/upload.ts')

  assert.match(upload, /uploadFileToImageHost\(path, file\.type \|\| 'image\/png'\)/)
  assert.match(upload, /public_url: publicUrl \|\| null/)
  assert.match(upload, /app\.post\('\/asset-public-url'/)
  assert.match(upload, /saveAssetPublicUrl\(kind, id, publicUrl\)/)
})

test('generated assets upload to the image host without failing local completion', () => {
  const generation = read('src/services/generation.ts')

  assert.match(generation, /uploadGeneratedAssetToImageHost\(record, localPath\)/)
  assert.match(generation, /asset-public-upload-failed/)
  assert.match(generation, /set\(\{ imageUrl: localPath, publicUrl/)
})
