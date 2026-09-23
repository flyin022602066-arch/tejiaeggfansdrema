import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadFileToImageHost } from '../src/services/image-host.js'

test('keeps Eggfans idle when Uguu succeeds', async () => {
  let eggfansCalls = 0
  const result = await uploadFileToImageHost('fixture.png', 'image/png', {
    uploadUguu: async () => 'https://uguu.se/fixture.png',
    uploadEggfans: async () => { eggfansCalls += 1; return 'https://imageproxy.zhongzhuan.chat/fixture.png' },
    getEggfansKey: () => 'sk-test',
  })
  assert.deepEqual(result, { url: 'https://uguu.se/fixture.png', provider: 'uguu' })
  assert.equal(eggfansCalls, 0)
})

test('falls back to Eggfans with the configured key', async () => {
  let receivedKey = ''
  const result = await uploadFileToImageHost('fixture.png', 'image/png', {
    uploadUguu: async () => { throw new Error('offline') },
    uploadEggfans: async (_value, _mime, key) => { receivedKey = key; return 'https://imageproxy.zhongzhuan.chat/fixture.png' },
    getEggfansKey: () => 'sk-test',
  })
  assert.equal(receivedKey, 'sk-test')
  assert.deepEqual(result, { url: 'https://imageproxy.zhongzhuan.chat/fixture.png', provider: 'eggfans' })
})

test('reports an actionable error when fallback key is absent', async () => {
  await assert.rejects(
    uploadFileToImageHost('fixture.png', 'image/png', {
      uploadUguu: async () => { throw new Error('offline') },
      getEggfansKey: () => '',
    }),
    /未配置 Eggfans 图床 Key/,
  )
})
