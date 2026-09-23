export const VIDEO_ASSET_REFERENCE_MODES = ['uri', 'url'] as const

export type VideoAssetReferenceMode = typeof VIDEO_ASSET_REFERENCE_MODES[number]

export function isVideoAssetReferenceMode(value: unknown): value is VideoAssetReferenceMode {
  return typeof value === 'string'
    && (VIDEO_ASSET_REFERENCE_MODES as readonly string[]).includes(value)
}

export function normalizeVideoAssetReferenceMode(value: unknown): VideoAssetReferenceMode {
  return value === 'url' ? 'url' : 'uri'
}

export async function resolveSdReferenceImages<T>(
  mode: unknown,
  resolveUris: () => Promise<T>,
  resolveUrls: () => Promise<T>,
): Promise<T> {
  return normalizeVideoAssetReferenceMode(mode) === 'url'
    ? resolveUrls()
    : resolveUris()
}
