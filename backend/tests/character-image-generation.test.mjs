import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

test('character image generation uses 4K 16:9 asset size', () => {
  const source = read('src/routes/characters.ts')
  const props = read('src/routes/props.ts')
  const generation = read('src/services/generation.ts')

  assert.match(source, /CHARACTER_IMAGE_SIZE = '3840x2160'/)
  assert.match(props, /PROP_IMAGE_SIZE = '3840x2160'/)
  assert.match(generation, /ASSET_IMAGE_SIZE = '3840x2160'/)
  assert.match(generation, /ASSET_IMAGE_QUALITY = 'high'/)
  assert.match(generation, /ASSET_IMAGE_MODERATION = 'low'/)
  assert.match(source, /16:9 横版角色定妆照/)
  assert.match(source, /半身角色海报构图/)
  assert.match(source, /size: body\.size \|\| CHARACTER_IMAGE_SIZE/)
})
