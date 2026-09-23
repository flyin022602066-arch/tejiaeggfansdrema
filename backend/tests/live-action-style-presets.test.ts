import assert from 'node:assert/strict'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { initSqliteSchema, LIVE_XUANHUAN_PROMPT, LIVE_XUANHUAN_V1_PROMPT, stylePresetSeeds } from '../src/db/sqlite-schema.js'

const expectedLiveStyles = [
  ['realistic', '真人现代写实'],
  ['live-cinematic-film', '真人电影画风'],
  ['live-documentary', '真人纪录片风格'],
  ['live-wuxia', '真人古代武侠'],
  ['live-xuanhuan', '真人玄幻影视'],
  ['live-xianxia', '真人仙侠影视'],
  ['live-historical', '真人古装历史'],
  ['live-republican-era', '真人民国电影'],
  ['live-period-drama', '真人年代剧'],
  ['live-urban-romance', '真人都市情感'],
  ['live-crime-thriller', '真人悬疑犯罪'],
  ['live-grounded-scifi', '真人科幻影视'],
  ['live-war-epic', '真人战争史诗'],
  ['live-youth-campus', '真人青春校园'],
  ['live-rural-realism', '真人乡土现实'],
  ['live-hongkong-retro', '真人复古港风'],
] as const

test('built-in catalog includes distinct production-ready live-action styles', () => {
  const values = new Set(stylePresetSeeds.map(style => style.value))
  const names = new Set(stylePresetSeeds.map(style => style.name))
  assert.equal(values.size, stylePresetSeeds.length)
  assert.equal(names.size, stylePresetSeeds.length)

  for (const [value, name] of expectedLiveStyles) {
    const style = stylePresetSeeds.find(item => item.value === value)
    assert.ok(style, `missing style ${value}`)
    assert.equal(style.name, name)
    assert.ok(style.description.startsWith('真人') || style.description.includes('真人'))
    assert.match(style.prompt, /photorealistic.*live-action/i)
    assert.match(style.prompt, /consistent (?:actor|subject) (?:appearance|faces)/i)
    assert.match(style.prompt, /(?:avoid|no) anime/i)
    assert.match(style.prompt, /(?:avoid|no) illustration/i)
    assert.ok(style.prompt.length >= 500, `${value} prompt should be detailed`)
  }
})

test('SQLite initialization inserts all live-action styles idempotently and active', () => {
  const sqlite = new Database(':memory:')
  try {
    initSqliteSchema(sqlite)
    const modern = sqlite.prepare("SELECT prompt FROM style_presets WHERE value = 'realistic'").get() as { prompt: string }
    sqlite.prepare(`
      INSERT INTO style_presets (name, value, prompt, description, sort_order, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run('真人现代写实', 'live-modern-realistic', modern.prompt, 'transitional seed', 10)
    initSqliteSchema(sqlite)
    const rows = sqlite.prepare(`
      SELECT name, value, prompt, description, sort_order, is_active
      FROM style_presets
      WHERE value = 'realistic' OR value LIKE 'live-%'
      ORDER BY sort_order
    `).all() as Array<{ name: string; value: string; prompt: string; description: string; sort_order: number; is_active: number }>

    assert.equal(rows.length, expectedLiveStyles.length)
    assert.deepEqual(rows.map(row => row.value), expectedLiveStyles.map(([value]) => value))
    assert.ok(rows.every(row => row.is_active === 1))
    assert.ok(rows.every(row => row.prompt.length >= 500))
    const transitional = sqlite.prepare("SELECT COUNT(*) AS count FROM style_presets WHERE value = 'live-modern-realistic'").get() as { count: number }
    assert.equal(transitional.count, 0)
  } finally {
    sqlite.close()
  }
})

test('SQLite initialization upgrades the untouched xuanhuan seed to strict live-action photography', () => {
  const sqlite = new Database(':memory:')
  try {
    initSqliteSchema(sqlite)
    sqlite.prepare("UPDATE style_presets SET prompt = ? WHERE value = 'live-xuanhuan'").run(LIVE_XUANHUAN_V1_PROMPT)
    initSqliteSchema(sqlite)

    const row = sqlite.prepare("SELECT prompt FROM style_presets WHERE value = 'live-xuanhuan'").get() as { prompt: string }
    assert.equal(row.prompt, LIVE_XUANHUAN_PROMPT)
    assert.match(row.prompt, /physical full-frame cinema camera/i)
    assert.match(row.prompt, /no manga/i)
    assert.match(row.prompt, /no 2D or 2\.5D art/i)
    assert.match(row.prompt, /no game character concept art/i)
    assert.match(row.prompt, /no 3D CG human/i)
  } finally {
    sqlite.close()
  }
})

test('SQLite initialization upgrades only stale asset prefixes for xuanhuan projects', () => {
  const sqlite = new Database(':memory:')
  try {
    initSqliteSchema(sqlite)
    const insertDrama = sqlite.prepare("INSERT INTO dramas (title, style, created_at, updated_at) VALUES (?, ?, 'now', 'now')")
    const xuanhuanId = Number(insertDrama.run('xuanhuan', 'live-xuanhuan').lastInsertRowid)
    const animeId = Number(insertDrama.run('anime', 'anime').lastInsertRowid)
    const insertCharacter = sqlite.prepare("INSERT INTO characters (drama_id, name, final_prompt, created_at, updated_at) VALUES (?, ?, ?, 'now', 'now')")
    insertCharacter.run(xuanhuanId, 'kept', `${LIVE_XUANHUAN_V1_PROMPT}, 角色设定参考图，必须保留左眼下方的小痣`)
    insertCharacter.run(animeId, 'untouched', `${LIVE_XUANHUAN_V1_PROMPT}, 角色设定参考图，旧项目内容`)

    initSqliteSchema(sqlite)

    const kept = sqlite.prepare("SELECT final_prompt FROM characters WHERE name = 'kept'").get() as { final_prompt: string }
    const untouched = sqlite.prepare("SELECT final_prompt FROM characters WHERE name = 'untouched'").get() as { final_prompt: string }
    assert.ok(kept.final_prompt.startsWith(LIVE_XUANHUAN_PROMPT))
    assert.match(kept.final_prompt, /必须保留左眼下方的小痣/)
    assert.ok(untouched.final_prompt.startsWith(LIVE_XUANHUAN_V1_PROMPT))
  } finally {
    sqlite.close()
  }
})
