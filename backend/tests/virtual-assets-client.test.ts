import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VirtualAssetClient, VIRTUAL_ASSET_API_BASE } from '../src/services/virtual-asset-client.js'

function mockFetch(responseBody: unknown, calls: Array<{ url: string; init: RequestInit }>): typeof fetch {
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
}

test('creates one project asset group using the documented contract', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const client = new VirtualAssetClient('sk-virtual', mockFetch({ data: { id: 42, provider_group_id: 'group-provider' } }, calls))
  const result = await client.createGroup({
    name: 'Test drama',
    description: 'Character assets',
    project_name: 'Test drama',
  })

  assert.equal(result.id, 42)
  assert.equal(calls[0].url, `${VIRTUAL_ASSET_API_BASE}/v1/assets/groups`)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer sk-virtual')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    name: 'Test drama',
    description: 'Character assets',
    project_name: 'Test drama',
  })
})

test('creates a character image asset and preserves the returned URI', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const client = new VirtualAssetClient('sk-virtual', mockFetch({
    data: {
      id: 77,
      asset_uri: 'asset://characters/77',
      status: 'active',
    },
  }, calls))
  const result = await client.createAsset({
    group_id: '42',
    url: 'https://uguu.se/character.png',
    name: 'Hero',
    asset_type: 'image',
    project_name: 'Test drama',
    wait_for_active: true,
  })

  assert.equal(result.asset_uri, 'asset://characters/77')
  assert.equal(calls[0].url, `${VIRTUAL_ASSET_API_BASE}/v1/assets`)
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    group_id: '42',
    url: 'https://uguu.se/character.png',
    name: 'Hero',
    asset_type: 'image',
    project_name: 'Test drama',
    wait_for_active: true,
  })
})

test('uses provider-compatible project and asset type values', () => {
  const source = readFileSync(new URL('../src/services/virtual-assets.ts', import.meta.url), 'utf8')
  assert.match(source, /PROVIDER_PROJECT_NAME = 'default'/)
  assert.match(source, /asset_type: 'Image'/)
})

test('refreshes an asset with POST and no invented request body', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const client = new VirtualAssetClient('sk-virtual', mockFetch({ data: { id: 77, asset_uri: 'asset://characters/77' } }, calls))
  await client.refreshAsset('asset/id')

  assert.equal(calls[0].url, `${VIRTUAL_ASSET_API_BASE}/v1/assets/asset%2Fid/refresh`)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.body, undefined)
})
