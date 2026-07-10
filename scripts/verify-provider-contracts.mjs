const point = '-97.7431,30.2672'
const checks = [
  ['FEMA NFHL', `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['USGS elevation', 'https://epqs.nationalmap.gov/v1/json?x=-97.7431&y=30.2672&units=Meters&wkid=4326', (data) => Number.isFinite(Number(data.value ?? data.elevation))],
  ['Austin zoning', `https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=ZONING_ZTYPE,ZONING_BASE&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['Austin Energy service area', `https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/1/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SERVICE_AREA&returnGeometry=false`, (data) => Array.isArray(data.features)],
]

let failed = 0
for (const [name, url, validate] of checks) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    const data = await response.json()
    if (!response.ok || data.error || !validate(data)) throw new Error(data.error?.message || `Unexpected ${response.status} response shape`)
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
if (failed) process.exitCode = 1
