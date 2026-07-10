const point = '-97.7431,30.2672'
const checks = [
  ['FEMA NFHL', `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['USGS elevation', 'https://epqs.nationalmap.gov/v1/json?x=-97.7431&y=30.2672&units=Meters&wkid=4326', (data) => Number.isFinite(Number(data.value ?? data.elevation))],
  ['Austin zoning', `https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=ZONING_ZTYPE,ZONING_BASE&returnGeometry=false`, (data) => Array.isArray(data.features)],
  ['Austin jurisdiction', `https://maps.austintexas.gov/arcgis/rest/services/Shared/JurisdictionsFill/MapServer/0/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=CITY_NAME,JURISDICTION_LABEL,JURISDICTION_TYPE&returnGeometry=false`, (data) => Array.isArray(data.features) && (data.features.length === 0 || ['CITY_NAME', 'JURISDICTION_TYPE'].every((field) => field in (data.features[0].attributes || {})))],
  ['Austin future land use', `https://maps.austintexas.gov/arcgis/rest/services/PropertyProfile/LongRangePlanning/MapServer/4/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&returnDomainNames=true`, (data) => Array.isArray(data.features)],
  ['Austin zoning overlays', `https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/identify?f=json&geometry=${point}&geometryType=esriGeometryPoint&sr=4326&tolerance=1&mapExtent=-97.7451,30.2652,-97.7411,30.2692&imageDisplay=800,600,96&returnGeometry=false&layers=all:0,2,3,4,11,14,16,17,18,19,21,22,26,28,29,31,33`, (data) => Array.isArray(data.results)],
  ['Austin Energy service area', `https://maps.austintexas.gov/arcgis/rest/services/Shared/BoundariesGrids_2/MapServer/1/query?f=json&geometry=${point}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SERVICE_AREA&returnGeometry=false`, (data) => Array.isArray(data.features)],
]

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
