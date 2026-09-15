export function joinProviderUrl(baseUrl: string, requiredPrefix: string, path: string) {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  const normalizedPrefix = normalizeSegment(requiredPrefix)
  const normalizedPath = normalizeSegment(path)

  if (!normalizedBase) {
    return `${normalizedPrefix}${normalizedPath}`
  }

  try {
    const url = new URL(normalizedBase)
    const currentPath = url.pathname.replace(/\/+$/, '')
    const mergedPrefix = currentPath.endsWith(normalizedPrefix)
      ? currentPath
      : `${currentPath}${normalizedPrefix}`

    url.pathname = `${mergedPrefix}${normalizedPath}`.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    const basePath = normalizedBase.endsWith(normalizedPrefix)
      ? normalizedBase
      : `${normalizedBase}${normalizedPrefix}`
    return `${basePath}${normalizedPath}`
  }
}

export function joinConfiguredEndpoint(baseUrl: string, endpoint: string) {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '')
  const normalizedEndpoint = normalizeSegment(endpoint)

  if (/^https?:\/\//i.test(endpoint)) return endpoint
  if (!normalizedBase) return normalizedEndpoint

  try {
    const url = new URL(normalizedBase)
    const currentPath = url.pathname.replace(/\/+$/, '')
    url.pathname = currentPath && (normalizedEndpoint === currentPath || normalizedEndpoint.startsWith(`${currentPath}/`))
      ? normalizedEndpoint
      : `${currentPath}${normalizedEndpoint}`.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    return normalizedBase.endsWith(normalizedEndpoint)
      ? normalizedBase
      : `${normalizedBase}${normalizedEndpoint}`
  }
}

function normalizeSegment(segment: string) {
  if (!segment) return ''
  return segment.startsWith('/') ? segment : `/${segment}`
}
