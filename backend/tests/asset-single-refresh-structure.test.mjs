import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('each asset type exposes a single-card refresh endpoint', () => {
  for (const route of ['characters', 'scenes', 'props']) {
    const source = read(`src/routes/${route}.ts`)
    assert.match(source, /app\.get\('\/:id', async \(c\) =>/)
    assert.match(source, /return success\(c, toSnakeCase\(row\)\)/)
    assert.match(source, /if \(!row \|\| row\.deletedAt\) return notFound\(c\)/)
  }
})

test('local image is written to the asset before the task becomes completed', () => {
  const source = read('src/services/generation.ts')
  for (const handler of ['handleImageComplete', 'handleImageCompleteBase64']) {
    const start = source.indexOf(`async function ${handler}`)
    const end = source.indexOf('\nasync function ', start + 1)
    const block = source.slice(start, end)
    const writeBack = block.indexOf('await writeBackImageAssets(record, localPath, null)')
    const completed = block.indexOf("status: 'completed'")
    const publicUpload = block.indexOf('await uploadGeneratedAssetToImageHost(record, localPath)')
    assert.ok(writeBack >= 0 && writeBack < completed, `${handler} must write the local asset before completion`)
    assert.ok(completed >= 0 && completed < publicUpload, `${handler} must not wait for public upload before completion`)
  }
})
