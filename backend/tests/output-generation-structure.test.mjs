import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const generation = readFileSync(new URL('../src/services/generation.ts', import.meta.url), 'utf8')
const merge = readFileSync(new URL('../src/services/ffmpeg-merge.ts', import.meta.url), 'utf8')
const desktop = readFileSync(new URL('../../desktop/src/main.ts', import.meta.url), 'utf8')

test('image URL and base64 completion both copy before marking the task complete', () => {
  const handlers = generation.slice(generation.indexOf('async function handleImageComplete('), generation.indexOf('async function uploadGeneratedAssetToImageHost('))
  assert.equal((handlers.match(/await copyImageToOutput\(record, localPath\)/g) || []).length, 2)
  assert.match(handlers, /async function handleImageComplete\([\s\S]*?await copyImageToOutput\(record, localPath\)[\s\S]*?status: 'completed'/)
  assert.match(handlers, /async function handleImageCompleteBase64\([\s\S]*?await copyImageToOutput\(record, localPath\)[\s\S]*?status: 'completed'/)
})

test('video and merged-video completion both mirror the locally saved result', () => {
  assert.match(generation, /async function handleVideoComplete\([\s\S]*?await copyMediaToOutput\(localPath, 'videos'\)[\s\S]*?status: 'completed'/)
  assert.match(merge, /const mergedRelative = `static\/merged\/\$\{outputFilename\}`[\s\S]*?await copyMediaToOutput\(mergedRelative, 'videos'\)[\s\S]*?status: 'completed'/)
})

test('desktop routes output outside the application package', () => {
  assert.match(desktop, /HUOBAO_OUTPUT_DIR: path\.join\(app\.isPackaged \? app\.getPath\('userData'\) : REPO_ROOT, 'output'\)/)
})
