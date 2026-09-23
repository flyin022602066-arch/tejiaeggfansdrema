import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('..', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

test('workbench remembers each model category independently and waits for lists before pruning', () => {
  const episode = read('app/views/drama/episode.vue')
  assert.match(episode, /MODEL_STORE_KEYS = \{ chat:/)
  assert.match(episode, /scene: 'huobao:model:scene-image'/)
  assert.match(episode, /MODEL_COOKIE_KEY = 'huobao_models'/)
  assert.match(episode, /document\.cookie = `\$\{MODEL_COOKIE_KEY\}=/)
  assert.match(episode, /const storedModels = readStoredModels\(\)/)
  assert.match(episode, /localStorage\.getItem\(key\)/)
  assert.match(episode, /persistModel\(videoModel, 'video', MODEL_STORE_KEYS\.video\)/)
  assert.match(episode, /const modelListsReady = ref\(false\)/)
  assert.match(episode, /watch\(\[optionsRef, modelListsReady\]/)
  assert.match(episode, /if \(!ready\) return/)
  assert.match(episode, /finally \{ modelListsReady\.value = true \}/)
})
