export const VIRTUAL_ASSET_API_BASE = 'https://api.mjing.cc'

type FetchLike = typeof fetch

export interface VirtualAssetRecord {
  id?: string | number
  provider_asset_id?: string
  asset_uri?: string
  name?: string
  asset_type?: string
  url?: string
  provider_url?: string
  status?: string
}

export interface VirtualAssetGroupRecord {
  id?: string | number
  provider_group_id?: string
  name?: string
  description?: string
  status?: string
}

function unwrapData<T>(value: any): T {
  return (value?.data && typeof value.data === 'object' ? value.data : value) as T
}

function providerError(payload: any, fallback: string): string {
  return String(payload?.error?.message || payload?.error || payload?.message || payload?.msg || fallback)
}

export class VirtualAssetClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = VIRTUAL_ASSET_API_BASE,
  ) {}

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 180_000)
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/+$/, '')}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      })
      const text = await response.text()
      let payload: any = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = null }
      if (!response.ok) {
        throw new Error(providerError(payload, `HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`))
      }
      return unwrapData<T>(payload)
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw new Error('虚拟资产服务请求超时')
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  createGroup(input: { name: string; description: string; project_name: string }) {
    return this.request<VirtualAssetGroupRecord>('/v1/assets/groups', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  createAsset(input: {
    group_id: string
    url: string
    name: string
    asset_type: string
    project_name: string
    wait_for_active: boolean
  }) {
    return this.request<VirtualAssetRecord>('/v1/assets', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  getAsset(id: string) {
    return this.request<VirtualAssetRecord>(`/v1/assets/${encodeURIComponent(id)}`, { method: 'GET' })
  }

  refreshAsset(id: string) {
    return this.request<VirtualAssetRecord>(`/v1/assets/${encodeURIComponent(id)}/refresh`, { method: 'POST' })
  }
}
