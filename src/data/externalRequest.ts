/**
 * One boundary for requests to third-party data providers.
 *
 * Set VITE_DATA_PROXY_URL to a same-origin (or CORS-enabled) proxy endpoint in
 * production. Leaving it unset preserves the direct browser behavior needed
 * for local development and static demos.
 */
export function externalRequest(url: string, init?: RequestInit): Promise<Response> {
  const proxyUrl = import.meta.env.VITE_DATA_PROXY_URL as string | undefined
  if (!proxyUrl) return fetch(url, init)

  const separator = proxyUrl.includes('?') ? '&' : '?'
  return fetch(`${proxyUrl}${separator}url=${encodeURIComponent(url)}`, init)
}
