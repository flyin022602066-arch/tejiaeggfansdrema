import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const episode = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8')

test('video polling window covers long-running backend generation', () => {
  const interval = Number(episode.match(/const VIDEO_TASK_POLL_INTERVAL_MS = (\d+)/)?.[1])
  const attempts = Number(episode.match(/const VIDEO_TASK_POLL_MAX_ATTEMPTS = (\d+)/)?.[1])

  assert.ok(interval > 0)
  assert.ok(attempts > 0)
  assert.ok(interval * attempts >= 60 * 60 * 1000)
  assert.match(episode, /for \(let i = 0; i < VIDEO_TASK_POLL_MAX_ATTEMPTS; i\+\+\)/)
})

test('processing video tasks resume polling after the workbench is reopened', () => {
  assert.match(episode, /task\.status === 'processing' && task\.id/)
  assert.match(episode, /pollVideoGeneration\(task\.id, Number\(sbId\), \{ notifyCompletion: false \}\)/)
  assert.match(episode, /activeVideoPollTaskIds\.has\(taskId\)/)
})

test('poll exhaustion does not turn an unknown backend state into a timeout failure', () => {
  const start = episode.indexOf('async function pollVideoGeneration')
  const end = episode.indexOf('async function doMerge', start)
  const polling = episode.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.doesNotMatch(polling, /episode\.vid\.genTimeout/)
  assert.match(polling, /if \(res\?\.status === 'failed'\)/)
  assert.match(polling, /await loadGenTasks\(\)/)
})
