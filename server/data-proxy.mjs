import { createServer } from 'node:http'

const port = Number(process.env.PORT || 8787)
const ttlMs = Number(process.env.LANDLENS_CACHE_TTL_MS || 300_000)
const maxCacheEntries = Number(process.env.LANDLENS_CACHE_MAX_ENTRIES || 1_000)
const allowedOrigin = process.env.LANDLENS_ALLOWED_ORIGIN || 'http://localhost:5173'
const cache = new Map()
const clients = new Map()

// The proxy is deliberately an allow-list, never an open URL fetcher. Add a
// provider only when it is an intentional LandLens data source.
const allowedHosts = [
  /(^|\.)arcgis\.com$/i, /(^|\.)gov$/i, /(^|\.)usgs\.gov$/i,
  /(^|\.)usda\.gov$/i, /(^|\.)census\.gov$/i, /(^|\.)openstreetmap\.org$/i,
  /(^|\.)austintexas\.gov$/i, /(^|\.)lojic\.org$/i, /(^|\.)bcad\.org$/i,
  /(^|\.)miottawa\.org$/i, /(^|\.)minnehahacounty\.gov$/i,
  /(^|\.)nconemap\.gov$/i, /(^|\.)wvgis\.wvu\.edu$/i,
  /(^|\.)vdem\.virginia\.gov$/i, /(^|\.)nhgeodata\.unh\.edu$/i,
  /(^|\.)risegis\.ri\.gov$/i, /(^|\.)statelands\.wyo\.gov$/i,
  /(^|\.)taxmaps\.traviscountytx\.gov$/i, /(^|\.)gis\.colorado\.gov$/i,
  /(^|\.)gis\.ne\.gov$/i, /(^|\.)mapd\.kcmo\.org$/i, /(^|\.)maps\.brla\.gov$/i,
  /(^|\.)maps\.bcad\.org$/i, /(^|\.)gis\.odf\.oregon\.gov$/i,
  /(^|\.)epqs\.nationalmap\.gov$/i, /(^|\.)sdmdataaccess\.nrcs\.usda\.gov$/i,
]

function setCors(req, res) {
  const origin = req.headers.origin
  if (origin && (allowedOrigin === '*' || origin === allowedOrigin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept-Language')
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 200_000) reject(new Error('Request body exceeds 200 KB'))
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function allowRequest(req) {
  const now = Date.now()
  const key = req.socket.remoteAddress || 'unknown'
  const entry = clients.get(key) || { startedAt: now, count: 0 }
  if (now - entry.startedAt > 60_000) Object.assign(entry, { startedAt: now, count: 0 })
  entry.count += 1
  clients.set(key, entry)
  return entry.count <= 120
}

function targetFrom(req) {
  const target = new URL(req.url, `http://${req.headers.host}`).searchParams.get('url')
  if (!target || target.length > 4_096) throw new Error('A valid source URL is required')
  const parsed = new URL(target)
  if (parsed.protocol !== 'https:' || !allowedHosts.some((rule) => rule.test(parsed.hostname))) {
    throw new Error('Source host is not allowed')
  }
  return parsed
}

createServer(async (req, res) => {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  if (req.url?.startsWith('/health')) return send(res, 200, { ok: true, cacheEntries: cache.size })
  if (!req.url?.startsWith('/api/data')) return send(res, 404, { error: 'Not found' })
  if (!['GET', 'POST'].includes(req.method || '')) return send(res, 405, { error: 'Method not allowed' })
  if (!allowRequest(req)) return send(res, 429, { error: 'Rate limit exceeded; retry in one minute' })

  try {
    const target = targetFrom(req)
    const body = req.method === 'POST' ? await readBody(req) : ''
    const cacheKey = `${req.method}:${target}:${body}`
    const hit = cache.get(cacheKey)
    if (hit && hit.expiresAt > Date.now()) return send(res, 200, hit.data, { 'X-LandLens-Cache': 'HIT' })

    const response = await fetch(target, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        ...(req.headers['accept-language'] ? { 'Accept-Language': req.headers['accept-language'] } : {}),
        ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(req.method === 'POST' ? { body } : {}),
      signal: AbortSignal.timeout(25_000),
    })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { throw new Error('Provider did not return JSON') }
    if (!response.ok) return send(res, response.status, data)
    cache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs })
    while (cache.size > maxCacheEntries) cache.delete(cache.keys().next().value)
    return send(res, 200, data, { 'X-LandLens-Cache': 'MISS' })
  } catch (error) {
    return send(res, 400, { error: error instanceof Error ? error.message : 'Proxy request failed' })
  }
}).listen(port, () => console.log(`LandLens data proxy listening on :${port}`))
