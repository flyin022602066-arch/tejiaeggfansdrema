import { eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { now } from '../utils/response.js'
import { getEggfansVirtualAssetKey } from './app-settings.js'
import { uploadFileToImageHost } from './image-host.js'
import { VirtualAssetClient, type VirtualAssetRecord } from './virtual-asset-client.js'
export { VIRTUAL_ASSET_API_BASE } from './virtual-asset-client.js'

const groupPromises = new Map<number, Promise<string>>()
// 谜镜 Gateway 会把 project_name 透传给火山资产服务；当前账户的可用
// 项目名是 `default`，本地剧名不是远端 ProjectName，不能直接透传。
const PROVIDER_PROJECT_NAME = 'default'

function virtualAssetClient(): VirtualAssetClient {
  const key = getEggfansVirtualAssetKey()
  if (!key) throw new Error('未配置虚拟资产 API Key，请先到「设置 > AI 服务」填写')
  return new VirtualAssetClient(key)
}

function reusablePublicUrl(value: string): boolean {
  return /^https:\/\//i.test(value) && /(?:uguu\.se|imageproxy\.zhongzhuan\.chat)/i.test(value)
}

async function ensureGroup(drama: typeof schema.dramas.$inferSelect, client: VirtualAssetClient): Promise<string> {
  const cached = String(drama.virtualAssetGroupId || '').trim()
  if (cached) return cached

  const pending = groupPromises.get(drama.id)
  if (pending) return pending

  const promise = (async () => {
    const group = await client.createGroup({
      name: drama.title,
      description: `Eggfans project character assets for drama ${drama.id}`,
      project_name: PROVIDER_PROJECT_NAME,
    })
    const groupId = String(group.id || '').trim()
    if (!groupId) throw new Error('虚拟资产服务创建项目资产组后未返回 data.id')
    await db.update(schema.dramas)
      .set({ virtualAssetGroupId: groupId, updatedAt: now() })
      .where(eq(schema.dramas.id, drama.id))
    return groupId
  })()
  groupPromises.set(drama.id, promise)
  try {
    return await promise
  } finally {
    groupPromises.delete(drama.id)
  }
}

async function resolveActiveAsset(client: VirtualAssetClient, asset: VirtualAssetRecord): Promise<VirtualAssetRecord> {
  if (asset.asset_uri) return asset
  const id = String(asset.id || '').trim()
  if (!id) throw new Error('虚拟资产服务未返回 data.id 或 data.asset_uri')

  let current = await client.refreshAsset(id)
  if (current.asset_uri) return current
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 3000))
    current = await client.getAsset(id)
    if (current.asset_uri) return current
    const status = String(current.status || '').toLowerCase()
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(`虚拟资产创建失败，状态：${current.status}`)
    }
  }
  throw new Error('虚拟资产创建超时，未取回 asset_uri')
}

export async function ensureCharacterVirtualAssetUri(characterId: number): Promise<VirtualAssetRecord> {
  const [character] = await db.select().from(schema.characters).where(eq(schema.characters.id, characterId))
  if (!character || character.deletedAt) throw new Error('角色资产不存在')
  const [drama] = await db.select().from(schema.dramas).where(eq(schema.dramas.id, character.dramaId))
  if (!drama || drama.deletedAt) throw new Error('角色所属项目不存在')

  let sourceUrl = String(character.publicUrl || character.imageUrl || character.localPath || '').trim()
  if (!sourceUrl) throw new Error(`角色「${character.name}」尚无资产图片`)
  if (!reusablePublicUrl(sourceUrl)) {
    sourceUrl = (await uploadFileToImageHost(sourceUrl, 'image/png')).url
    await db.update(schema.characters)
      .set({ publicUrl: sourceUrl, updatedAt: now() })
      .where(eq(schema.characters.id, character.id))
  }

  const savedUri = String(character.virtualAssetUri || '').trim()
  if (savedUri && String(character.virtualAssetSourceUrl || '').trim() === sourceUrl) {
    return {
      id: character.virtualAssetId || undefined,
      asset_uri: savedUri,
      status: character.virtualAssetStatus || 'active',
      url: sourceUrl,
      name: character.name,
      asset_type: 'Image',
    }
  }

  const client = virtualAssetClient()
  const groupId = await ensureGroup(drama, client)
  const created = await client.createAsset({
    group_id: groupId,
    url: sourceUrl,
    name: character.name,
    asset_type: 'Image',
    project_name: PROVIDER_PROJECT_NAME,
    wait_for_active: true,
  })
  const active = await resolveActiveAsset(client, created)
  const uri = String(active.asset_uri || '').trim()
  if (!uri) throw new Error('虚拟资产服务未返回 data.asset_uri')

  await db.update(schema.characters).set({
    virtualAssetId: String(active.id || created.id || ''),
    virtualAssetUri: uri,
    virtualAssetSourceUrl: sourceUrl,
    virtualAssetStatus: String(active.status || 'active'),
    updatedAt: now(),
  }).where(eq(schema.characters.id, character.id))
  return { ...active, asset_uri: uri, url: sourceUrl }
}

function referenceCandidates(character: typeof schema.characters.$inferSelect): string[] {
  return [character.publicUrl, character.imageUrl, character.localPath]
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

export async function mapStoryboardCharacterReferencesToUris(
  storyboardId: number | null | undefined,
  refs: string[],
  normalizeNonCharacter: (value: string) => Promise<string | null>,
): Promise<string[]> {
  if (!storyboardId || !refs.length) {
    const normalized: string[] = []
    for (const ref of refs) {
      const value = await normalizeNonCharacter(ref)
      if (value) normalized.push(value)
    }
    return normalized
  }

  const links = await db.select().from(schema.storyboardCharacters)
    .where(eq(schema.storyboardCharacters.storyboardId, storyboardId))
  const characters = []
  for (const link of links) {
    const [character] = await db.select().from(schema.characters)
      .where(eq(schema.characters.id, link.characterId))
    if (character && !character.deletedAt) characters.push(character)
  }

  const byReference = new Map<string, typeof schema.characters.$inferSelect>()
  for (const character of characters) {
    for (const value of referenceCandidates(character)) byReference.set(value, character)
  }

  const result: string[] = []
  for (const ref of refs) {
    const character = byReference.get(String(ref || '').trim())
    if (character) {
      const asset = await ensureCharacterVirtualAssetUri(character.id)
      result.push(String(asset.asset_uri))
    } else {
      const normalized = await normalizeNonCharacter(ref)
      if (normalized) result.push(normalized)
    }
  }
  return result
}
