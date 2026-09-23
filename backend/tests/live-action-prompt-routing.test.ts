import assert from 'node:assert/strict'
import { test } from 'node:test'
import { composeAssetGenerationPrompt, composeVideoGenerationPrompt } from '../src/services/prompt-style.js'

const style = 'strictly photorealistic live-action Chinese xuanhuan fantasy feature-film photography, real adult human actors, absolutely no anime, no manga, no illustration, no 2D or 2.5D art, no cel shading, no digital painting, no game character concept art, no 3D CG human'

test('current live-action style overrides a stale generated character prompt', () => {
  const stale = 'photorealistic live-action old style, avoid anime, 角色设定参考图，左侧正脸特写，右侧三视图，纯白背景'
  const prompt = composeAssetGenerationPrompt(style, stale, 'character')

  assert.ok(prompt.startsWith(style))
  assert.doesNotMatch(prompt, /old style/)
  assert.match(prompt, /physical full-frame cinema camera/i)
  assert.match(prompt, /photographic casting, costume, and continuity reference sheet/i)
  assert.match(prompt, /ABSOLUTELY NO anime, manga, donghua, illustration, 2D or 2\.5D art, cel shading, digital painting, game character concept art, 3D CG render/i)
  assert.equal(prompt.match(/角色设定参考图/g)?.length, 1)
})

test('scene and prop prompts receive medium-specific photographic guards', () => {
  const scene = composeAssetGenerationPrompt(style, '固定机位广角镜头，古代山门，空场景', 'scene')
  const prop = composeAssetGenerationPrompt(style, '单品产品图，凤凰长鞭，纯白背景', 'prop')

  assert.match(scene, /live-action location and production-design plate/i)
  assert.match(scene, /no 2D or 2\.5D art/i)
  assert.match(prop, /practical prop product photography/i)
  assert.match(prop, /game-item concept art/i)
})

test('manual asset directions before the layout marker are preserved', () => {
  const manual = '必须保留左眼下方的小痣，角色设定参考图，左侧正脸特写，右侧三视图'
  const prompt = composeAssetGenerationPrompt(style, manual, 'character')

  assert.match(prompt, /必须保留左眼下方的小痣/)
  assert.match(prompt, /角色设定参考图/)
})

test('video prompt always receives the current live-action style and hard exclusions', () => {
  const prompt = composeVideoGenerationPrompt(style, '角色向前走，镜头缓慢推进')

  assert.ok(prompt.startsWith(style))
  assert.match(prompt, /STRICT LIVE-ACTION VIDEO MEDIUM/)
  assert.match(prompt, /Do not convert any reference into anime, manga, donghua, illustration, 2D or 2\.5D art/i)
  assert.match(prompt, /角色向前走/)
})
