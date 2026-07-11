import { readFileSync } from 'node:fs'

const point = '-97.7431,30.2672'
const checks = [
  ['FEMA NFHL', `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['USGS elevation', 'https://epqs.nationalmap.gov/v1/json?x=-97.7431&y=30.2672&units=Meters&wkid=4326', (data) => Number.isFinite(Number(data.value ?? data.elevation))],
  ['Census authority resolver', 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=-97.7431&y=30.2672&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json', (data) => Boolean(data.result?.geographies?.Counties?.[0])],
  ['Austin zoning', `https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=ZONING_ZTYPE,ZONING_BASE&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['Austin jurisdiction', `https://maps.austintexas.gov/arcgis/rest/services/Shared/JurisdictionsFill/MapServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=CITY_NAME,JURISDICTION_LABEL,JURISDICTION_TYPE&returnGeometry=false`, (data) => Array.isArray(data.features) && (data.features.length === 0 || ['CITY_NAME', 'JURISDICTION_TYPE'].every((field) => field in (data.features[0].attributes || {})))],
  ['Austin future land use', `https://maps.austintexas.gov/arcgis/rest/services/PropertyProfile/LongRangePlanning/MapServer/4/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&returnDomainNames=true`, (data) => Array.isArray(data.features)],
  ['Austin zoning overlays', `https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/identify?f=json&geometry=${point}&geometryType=esriGeometryPoint&sr=4326&tolerance=1&mapExtent=-97.7451,30.2652,-97.7411,30.2692&imageDisplay=800,600,96&returnGeometry=false&layers=all:0,2,3,4,11,14,16,17,18,19,21,22,26,28,29,31,33`, (data) => Array.isArray(data.results)],
  ['Austin Energy service area', `https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/1/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SERVICE_AREA&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['EPA water service areas v3', `https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Water_System_Boundaries/FeatureServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=PWSID,PWS_Name,Data_Provider_Type,Model_Method&returnGeometry=false`, (data) => Array.isArray(data.features) && data.features.length > 0 && ['PWSID', 'PWS_Name'].every((field) => field in data.features[0].attributes)],
  ['EPA national sewersheds', `https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/National_Sewershed_Web_Map_Internal_WFL1/FeatureServer/8/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=CWNS_ID,FACILITY_NAME,Method,NPDES_ID&returnGeometry=false`, (data) => Array.isArray(data.features) && data.features.length > 0 && ['CWNS_ID', 'Method'].every((field) => field in data.features[0].attributes)],
  ['USGS PAD-US protection status', `https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/PADUS_Protection_Status_by_GAP_Status_Code/FeatureServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Category,FeatClass,Unit_Nm,GAP_Sts&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['BTS national rail network', `https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=5000&units=esriSRUnit_Meter&outFields=RROWNER1,TRACKS,PASSNGR,STRACNET&returnGeometry=false&resultRecordCount=5`, (data) => Array.isArray(data.features) && data.features.length > 0 && 'RROWNER1' in data.features[0].attributes],
  ['Houston jurisdiction', 'https://mycity2.houstontx.gov/pubgis02/rest/services/HoustonMap/Administrative_Boundary/MapServer/0/query?f=json&geometry=-95.3698,29.7604&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SERVICE_TY,COMMENTS,ANNEXATION&returnGeometry=false', (data) => Array.isArray(data.features) && data.features.length > 0 && data.features[0].attributes.SERVICE_TY === 'FULL'],
  ['Houston minimum-lot controls', 'https://geogimstest.houstontx.gov/arcgis/rest/services/DIR/ReferenceAndBoundaries_gx/MapServer/16?f=json', (data) => ['APP_NO_', 'ORDINANCE', 'LOTSIZE'].every((field) => (data.fields || []).some((item) => item.name === field))],
  ['Houston building-line controls', 'https://geogimstest.houstontx.gov/arcgis/rest/services/DIR/ReferenceAndBoundaries_gx/MapServer/17?f=json', (data) => ['APPLICATIO', 'BLD__LINE', 'ORDINANCE_'].every((field) => (data.fields || []).some((item) => item.name === field))],
  ['Houston historic controls', 'https://geogimstest.houstontx.gov/arcgis/rest/services/DIR/ReferenceAndBoundaries_gx/MapServer/18?f=json', (data) => ['NAME', 'HISTORIC', 'DATE_EST'].every((field) => (data.fields || []).some((item) => item.name === field))],
  ['Charlotte zoning', 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0/query?f=json&geometry=-80.8431,35.2271&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=ZoneDes,ZoneClass,Overlay,ZonePetition,SPA,Hyperlink&returnGeometry=false&returnDomainNames=true', (data) => Array.isArray(data.features) && data.features.length > 0 && ['ZoneDes', 'ZoneClass', 'Overlay'].every((field) => field in data.features[0].attributes)],
  ['Dallas zoning and overlays', 'https://egis.dallascityhall.com/arcgis/rest/services/Sdc_public/Zoning/MapServer/identify?f=json&geometry=-96.7970,32.7767&geometryType=esriGeometryPoint&sr=4326&tolerance=1&mapExtent=-96.7990,32.7747,-96.7950,32.7787&imageDisplay=800,600,96&returnGeometry=false&returnFieldName=true&layers=all:15,0,2,4,5,7,8,9,12,14,16,17,18,19', (data) => Array.isArray(data.results) && data.results.some((result) => result.layerId === 15 && ('ZONE_DIST' in result.attributes || 'LONG_ZONE_DIST' in result.attributes))],
]

const newStateParcelPoints = [
  ['California Sonoma parcel point', 'https://socogis.sonomacounty.ca.gov/map/rest/services/AGCOMMPublic/Sonoma_County_Parcels/FeatureServer/0', '-122.7144,38.4405'],
  ['Kansas Wyandotte parcel point', 'https://gisweb.wycokck.org/arcgis/rest/services/UGMAPS/UGMAPS_4_V02_Parcels/MapServer/7', '-94.6275,39.1141'],
  ['Mississippi statewide parcel point', 'https://mgis19.mdeq.ms.gov/arcgis/rest/services/GeologyParcelAndFloodGIS/Parcels_Statewide_2023/FeatureServer/3', '-90.1848,32.2988'],
]

for (const [name, url, geometry] of newStateParcelPoints) {
  checks.push([name, `${url}/query?f=json&geometry=${geometry}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnIdsOnly=true`, (data) => Array.isArray(data.objectIds) && data.objectIds.length > 0])
}

const parcelSchemas = [
  ['Travis County parcel facts', 'https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/FeatureServer/0', ['PROP_ID', 'situs_address', 'tcad_acres', 'land_type_desc', 'market_value', 'appraised_val', 'assessed_val', 'legal_desc']],
  ['Dallas County parcel facts', 'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/CRMHostedLayers/FeatureServer/13', ['GIS_ACCT', 'AREA_FEET', 'PROP_CL', 'LEGAL_1', 'CITY', 'COUNTY', 'APPRAISALYEAR', 'Website']],
  ['Harris County parcel facts', 'https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/Harris_County_Parcels/FeatureServer/1', ['HCAD_NUM', 'Acreage', 'land_use', 'land_value', 'impr_value', 'total_appraised_val', 'total_market_val', 'tax_year']],
  ['Bexar County parcel facts', 'https://maps.bcad.org/arcgis/rest/services/PAMapSearch/MapServer/6', ['PAMaps.dbo.web_map_property.pacs_prop_id', 'PAMaps.dbo.web_map_property.prop_type_desc', 'PAMaps.dbo.web_map_property.appraised_val', 'PAMaps.dbo.web_map_property.legal_desc', 'PAMaps.dbo.web_map_property.situs']],
  ['Collin County parcel facts', 'https://services2.arcgis.com/uXyoacYrZTPTKD3R/arcgis/rest/services/CCAD_Parcel_Feature_Set/FeatureServer/4', ['geoID', 'situsConcat', 'propUseCode', 'legalDescription', 'currValMarket', 'currValAppraised', 'imprvYearBuilt', 'landAgAcres']],
  ['Williamson County parcel facts', 'https://services1.arcgis.com/Xff0bbfp6vwIWmlU/arcgis/rest/services/WCAD_Tax_Parcels/FeatureServer/0', ['PARCELID', 'SITEADDRESS', 'USEDSCRP', 'CLASSDSCRP', 'LNDVALUE', 'CNTASSDVAL', 'WATERSERV', 'SEWERSERV']],
  ['Montgomery County parcel facts', 'https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/Tax_Parcel_view/FeatureServer/0', ['PIN', 'situs', 'stateCd', 'legalDescription', 'imprvActualYearBuilt', 'imprvMainArea', 'pYear']],
  ['Tarrant County parcel facts', 'https://services3.arcgis.com/9GbPfrQRyZbRsXU4/arcgis/rest/services/Basemap_Layer/FeatureServer/113', ['TAXPIN', 'Situs_Addr', 'Property_C', 'State_Use_', 'LegalDescr', 'Land_Value', 'Total_Valu', 'Year_Built', 'Living_Are']],
  ['Florida statewide parcel facts', 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0', ['PARCEL_ID', 'DOR_UC', 'JV', 'LND_VAL', 'SALE_PRC1', 'SALE_YR1', 'ACT_YR_BLT', 'TOT_LVG_AR']],
  ['Connecticut statewide parcel facts', 'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0', ['Parcel_ID', 'Zone', 'State_Use_Description', 'Assessed_Total', 'Appraised_Land', 'Sale_Price', 'Sale_Date', 'Living_Area']],
  ['Montana statewide parcel facts', 'https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1', ['PARCELID', 'PropType', 'LegalDescriptionShort', 'TotalValue', 'TotalLandValue', 'TotalBuildingValue', 'ForestAcres', 'GrazingAcres']],
  ['New York statewide parcel facts', 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1', ['SWIS_PRINT_KEY_ID', 'PROP_CLASS', 'FULL_MARKET_VAL', 'TOTAL_AV', 'LAND_AV', 'FRONT', 'DEPTH', 'WATER_DESC', 'SEWER_DESC', 'SQFT_LIVING']],
]

for (const [name, url, requiredFields] of parcelSchemas) {
  checks.push([name, `${url}?f=json`, (data) => {
    const fields = new Set((data.fields || []).map((field) => field.name))
    return requiredFields.every((field) => fields.has(field))
  }])
}

const parcelProviderSource = readFileSync(new URL('../src/data/parcelProvider.ts', import.meta.url), 'utf8')
const auditedFactMappings = JSON.parse(readFileSync(new URL('../src/data/parcelFactMappings.json', import.meta.url), 'utf8'))
const adapterUrls = new Map([...parcelProviderSource.matchAll(/adapter\(\s*['"]([^'"]+)['"]\s*,\s*['"][A-Z]{2}['"]\s*,\s*['"]([^'"]+)['"]/g)].map((match) => [match[1], match[2]]))
if (adapterUrls.size !== 58) throw new Error(`Expected 58 registered parcel adapters, found ${adapterUrls.size}.`)
if (Object.keys(auditedFactMappings).length !== 46) throw new Error(`Expected 46 audited fact mappings, found ${Object.keys(auditedFactMappings).length}.`)

function mappingFields(mapping) {
  const fields = new Set()
  for (const rule of Object.values(mapping)) {
    if (Array.isArray(rule)) rule.forEach((field) => fields.add(field))
    else if (rule && typeof rule === 'object') (rule.join || rule.sum || []).forEach((field) => fields.add(field))
  }
  return [...fields]
}

for (const [id, mapping] of Object.entries(auditedFactMappings)) {
  const url = adapterUrls.get(id)
  if (!url) throw new Error(`Audited parcel mapping ${id} has no registered adapter.`)
  const requiredFields = mappingFields(mapping)
  checks.push([`${id} audited schema`, `${url}?f=json`, (data) => {
    const fields = new Set((data.fields || []).map((field) => field.name))
    return Array.isArray(data.fields) && requiredFields.every((field) => fields.has(field))
  }])
}

let failed = 0
async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError = new Error('Provider request failed')
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
      const contentType = response.headers.get('content-type') || ''
      const body = await response.text()
      if (!response.ok) throw new Error(`HTTP ${response.status}${body.trim() ? `: ${body.trim().slice(0, 160)}` : ''}`)
      if (!/json/i.test(contentType) && !/^[\s]*[\[{]/.test(body)) throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}: ${body.trim().slice(0, 160)}`)
      return { response, data: JSON.parse(body) }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }
  }
  throw lastError
}

let cursor = 0
async function worker() {
  while (cursor < checks.length) {
    const [name, url, validate] = checks[cursor]
    cursor += 1
    try {
      const { response, data } = await fetchJsonWithRetry(url)
      if (!response.ok || data.error || !validate(data)) throw new Error(data.error?.message || `Unexpected ${response.status} response shape`)
      console.log(`PASS ${name}`)
    } catch (error) {
      failed += 1
      console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
await Promise.all(Array.from({ length: 6 }, () => worker()))
console.log(`Verified ${checks.length - failed}/${checks.length} live provider contracts.`)
if (failed) process.exitCode = 1
