export type AssetPromptKind = 'character' | 'scene' | 'prop'

const LIVE_ACTION_STYLE = /\bphotorealistic\b[\s\S]*\blive-action\b/i

const LIVE_ACTION_ASSET_GUARDS: Record<AssetPromptKind, string> = {
  character: 'STRICT LIVE-ACTION MEDIUM REQUIREMENT: this must be a photographic casting, costume, and continuity reference sheet of a real human actor captured with a physical full-frame cinema camera. Preserve the multi-view reference-sheet layout, but every view must look like the same photographed actor in a real tailored costume, with natural skin pores, fine facial hair, realistic eyes, lifelike hands, natural body proportions, real fabric weave, practical jewelry, physically plausible light, and subtle lens response. ABSOLUTELY NO anime, manga, donghua, illustration, 2D or 2.5D art, cel shading, digital painting, game character concept art, 3D CG render, doll-like face, porcelain skin, oversized eyes, or plastic beauty-filter skin',
  scene: 'STRICT LIVE-ACTION MEDIUM REQUIREMENT: this must be a photographic live-action location and production-design plate captured with a physical cinema camera, with practical sets, physically plausible materials, natural atmospheric perspective, realistic light transport, and subtle lens response. ABSOLUTELY NO anime, manga, donghua, illustration, 2D or 2.5D art, cel shading, digital painting, game environment concept art, 3D CG render, miniature-diorama look, or synthetic plastic materials',
  prop: 'STRICT LIVE-ACTION MEDIUM REQUIREMENT: this must be practical prop product photography captured with a physical full-frame camera. The object must have manufacturable construction, physically plausible weight, real material texture, natural reflections, contact shadow, and photographic lens response. ABSOLUTELY NO anime, manga, donghua, illustration, 2D or 2.5D art, cel shading, digital painting, game-item concept art, 3D CG render, icon art, or plastic toy look',
}

const GENERATED_PROMPT_MARKERS: Record<AssetPromptKind, string[]> = {
  character: ['角色设定参考图', 'character reference sheet', 'casting reference sheet'],
  scene: ['固定机位广角镜头', '固定机位', 'establishing shot'],
  prop: ['单品产品图', 'single product photo', 'product photography'],
}

function stripGeneratedStylePrefix(prompt: string, stylePrompt: string, kind: AssetPromptKind): string {
  const content = prompt.trim()
  if (!content) return ''
  if (stylePrompt && content.startsWith(stylePrompt)) {
    return content.slice(stylePrompt.length).replace(/^[\s,，。;；:：-]+/, '').trim()
  }
  if (!LIVE_ACTION_STYLE.test(stylePrompt)) return content

  const indexes = GENERATED_PROMPT_MARKERS[kind]
    .map(marker => content.toLowerCase().indexOf(marker.toLowerCase()))
    .filter(index => index >= 0)
  const firstMarker = indexes.length ? Math.min(...indexes) : -1
  const leadingText = firstMarker > 0 ? content.slice(0, firstMarker) : ''
  const looksLikePersistedStyle = /photorealistic|live-action|animation|anime|manga|donghua|illustration|2\.5d|3d\s+(?:cg|render)|cinematic\s+(?:render|style)/i.test(leadingText)
  return firstMarker > 0 && looksLikePersistedStyle ? content.slice(firstMarker).trim() : content
}

/**
 * Apply the project's current style at request time. Persisted final prompts may
 * predate a style change, so they must never override the current project style.
 */
export function composeAssetGenerationPrompt(
  stylePrompt: string,
  assetPrompt: string,
  kind: AssetPromptKind,
): string {
  const content = stripGeneratedStylePrefix(assetPrompt, stylePrompt, kind)
  const guard = LIVE_ACTION_STYLE.test(stylePrompt) ? LIVE_ACTION_ASSET_GUARDS[kind] : ''
  return [stylePrompt.trim(), guard, content].filter(Boolean).join(', ')
}

/** Apply the same current-style contract to every video provider request. */
export function composeVideoGenerationPrompt(stylePrompt: string, videoPrompt: string): string {
  const style = stylePrompt.trim()
  const content = videoPrompt.trim()
  if (!style) return content
  const guard = LIVE_ACTION_STYLE.test(style)
    ? 'STRICT LIVE-ACTION VIDEO MEDIUM: every frame must look physically filmed with real human actors, practical costumes and sets, natural skin texture, realistic motion, physically plausible lighting, and cinematic lens response. Do not convert any reference into anime, manga, donghua, illustration, 2D or 2.5D art, cel shading, digital painting, game cinematics, 3D CG characters, doll-like faces, or plastic skin'
    : ''
  const withoutDuplicateStyle = content.startsWith(style)
    ? content.slice(style.length).replace(/^[\s,，。;；:：-]+/, '').trim()
    : content
  return [style, guard, withoutDuplicateStyle].filter(Boolean).join(',\n')
}
