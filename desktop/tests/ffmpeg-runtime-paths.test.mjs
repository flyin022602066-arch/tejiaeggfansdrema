import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const prepare = readFileSync(new URL('../scripts/prepare-resources.mjs', import.meta.url), 'utf8')
const builder = readFileSync(new URL('../electron-builder.yml', import.meta.url), 'utf8')

test('desktop development backend receives the valid backend ffmpeg paths', () => {
  assert.match(main, /backend', 'node_modules', 'ffmpeg-static'/)
  assert.match(main, /env\.FFMPEG_BIN = ffmpegDev/)
  assert.match(main, /env\.FFPROBE_BIN = ffprobeDev/)
})

test('packaged media resource folders match electron-builder os names', () => {
  assert.match(builder, /resources\/bin-\$\{os\}/)
  assert.match(prepare, /bin-darwin/)
  assert.match(prepare, /bin-win32/)
  assert.doesNotMatch(prepare, /bin-mac['"]/)
  assert.doesNotMatch(prepare, /bin-win['"]/)
})

test('resource preparation can fall back to backend-installed binaries', () => {
  assert.match(prepare, /createRequire\(path\.join\(REPO, 'backend', 'package\.json'\)\)/)
  assert.match(prepare, /for \(const resolver of \[req, backendReq\]\)/)
})
