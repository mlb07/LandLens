import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/data/parcelProvider.ts', import.meta.url), 'utf8')
const matches = [...source.matchAll(/adapter\(\s*['"]([^'"]+)['"]\s*,\s*['"]([A-Z]{2})['"]\s*,\s*['"]([^'"]+)['"]/g)]
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : undefined
const adapters = matches.map((match, index) => ({
  id: match[1],
  stateCode: match[2],
  url: match[3],
  body: source.slice(match.index, matches[index + 1]?.index ?? source.indexOf('const parcelCache')),
})).filter((adapter) => !/facts\s*:/.test(adapter.body) && (!filter || filter.test(`${adapter.id} ${adapter.stateCode}`)))

const useful = /(addr|address|situs|physical|location|municip|city|county|juris|use|class|zone|zoning|legal|sub|plat|market|apprais|assess|taxable|value|val|sale|sold|deed|year|built|bldg|build|structure|living|area|sqft|square|front|depth|water|sewer|util|access|acre|crop|farm|forest|graz|irrig|record|website|url|link|emv|land|impr|total)/i
const privateField = /(owner|mail|taxpayer|grantor|grantee|person|phone|email|occupant)/i

async function schema(adapter) {
  const response = await fetch(`${adapter.url}?f=json`, { signal: AbortSignal.timeout(20_000) })
  const text = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`)
  const data = JSON.parse(text)
  if (data.error) throw new Error(data.error.message || 'ArcGIS schema error')
  const fields = (data.fields || []).filter((field) => useful.test(`${field.name} ${field.alias || ''}`) && !privateField.test(`${field.name} ${field.alias || ''}`))
  return { ...adapter, fields }
}

const results = []
for (let index = 0; index < adapters.length; index += 6) {
  const group = adapters.slice(index, index + 6)
  results.push(...await Promise.all(group.map(async (adapter) => {
    try { return await schema(adapter) } catch (error) { return { ...adapter, error: error instanceof Error ? error.message : String(error), fields: [] } }
  })))
}

for (const result of results) {
  console.log(`\n## ${result.id} (${result.stateCode})${result.error ? ` ERROR ${result.error}` : ''}`)
  for (const field of result.fields) console.log(`${field.name}\t${field.alias || ''}\t${field.type || ''}`)
}

console.log(`\nAudited ${results.length} unenriched adapters.`)
