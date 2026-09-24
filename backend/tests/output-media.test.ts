import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'huobao-output-'))
const dataRoot = path.join(tempRoot, 'data')
const outputRoot = path.join(tempRoot, 'output')
fs.mkdirSync(path.join(dataRoot, 'static', 'images'), { recursive: true })
fs.mkdirSync(path.join(dataRoot, 'static', 'videos'), { recursive: true })
fs.writeFileSync(path.join(dataRoot, 'static', 'images', 'asset.png'), 'asset')
fs.writeFileSync(path.join(dataRoot, 'static', 'videos', 'clip.mp4'), 'video')

process.env.HUOBAO_DATA_DIR = dataRoot
process.env.HUOBAO_OUTPUT_DIR = outputRoot

const { copyMediaToOutput } = await import('../src/utils/output.js')
const { downloadFile } = await import('../src/utils/storage.js')

test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }))

test('copies generated asset images into output/assets', async () => {
  assert.equal(fs.existsSync(outputRoot), false)
  const outputPath = await copyMediaToOutput('static/images/asset.png', 'assets')
  assert.equal(outputPath, path.join(outputRoot, 'assets', 'asset.png'))
  assert.equal(fs.readFileSync(outputPath, 'utf8'), 'asset')
  assert.equal(fs.readFileSync(path.join(dataRoot, 'static', 'images', 'asset.png'), 'utf8'), 'asset')
})

test('copies generated videos into output/videos', async () => {
  const outputPath = await copyMediaToOutput('static/videos/clip.mp4', 'videos')
  assert.equal(outputPath, path.join(outputRoot, 'videos', 'clip.mp4'))
  assert.equal(fs.readFileSync(outputPath, 'utf8'), 'video')
})

test('a missing source cannot create an empty output file', async () => {
  await assert.rejects(copyMediaToOutput('static/images/missing.png', 'assets'), /ENOENT/)
  assert.equal(fs.existsSync(path.join(outputRoot, 'assets', 'missing.png')), false)
  assert.equal(fs.existsSync(path.join(outputRoot, 'assets', 'missing.png.part')), false)
})

test('extensionless provider media uses its MIME type and stays downloadable', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('video-data', { headers: { 'content-type': 'video/mp4' } })
    const localPath = await downloadFile('https://example.test/download?id=1', 'videos')
    assert.match(localPath, /^static\/videos\/[^/]+\.mp4$/)
    const outputPath = await copyMediaToOutput(localPath, 'videos')
    assert.equal(fs.readFileSync(outputPath, 'utf8'), 'video-data')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('extensionless image results keep their image format in output/assets', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('image-data', { headers: { 'content-type': 'image/jpeg; charset=utf-8' } })
    const localPath = await downloadFile('https://example.test/image?id=1', 'images')
    assert.match(localPath, /^static\/images\/[^/]+\.jpg$/)
    const outputPath = await copyMediaToOutput(localPath, 'assets')
    assert.equal(fs.readFileSync(outputPath, 'utf8'), 'image-data')
  } finally {
    globalThis.fetch = originalFetch
  }
})
