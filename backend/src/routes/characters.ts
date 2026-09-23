import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { db, getInsertId, schema } from '../db/index.js'
import { success, created, badRequest, notFound, now } from '../utils/response.js'
import { toSnakeCase } from '../utils/transform.js'
import { generateImage } from '../services/generation.js'
import { getDramaStylePrompt } from '../services/style-preset.js'
import { composeAssetGenerationPrompt } from '../services/prompt-style.js'
import { ensureCharacterFinalPrompt } from '../services/final-prompt.js'
import { logTaskError, logTaskStart, logTaskSuccess } from '../utils/task-logger.js'
import { ensureCharacterVirtualAssetUri } from '../services/virtual-assets.js'

const app = new Hono()
const CHARACTER_IMAGE_SIZE = '3840x2160'

// POST /characters — 手动新增角色（传入 episode_id 时关联到该集）
app.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.drama_id) return badRequest(c, 'drama_id 必填')
  if (!body.name?.trim()) return badRequest(c, '名称必填')
  const ts = now()
  const res = await db.insert(schema.characters).values({
    name: body.name.trim(),
    role: body.role || '',
    description: body.description || '',
    appearance: body.appearance || '',
    styling: body.styling || '',
    dramaId: body.drama_id,
    createdAt: ts,
    updatedAt: ts,
  })
  const charId = getInsertId(res)
  if (body.episode_id) {
    const existing = await db.select().from(schema.episodeCharacters)
      .where(and(eq(schema.episodeCharacters.episodeId, Number(body.episode_id)), eq(schema.episodeCharacters.characterId, charId)))
    if (!existing.length) {
      await db.insert(schema.episodeCharacters).values({ episodeId: Number(body.episode_id), characterId: charId, createdAt: ts })
    }
  }
  const [row] = await db.select().from(schema.characters).where(eq(schema.characters.id, charId))
  return created(c, toSnakeCase(row))
})

// GET /characters/:id - refresh one asset card without reloading the workbench
app.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [row] = await db.select().from(schema.characters).where(eq(schema.characters.id, id))
  if (!row || row.deletedAt) return notFound(c)
  return success(c, toSnakeCase(row))
})

function characterImagePrompt(char: typeof schema.characters.$inferSelect, stylePrompt = '') {
  return [
    stylePrompt || '',
    char.name,
    char.appearance || char.description || '人物立绘',
    char.styling || '',
    '16:9 横版角色定妆照',
    '半身角色海报构图',
    '正面',
    '高质量',
    '白色背景',
  ].filter(Boolean).join(', ')
}

// PUT /characters/:id
app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const updates: Record<string, any> = { updatedAt: now() }
  for (const key of ['name', 'role', 'description', 'appearance', 'styling', 'imageUrl', 'publicUrl', 'localPath']) {
    const snakeKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
    if (snakeKey in body) updates[key] = body[snakeKey]
    else if (key in body) updates[key] = body[key]
  }
  if (['image_url', 'imageUrl', 'public_url', 'publicUrl', 'local_path', 'localPath'].some(key => key in body)) {
    updates.virtualAssetId = null
    updates.virtualAssetUri = null
    updates.virtualAssetSourceUrl = null
    updates.virtualAssetStatus = null
  }
  // 手动编辑最终提示词时以传入值为准；未传入则保留原值（修改信息时不再自动置空）
  if (body.final_prompt !== undefined) updates.finalPrompt = body.final_prompt || null
  else if (body.finalPrompt !== undefined) updates.finalPrompt = body.finalPrompt || null
  await db.update(schema.characters).set(updates).where(eq(schema.characters.id, id))
  return success(c)
})

// POST /characters/:id/virtual-asset - manually create/retry the provider URI.
app.post('/:id/virtual-asset', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return badRequest(c, '角色 ID 无效')
  try {
    const asset = await ensureCharacterVirtualAssetUri(id)
    return success(c, {
      asset_id: asset.id ? String(asset.id) : null,
      asset_uri: asset.asset_uri || null,
      status: asset.status || null,
      source_url: asset.url || null,
    })
  } catch (error) {
    return badRequest(c, (error as Error).message)
  }
})

// DELETE /characters/:id
app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await db.update(schema.characters).set({ deletedAt: now() }).where(eq(schema.characters.id, id))
  return success(c)
})

// POST /characters/:id/generate-image
app.post('/:id/generate-image', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const [char] = await db.select().from(schema.characters).where(eq(schema.characters.id, id))
  if (!char) return badRequest(c, '角色不存在')
  if (!body.episode_id) return badRequest(c, 'episode_id 必填')

  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, Number(body.episode_id)))
  if (!ep) return badRequest(c, '剧集不存在')

  const stylePrompt = await getDramaStylePrompt(char.dramaId)
  const finalPrompt = await ensureCharacterFinalPrompt(char, ep.id, false, { model: body.text_model, configId: body.text_config_id ?? undefined })
  const prompt = [
    composeAssetGenerationPrompt(stylePrompt, finalPrompt || characterImagePrompt(char), 'character'),
    body.prompt_suffix,
  ].filter(Boolean).join(', ')
  try {
    logTaskStart('CharacterImage', 'generate', { characterId: id, episodeId: ep.id, dramaId: char.dramaId })
    const genId = await generateImage({ characterId: id, dramaId: char.dramaId, prompt, model: body.model, size: body.size || CHARACTER_IMAGE_SIZE, quality: body.quality, moderation: body.moderation, format: body.format, responseFormat: body.response_format, n: body.n, configId: body.config_id ?? ep.imageConfigId ?? undefined })
    logTaskSuccess('CharacterImage', 'generate', { characterId: id, generationId: genId })
    return success(c, { image_generation_id: genId })
  } catch (err: any) {
    logTaskError('CharacterImage', 'generate', { characterId: id, error: err.message })
    return badRequest(c, err.message)
  }
})

// POST /characters/:id/generate-prompt — 独立生成/重新生成三视图最终提示词（不生图）
app.post('/:id/generate-prompt', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const [char] = await db.select().from(schema.characters).where(eq(schema.characters.id, id))
  if (!char) return badRequest(c, '角色不存在')
  if (!body.episode_id) return badRequest(c, 'episode_id 必填')

  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, Number(body.episode_id)))
  if (!ep) return badRequest(c, '剧集不存在')

  logTaskStart('FinalPrompt', 'character-generate', { characterId: id, episodeId: ep.id, force: !!body.force })
  const finalPrompt = await ensureCharacterFinalPrompt(char, ep.id, !!body.force, { model: body.text_model, configId: body.text_config_id ?? undefined })
  if (!finalPrompt) {
    logTaskError('FinalPrompt', 'character-generate', { characterId: id, error: 'agent returned empty prompt' })
    return badRequest(c, '最终提示词生成失败，请重试')
  }
  logTaskSuccess('FinalPrompt', 'character-generate', { characterId: id })
  return success(c, { final_prompt: finalPrompt })
})

// POST /characters/batch-generate-images
app.post('/batch-generate-images', async (c) => {
  const body = await c.req.json()
  const ids: number[] = body.character_ids || []
  if (!body.episode_id) return badRequest(c, 'episode_id 必填')
  const [ep] = await db.select().from(schema.episodes).where(eq(schema.episodes.id, Number(body.episode_id)))
  if (!ep) return badRequest(c, '剧集不存在')
  const results: number[] = []
  const items: Array<{ character_id: number; image_generation_id: number }> = []
  const stylePrompt = await getDramaStylePrompt(ep.dramaId)
  for (const cid of ids) {
    const [char] = await db.select().from(schema.characters).where(eq(schema.characters.id, cid))
    if (!char) continue
    const finalPrompt = await ensureCharacterFinalPrompt(char, ep.id, false, { model: body.text_model, configId: body.text_config_id ?? undefined })
    const prompt = [
      composeAssetGenerationPrompt(stylePrompt, finalPrompt || characterImagePrompt(char), 'character'),
      body.prompt_suffix,
    ].filter(Boolean).join(', ')
    try {
      const genId = await generateImage({ characterId: cid, dramaId: char.dramaId, prompt, model: body.model, size: body.size || CHARACTER_IMAGE_SIZE, quality: body.quality, moderation: body.moderation, format: body.format, responseFormat: body.response_format, n: body.n, configId: body.config_id ?? ep.imageConfigId ?? undefined })
      results.push(genId)
      items.push({ character_id: cid, image_generation_id: genId })
    } catch {}
  }
  logTaskSuccess('CharacterImage', 'batch-generate', { episodeId: ep.id, requested: ids.length, started: results.length })
  return success(c, { count: results.length, ids: results, items })
})

export default app
