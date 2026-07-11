import type { Coordinates, DataProvenance, ParcelSelection, ScreeningArea } from '../types/site'
import { externalRequest } from './externalRequest'
import { getParcelFactFieldNames, normalizeParcelFacts, type ParcelFactsFieldMap } from './parcelFacts'
import parcelFactMappingsJson from './parcelFactMappings.json'

const PARCEL_FACT_MAPPINGS = parcelFactMappingsJson as Record<string, ParcelFactsFieldMap>

interface GeoJsonFeature {
  type: 'Feature'
  geometry?: ScreeningArea['boundary']
  properties?: Record<string, string | number | null>
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features?: GeoJsonFeature[]
  error?: { message?: string }
}

interface ObjectIdResponse {
  objectIdFieldName?: string
  objectIds?: Array<string | number>
  error?: { message?: string }
}

interface ParcelFieldMap {
  ids: string[]
  names: Array<string | string[]>
  assessorAcres?: string[]
  mappedAcres?: string[]
  squareFeet?: string[]
  vintage?: string[]
  facts?: ParcelFactsFieldMap
}

interface ParcelAdapter {
  id: string
  stateCode: string
  bounds?: { south: number; west: number; north: number; east: number }
  queryUrl: string
  outFields: string
  fields: ParcelFieldMap
  provenance: DataProvenance
  timeoutMs?: number
  attempts?: number
  factStatus: 'enriched' | 'audited-no-public-facts'
}

const APPROXIMATE_BOUNDARY_NOTE = 'Compiled tax/GIS parcel geometry is approximate, may be incomplete, and is not a boundary survey. Verify with the local assessor and a licensed surveyor.'
const PARTIAL_STATE_NOTE = 'This public statewide compilation depends on participating local jurisdictions and may contain gaps or records from different dates. Geometry is approximate and is not a boundary survey.'

function source(source: string, sourceUrl: string, vintage: string, coverageNote = APPROXIMATE_BOUNDARY_NOTE): DataProvenance {
  return { source, sourceUrl, vintage, coverageNote }
}

function adapter(
  id: string,
  stateCode: string,
  serviceUrl: string,
  fields: ParcelFieldMap,
  provenance: DataProvenance,
  options: Pick<ParcelAdapter, 'bounds' | 'timeoutMs' | 'attempts'> = {},
): ParcelAdapter {
  if (!fields.facts && !(id in PARCEL_FACT_MAPPINGS)) {
    throw new Error(`Parcel adapter ${id} has not completed the public-fact schema audit.`)
  }
  const auditedFacts = PARCEL_FACT_MAPPINGS[id]
  const facts = fields.facts ?? auditedFacts
  const normalizedFields = { ...fields, facts }
  const outFields = Array.from(new Set([
    ...fields.ids,
    ...fields.names.flatMap((field) => Array.isArray(field) ? field : [field]),
    ...(fields.assessorAcres || []),
    ...(fields.mappedAcres || []),
    ...(fields.squareFeet || []),
    ...(fields.vintage || []),
    ...getParcelFactFieldNames(facts),
  ])).join(',')
  return {
    id, stateCode, queryUrl: `${serviceUrl}/query`, outFields, fields: normalizedFields, provenance,
    factStatus: facts && Object.keys(facts).length ? 'enriched' : 'audited-no-public-facts', ...options,
  }
}

const parcelAdapters: ParcelAdapter[] = [
  adapter(
    'travis-county-tax-maps', 'TX',
    'https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/FeatureServer/0',
    { ids: ['PROP_ID', 'geo_id'], names: ['situs_address', 'sub_dec'], assessorAcres: ['tcad_acres', 'legal_acre'], mappedAcres: ['GIS_acres'], facts: {
      situsAddress: ['situs_address', 'py_address'], propertyUseDescription: ['land_type_desc'], propertyUseCode: ['land_state_cd'], subdivision: ['sub_dec'], legalDescription: ['legal_desc'],
      marketValue: ['market_value'], appraisedValue: ['appraised_val'], assessedTotalValue: ['assessed_val'],
      assessedLandValue: { sum: ['land_homesite_val', 'land_non_homesite_val'] }, assessedImprovementValue: { sum: ['imprv_homesite_val', 'imprv_non_homesite_val'] }, yearBuilt: ['F1year_imprv'],
    } },
    source('Travis County Tax Maps parcel layer', 'https://taxmaps.traviscountytx.gov/arcgis/rest/services/Parcels/FeatureServer/0', 'Live Travis County parcel service'),
    { bounds: { south: 30.01, west: -98.2, north: 30.65, east: -97.36 } },
  ),
  adapter(
    'city-of-dallas-certified-tax-parcels', 'TX',
    'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/CRMHostedLayers/FeatureServer/13',
    { ids: ['GIS_ACCT', 'ACCT'], names: ['PROPNAM', ['ST_NUM', 'ST_DIR', 'ST_NAME', 'ST_TYPE']], squareFeet: ['AREA_FEET'], vintage: ['APPRAISALYEAR'], facts: {
      situsAddress: { join: ['ST_NUM', 'ST_DIR', 'ST_NAME', 'ST_TYPE', 'UNITID'] }, municipality: ['CITY'], county: ['COUNTY'], propertyClass: ['PROP_CL', 'BLDG_CL'],
      legalDescription: { join: ['LEGAL_1', 'LEGAL_2', 'LEGAL_3', 'LEGAL_4', 'LEGAL_5'] }, taxYear: ['APPRAISALYEAR'], recordUrl: ['Website'],
    } },
    source('City of Dallas GIS certified tax parcels', 'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/CRMHostedLayers/FeatureServer/13', 'Certified appraisal parcel service'),
    { bounds: { south: 32.55, west: -97.04, north: 33.06, east: -96.51 } },
  ),
  adapter(
    'harris-county-parcels', 'TX',
    'https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/Harris_County_Parcels/FeatureServer/1',
    { ids: ['HCAD_NUM', 'acct_num', 'LOWPARCELID'], names: [['SiteNumber', 'site_str_num', 'site_str_name', 'site_str_sfx', 'site_city']], assessorAcres: ['Acreage', 'acreage_1'], squareFeet: ['land_sqft'], vintage: ['tax_year'], facts: {
      situsAddress: { join: ['SiteNumber', 'site_str_num', 'site_str_name', 'site_str_sfx'] }, municipality: ['site_city'], county: ['site_county'], propertyUseCode: ['land_use'],
      legalDescription: { join: ['legal_dscr_1', 'legal_dscr_2', 'legal_dscr_3', 'legal_dscr_4'] }, assessedLandValue: ['land_value'], assessedImprovementValue: ['impr_value', 'bld_value'],
      appraisedValue: ['total_appraised_val'], marketValue: ['total_market_val'], taxableValue: ['tax_value'], taxYear: ['tax_year'],
    } },
    source('Harris County GIS / HCAD parcel polygons', 'https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/Harris_County_Parcels/FeatureServer/1', 'HCAD parcels received December 2025'),
    { bounds: { south: 29.49, west: -95.98, north: 30.19, east: -94.89 } },
  ),
  adapter(
    'bexar-cad-public-parcels', 'TX',
    'https://maps.bcad.org/arcgis/rest/services/PAMapSearch/MapServer/6',
    { ids: ['PAMaps.dbo.web_map_property.pacs_prop_id', 'PAMaps.DBO.ParcelFabric_Parcels.PROP_ID', 'PAMaps.dbo.web_map_property.geo_id'], names: ['PAMaps.dbo.web_map_property.dba_name', 'PAMaps.dbo.web_map_property.situs'], vintage: ['PAMaps.dbo.web_map_property.prop_val_yr'], facts: {
      situsAddress: ['PAMaps.dbo.web_map_property.situs'], propertyUseCode: ['PAMaps.dbo.web_map_property.prop_type_cd'], propertyUseDescription: ['PAMaps.dbo.web_map_property.prop_type_desc'],
      legalDescription: ['PAMaps.dbo.web_map_property.legal_desc'], subdivision: ['PAMaps.dbo.web_map_property.abs_subdv_cd'], appraisedValue: ['PAMaps.dbo.web_map_property.appraised_val'],
      taxYear: ['PAMaps.dbo.web_map_property.prop_val_yr'],
    } },
    source('Bexar Appraisal District public parcel layer', 'https://maps.bcad.org/arcgis/rest/services/PAMapSearch/MapServer/6', 'Live BCAD public parcel service'),
    { bounds: { south: 29.11, west: -98.82, north: 29.77, east: -98.11 } },
  ),
  adapter(
    'collin-cad-parcels', 'TX',
    'https://services2.arcgis.com/uXyoacYrZTPTKD3R/arcgis/rest/services/CCAD_Parcel_Feature_Set/FeatureServer/4',
    { ids: ['geoID', 'PROP_ID', 'propID'], names: ['dbaName', 'situsConcat', 'legalAbsSubName'], assessorAcres: ['landSizeAcres'], squareFeet: ['landSizeSqft'], vintage: ['dataDate', 'propYear'], facts: {
      situsAddress: ['situsConcat', 'situsConcatShort'], municipality: ['situsCity'], propertyUseCode: ['propUseCode'], propertyUseDescription: ['propType', 'propSubType'], propertyClass: ['propCategoryCode'],
      legalDescription: ['legalDescription'], subdivision: ['legalAbsSubName'], marketValue: ['currValMarket'], appraisedValue: ['currValAppraised'], assessedLandValue: ['currValLand'],
      yearBuilt: ['imprvYearBuilt'], buildingAreaSqFt: ['imprvMainArea'], agriculturalAcres: ['landAgAcres'], taxYear: ['currValYear', 'propYear'],
    } },
    source('Collin Central Appraisal District parcels', 'https://services2.arcgis.com/uXyoacYrZTPTKD3R/arcgis/rest/services/CCAD_Parcel_Feature_Set/FeatureServer/4', 'Live CCAD parcel service'),
    { bounds: { south: 32.89, west: -96.93, north: 33.47, east: -96.23 } },
  ),
  adapter(
    'williamson-cad-parcels', 'TX',
    'https://services1.arcgis.com/Xff0bbfp6vwIWmlU/arcgis/rest/services/WCAD_Tax_Parcels/FeatureServer/0',
    { ids: ['PARCELID', 'PropertyID'], names: ['SITEADDRESS', 'PRPRTYDSCRP'], assessorAcres: ['TotAcreDeed', 'AssessedAc', 'StatedAc'], vintage: ['LASTUPDATE'], facts: {
      situsAddress: ['SITEADDRESS'], propertyUseCode: ['USECD'], propertyUseDescription: ['USEDSCRP'], propertyClass: ['CLASSDSCRP', 'CLASSCD'], legalDescription: ['PRPRTYDSCRP'],
      assessedLandValue: ['LNDVALUE'], assessedTotalValue: ['CNTASSDVAL'], taxableValue: ['CNTTXBLVAL'], yearBuilt: ['RESYRBLT'], buildingAreaSqFt: ['BLDGAREA'], livingAreaSqFt: ['RESFLRAREA'],
      waterService: ['WATERSERV'], sewerService: ['SEWERSERV'],
    } },
    source('Williamson Central Appraisal District tax parcels', 'https://services1.arcgis.com/Xff0bbfp6vwIWmlU/arcgis/rest/services/WCAD_Tax_Parcels/FeatureServer/0', 'Live WCAD parcel service'),
    { bounds: { south: 30.39, west: -98.06, north: 30.91, east: -97.14 } },
  ),
  adapter(
    'montgomery-cad-parcels', 'TX',
    'https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/Tax_Parcel_view/FeatureServer/0',
    { ids: ['PIN', 'pid'], names: ['situs', 'legalDescription'], vintage: ['pYear'], facts: {
      situsAddress: ['situs'], propertyUseCode: ['stateCd', 'asCode'], propertyClass: ['marketArea'], legalDescription: ['legalDescription'], yearBuilt: ['imprvActualYearBuilt'], buildingAreaSqFt: ['imprvMainArea'], taxYear: ['pYear'],
    } },
    source('Montgomery County GIS / MCAD Tax Parcel View', 'https://services1.arcgis.com/PRoAPGnMSUqvTrzq/arcgis/rest/services/Tax_Parcel_view/FeatureServer/0', 'Live authoritative MCAD parcel view'),
    { bounds: { south: 30.01, west: -95.87, north: 30.64, east: -95.07 } },
  ),
  adapter(
    'tarrant-appraisal-parcels', 'TX',
    'https://services3.arcgis.com/9GbPfrQRyZbRsXU4/arcgis/rest/services/Basemap_Layer/FeatureServer/113',
    { ids: ['TAXPIN', 'Account_Nu', 'PIDN'], names: ['Situs_Addr'], assessorAcres: ['ACRES', 'Land_Acres'], squareFeet: ['Land_SqFt'], vintage: ['Notice_Dat', 'last_edited_date'], facts: {
      situsAddress: ['Situs_Addr'], municipality: ['City'], county: ['County'], propertyUseCode: ['State_Use_'], propertyClass: ['Property_C'], legalDescription: ['LegalDescr'],
      marketValue: ['Total_Valu', 'Appraisal1'], appraisedValue: ['Appraised_', 'Appraisal_'], assessedLandValue: ['Land_Value'], assessedImprovementValue: ['Improvemen'],
      lastSaleDate: ['Deed_Date'], yearBuilt: ['Year_Built'], livingAreaSqFt: ['Living_Are'], agriculturalAcres: ['Ag_Acres'], recordUrl: ['GIS_Link'],
    } },
    source('Tarrant Appraisal District parcel layer hosted by City of Bedford', 'https://services3.arcgis.com/9GbPfrQRyZbRsXU4/arcgis/rest/services/Basemap_Layer/FeatureServer/113', 'Live Tarrant parcel layer', PARTIAL_STATE_NOTE),
    { bounds: { south: 32.49, west: -97.61, north: 33.06, east: -97.0 } },
  ),

  adapter(
    'california-sonoma-county-parcels', 'CA',
    'https://socogis.sonomacounty.ca.gov/map/rest/services/AGCOMMPublic/Sonoma_County_Parcels/FeatureServer/0',
    { ids: ['APN', 'Asmt'], names: ['SitusFormatted1', 'SitusFormatted2'], assessorAcres: ['LandSizeAcres'], squareFeet: ['LandSizeSqft'], vintage: ['Value601RollYear', 'last_edited_date', 'MegabyteUpdated'] },
    source('County of Sonoma Clerk-Recorder-Assessor parcels', 'https://socogis.sonomacounty.ca.gov/map/rest/services/AGCOMMPublic/Sonoma_County_Parcels/FeatureServer/0', 'Monthly County of Sonoma public parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 38.1124, west: -123.5330, north: 38.8528, east: -122.3502 }, timeoutMs: 12_000 },
  ),
  adapter(
    'kansas-wyandotte-county-parcels', 'KS',
    'https://gisweb.wycokck.org/arcgis/rest/services/UGMAPS/UGMAPS_4_V02_Parcels/MapServer/7',
    { ids: ['STATE_ID', 'PARCEL', 'PARCEL_NBR'], names: [['NUMB', 'ADDR_EXT', 'DIR', 'ST_NAME', 'SUFX', 'CITY']], assessorAcres: ['ACRE'] },
    source('Unified Government of Wyandotte County/Kansas City parcel polygons', 'https://gisweb.wycokck.org/arcgis/rest/services/UGMAPS/UGMAPS_4_V02_Parcels/MapServer/7', 'Live Unified Government public parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 38.9852, west: -94.9142, north: 39.2045, east: -94.5906 }, timeoutMs: 12_000 },
  ),
  adapter(
    'mississippi-statewide-parcels-2023', 'MS',
    'https://mgis19.mdeq.ms.gov/arcgis/rest/services/GeologyParcelAndFloodGIS/Parcels_Statewide_2023/FeatureServer/3',
    { ids: ['PARNO', 'ALTPARNO', 'PPIN'], names: ['SITEADD', 'SUBNAME'], assessorAcres: ['TAXACRES', 'TOTAL_AC'], mappedAcres: ['GISACRES'], vintage: ['TAXYEAR', 'PLATDATE'] },
    source('Mississippi DEQ / county tax assessor statewide parcels', 'https://mgis19.mdeq.ms.gov/arcgis/rest/services/GeologyParcelAndFloodGIS/Parcels_Statewide_2023/FeatureServer/3', '2023 statewide cadastral compilation', PARTIAL_STATE_NOTE),
    { timeoutMs: 15_000, attempts: 1 },
  ),

  // Arizona — Maricopa County (Phoenix metro). Arizona does not publish a
  // statewide parcel service; Maricopa County is the state's largest county
  // and covers the Phoenix metropolitan area.
  adapter('arizona-maricopa-county-parcels', 'AZ', 'https://gis.maricopa.gov/arcgis/rest/services/IndividualService/Parcel/MapServer/1',
    { ids: ['APN', 'APNDash'], names: ['PropertyFullStreetAddress'], assessorAcres: ['LotSize_Acre'], squareFeet: ['LotSize_SqFt'], vintage: ['TaxYear', 'ParcelValuationYear'] },
    source('Maricopa County Assessor parcel layer', 'https://gis.maricopa.gov/arcgis/rest/services/IndividualService/Parcel/MapServer/1', 'Live Maricopa County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 32.70, west: -113.80, north: 34.05, east: -111.15 } }),

  adapter('alaska-statewide-parcels', 'AK', 'https://services1.arcgis.com/7HDiw78fcUiM2BWn/arcgis/rest/services/AK_Parcels/FeatureServer/0',
    { ids: ['parcel_id', 'feature_id'], names: [] },
    source('Alaska Statewide Parcels', 'https://services1.arcgis.com/7HDiw78fcUiM2BWn/arcgis/rest/services/AK_Parcels/FeatureServer/0', 'Live public statewide compilation', PARTIAL_STATE_NOTE)),
  adapter('arkansas-camp-parcels', 'AR', 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6',
    { ids: ['parcelid', 'camakey'], names: ['adrlabel', 'subdivision'], vintage: ['sourcedate', 'pubdate'] },
    source('Arkansas GIS Office CAMP parcel polygons', 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6', 'Live Arkansas GIS service', PARTIAL_STATE_NOTE)),
  adapter('colorado-public-parcels', 'CO', 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0',
    { ids: ['parcel_id', 'account'], names: ['situsAdd', 'subName'], assessorAcres: ['landAcres'], squareFeet: ['landSqft'], vintage: ['dateReceived'] },
    source('Colorado Public Parcel Composite', 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0', 'Live Colorado county composite', PARTIAL_STATE_NOTE), { timeoutMs: 12_000, attempts: 1 }),
  adapter('connecticut-cama-parcels', 'CT', 'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0',
    { ids: ['Parcel_ID'], names: ['Full_Address', 'Location'], assessorAcres: ['Land_Acres'], vintage: ['Collection_year', 'Valuation_Year'], facts: {
      situsAddress: ['Full_Address', 'Location_1', 'Location'], municipality: ['Property_City', 'Town_Name'], propertyUseCode: ['State_Use'], propertyUseDescription: ['State_Use_Description'], zoning: ['Zone'],
      assessedTotalValue: ['Assessed_Total'], assessedLandValue: ['Assessed_Land'], assessedImprovementValue: ['Assessed_Building'],
      appraisedValue: { sum: ['Appraised_Land', 'Appraised_Building', 'Appraised_Outbuilding'] }, lastSalePrice: ['Sale_Price'], lastSaleDate: ['Sale_Date'],
      yearBuilt: ['EYB', 'AYB'], livingAreaSqFt: ['Living_Area'], buildingAreaSqFt: ['Effective_Area'], taxYear: ['Valuation_Year'], recordUrl: ['CAMA_Link', 'Link', 'link_1'],
    } },
    source('Connecticut CAMA and Parcel Layer', 'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0', 'Statewide CAMA/parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('delaware-state-parcels', 'DE', 'https://enterprise.firstmap.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/FeatureServer/0',
    { ids: ['PIN'], names: [], assessorAcres: ['ACRES'], vintage: ['UPDATED'] },
    source('Delaware FirstMap State Parcels', 'https://enterprise.firstmap.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/FeatureServer/0', 'Live Delaware FirstMap service')),
  adapter('florida-statewide-cadastral', 'FL', 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0',
    { ids: ['PARCEL_ID', 'PARCELNO', 'ALT_KEY'], names: [['PHY_ADDR1', 'PHY_ADDR2', 'PHY_CITY']], squareFeet: ['LND_SQFOOT'], vintage: ['ASMNT_YR', 'DT_LAST_IN'], facts: {
      situsAddress: { join: ['PHY_ADDR1', 'PHY_ADDR2'] }, municipality: ['PHY_CITY'], propertyUseCode: ['DOR_UC', 'PA_UC'], legalDescription: ['S_LEGAL'],
      marketValue: ['JV'], assessedLandValue: ['LND_VAL'], lastSalePrice: ['SALE_PRC1'], lastSaleYear: ['SALE_YR1'], lastSaleMonth: ['SALE_MO1'],
      yearBuilt: ['EFF_YR_BLT', 'ACT_YR_BLT'], buildingCount: ['NO_BULDNG'], livingAreaSqFt: ['TOT_LVG_AR'], taxYear: ['ASMNT_YR'],
    } },
    source('Florida Department of Revenue Statewide Cadastral', 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0', '2025 statewide cadastral export', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
  adapter('hawaii-statewide-tmk', 'HI', 'https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25',
    { ids: ['tmk_txt', 'tmk', 'cty_tmk'], names: [], mappedAcres: ['gisacres'] },
    source('Hawaii Statewide Tax Map Key parcels', 'https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25', 'Live Hawaii Statewide GIS service')),
  adapter('idaho-public-parcels', 'ID', 'https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/7',
    { ids: ['PARCEL_ID', 'FP_ID'], names: [['SITE_ADD', 'SITE_CITY']], assessorAcres: ['ASR_ACRES'], vintage: ['UPDATED'] },
    source('Idaho State Tax Commission Public Parcels', 'https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/7', 'Live public Idaho parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('indiana-current-parcels', 'IN', 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0',
    { ids: ['state_parcel_id', 'parcel_id', 'local_id'], names: ['prop_add', 'dlgf_prop_address'], vintage: ['loaddate'] },
    source('IndianaMap Current Parcel Boundaries', 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0', 'Current statewide Indiana parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('maine-organized-town-parcels', 'ME', 'https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer/10',
    { ids: ['STATE_ID', 'MAP_BK_LOT'], names: ['PROP_LOC'], vintage: ['FMUPDAT'] },
    source('Maine GeoLibrary Parcels for Organized Towns', 'https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer/10', 'Live Maine GeoLibrary service', PARTIAL_STATE_NOTE)),
  adapter('massgis-property-tax-parcels', 'MA', 'https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0',
    { ids: ['MAP_PAR_ID', 'LOC_ID', 'PROP_ID'], names: ['SITE_ADDR', 'LOCATION'], vintage: ['FY', 'LAST_EDIT'] },
    source('MassGIS Property Tax Parcels', 'https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0', 'Live MassGIS statewide Level 3 parcels', PARTIAL_STATE_NOTE)),
  adapter('minnesota-open-parcels', 'MN', 'https://utility.arcgis.com/usrsvcs/servers/1627519e8d3f42bcb55532d48e9a61e5/rest/services/OpenParcels/plan_parcels_open/MapServer/0',
    { ids: ['state_pin', 'county_pin'], names: ['landmark', 'plat_name'], assessorAcres: ['acres_deed'], mappedAcres: ['acres_poly'], vintage: ['tax_year', 'edit_date'] },
    source('Minnesota Geospatial Commons Opt-In Open Parcels', 'https://utility.arcgis.com/usrsvcs/servers/1627519e8d3f42bcb55532d48e9a61e5/rest/services/OpenParcels/plan_parcels_open/MapServer/0', 'Live opt-in Minnesota parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('montana-cadastral-framework', 'MT', 'https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1',
    { ids: ['PARCELID', 'PropertyID', 'AssessmentCode'], names: ['AddressLine1', 'Subdivision'], assessorAcres: ['TotalAcres'], mappedAcres: ['GISAcres'], vintage: ['TaxYear'], facts: {
      situsAddress: { join: ['AddressLine1', 'AddressLine2', 'CityStateZip'] }, county: ['CountyName'], propertyClass: ['PropType'], legalDescription: ['LegalDescriptionShort'], subdivision: ['Subdivision'],
      marketValue: ['TotalValue'], assessedLandValue: ['TotalLandValue'], assessedImprovementValue: ['TotalBuildingValue'], taxYear: ['TaxYear'],
      croplandAcres: { sum: ['ContinuousCropAcres', 'FallowAcres'] }, agriculturalAcres: ['FarmsiteAcres'], forestAcres: ['ForestAcres'], grazingAcres: ['GrazingAcres'], irrigatedAcres: ['IrrigatedAcres'], accessDescription: ['PropAccess'],
    } },
    source('Montana State Library Cadastral Framework', 'https://services.arcgis.com/qnjIrwR8z5Izc0ij/arcgis/rest/services/Montana_Cadastral_Framework/FeatureServer/1', 'Live Montana cadastral service')),
  adapter('nevada-statewide-parcels', 'NV', 'https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_in_Nevada/MapServer/0',
    { ids: ['APN', 'PIN'], names: ['SiteCity'], assessorAcres: ['Acres'], vintage: ['SourceDate'] },
    source('Nevada Division of Water Resources county parcel compilation', 'https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_in_Nevada/MapServer/0', 'Statewide county parcel compilation', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
  adapter('nebraska-statewide-parcels', 'NE', 'https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0',
    { ids: ['State_PID', 'Parcel_ID'], names: ['Situs_Address', 'Subdivision'], assessorAcres: ['Acres_Deeded'], mappedAcres: ['GIS_Acres'], vintage: ['CAMAUpdate', 'ShapeUpdate'] },
    source('Nebraska Statewide Parcels', 'https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0', 'Annual Nebraska county assessor compilation', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
  adapter('new-hampshire-parcel-mosaic', 'NH', 'https://nhgeodata.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1',
    { ids: ['nh_gis_id', 'pid', 'displayid'], names: ['streetaddress'] },
    source('NH GRANIT Parcel Mosaic', 'https://nhgeodata.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1', 'Live statewide New Hampshire mosaic', PARTIAL_STATE_NOTE)),
  adapter('new-jersey-parcel-composite', 'NJ', 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0',
    { ids: ['PAMS_PIN', 'GIS_PIN'], names: ['FAC_NAME', 'PROP_LOC'], mappedAcres: ['CALC_ACRE'], vintage: ['PCLLASTUPD', 'PCL_PBDATE'] },
    source('NJ Office of GIS Parcels and MOD-IV Composite', 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0', 'Live New Jersey parcel composite', PARTIAL_STATE_NOTE)),
  adapter('new-york-public-tax-parcels', 'NY', 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1',
    { ids: ['SWIS_PRINT_KEY_ID', 'MUNI_PARCEL_ID', 'SBL'], names: ['PARCEL_ADDR'], assessorAcres: ['ACRES'], mappedAcres: ['CALC_ACRES'], squareFeet: ['SQ_FT'], vintage: ['ROLL_YR', 'SPATIAL_YR'], facts: {
      situsAddress: ['PARCEL_ADDR'], county: ['COUNTY_NAME'], municipality: ['MUNI_NAME', 'CITYTOWN_NAME'], propertyUseCode: ['PROP_CLASS', 'USED_AS_CODE'], propertyUseDescription: ['USED_AS_DESC'], buildingDescription: ['BLDG_STYLE_DESC'],
      marketValue: ['FULL_MARKET_VAL'], assessedTotalValue: ['TOTAL_AV'], assessedLandValue: ['LAND_AV'], yearBuilt: ['YR_BLT'], buildingAreaSqFt: ['GFA'], livingAreaSqFt: ['SQFT_LIVING'],
      frontageFeet: ['FRONT'], depthFeet: ['DEPTH'], waterService: ['WATER_DESC', 'WATER_SUPPLY'], sewerService: ['SEWER_DESC', 'SEWER_TYPE'], utilities: ['UTILITIES_DESC', 'UTILITIES'], taxYear: ['ROLL_YR'],
    } },
    source('New York State GIS Public Tax Parcels', 'https://services6.arcgis.com/EbVsqZ18sv1kVJ3k/arcgis/rest/services/NYS_Tax_Parcels_Public/FeatureServer/1', 'Live public NYS tax parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('north-carolina-one-map-parcels', 'NC', 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1',
    { ids: ['parno', 'altparno', 'nparno'], names: ['siteadd'], mappedAcres: ['gisacres'], vintage: ['revisedate', 'sourcedate'] },
    source('NC OneMap Parcels', 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1', 'Live North Carolina county parcel aggregation', PARTIAL_STATE_NOTE)),
  adapter('north-dakota-gis-hub-parcels', 'ND', 'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer/0',
    { ids: ['UniqueGISID', 'GISID'], names: ['SubdivisionPlat'], mappedAcres: ['CalculatedAcres'], vintage: ['SourceDate', 'LastUpdateDate'] },
    source('North Dakota GIS Hub Parcels', 'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer/0', 'Live ND GIS Hub statewide parcels', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
  adapter('ohio-statewide-parcels', 'OH', 'https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0',
    { ids: ['StateParcelID', 'LocalParcelID'], names: ['SitusAddressAll'], assessorAcres: ['LandArea'] },
    source('Ohio OGRIP Statewide Parcels Public View', 'https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0', 'Public statewide Ohio parcel composite', PARTIAL_STATE_NOTE)),
  adapter('tennessee-property-boundaries', 'TN', 'https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0',
    { ids: ['PARCELID', 'PARCEL'], names: ['ADDRESS', 'SUBDIV'], assessorAcres: ['DEEDAC'] },
    source('Tennessee Property Boundaries Public Use', 'https://services1.arcgis.com/YuVBSS7Y1of2Qud1/arcgis/rest/services/Tennessee_Property_Boundaries_Public_Use/FeatureServer/0', 'Live statewide Tennessee parcel compilation', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
  adapter('utah-statewide-parcels', 'UT', 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0',
    { ids: ['PARCEL_ID', 'ACCOUNT_NUM'], names: [['PARCEL_ADD', 'PARCEL_CITY']] },
    source('Utah AGRC Statewide Parcels', 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0', 'Live Utah county parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('virginia-vgin-parcels', 'VA', 'https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0',
    { ids: ['PARCELID', 'PTM_ID', 'VGIN_QPID'], names: ['LOCALITY'], vintage: ['LASTUPDATE'] },
    source('Virginia Geographic Information Network (VGIN) statewide parcels', 'https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer/0', 'Live VGIN statewide parcel service', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
  adapter('vermont-standardized-parcels', 'VT', 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0',
    { ids: ['SPAN', 'PARCID', 'MAPID'], names: ['E911ADDR', 'LOCAPROP'], assessorAcres: ['ACRESGL'], vintage: ['YEAR', 'SOURCEDATE', 'EDITDATE'] },
    source('Vermont VCGI Standardized Parcel Data', 'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0', 'Live statewide Vermont standardized parcels', PARTIAL_STATE_NOTE)),
  adapter('washington-current-parcels', 'WA', 'https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0',
    { ids: ['PARCEL_ID_NR', 'ORIG_PARCEL_ID'], names: ['SITUS_ADDRESS', 'SUB_ADDRESS'] },
    source('Washington State Geospatial Open Data Current Parcels', 'https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0', '2026 statewide county parcel compilation', PARTIAL_STATE_NOTE)),
  adapter('west-virginia-parcels', 'WV', 'https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0',
    { ids: ['CleanParcelID', 'GISPID', 'ROOTID'], names: ['FullPhysicalAddress'], mappedAcres: ['Acres_C'] },
    source('West Virginia County Assessor Parcel Service', 'https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0', 'Tax Year 2023 statewide parcel service', PARTIAL_STATE_NOTE)),
  adapter('wisconsin-statewide-parcels', 'WI', 'https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels/FeatureServer/0',
    { ids: ['STATEID', 'PARCELID', 'TAXPARCELID'], names: ['SITEADRESS_STAND', 'SITEADRESS', 'LANDMARKNAME'], assessorAcres: ['ASSDACRES', 'DEEDACRES'], mappedAcres: ['GISACRES'], vintage: ['TAXROLLYEAR', 'PARCELDATE', 'LOADDATE'] },
    source('Wisconsin Statewide Parcel Map Database V11', 'https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels/FeatureServer/0', 'V11 / 2025 statewide parcel release', PARTIAL_STATE_NOTE)),

  // ─── County-level and additional statewide adapters (Phases 13–14) ────

  // Alabama — Mobile County (Mobile County Revenue Commission)
  adapter('alabama-mobile-county-parcels', 'AL', 'https://services8.arcgis.com/HND1NcQt6vgOGn1z/arcgis/rest/services/MCRC_Public_Parcels/FeatureServer/0',
    { ids: ['Parcel_Number', 'Account_Number', 'ParcelNo'], names: ['PropAddr1', 'PropCity'], assessorAcres: ['Acreage'], squareFeet: ['Sqft'] },
    source('Mobile County Revenue Commission public parcels', 'https://services8.arcgis.com/HND1NcQt6vgOGn1z/arcgis/rest/services/MCRC_Public_Parcels/FeatureServer/0', 'Live Mobile County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 30.22, west: -88.42, north: 31.52, east: -87.42 } }),

  // Georgia — DeKalb County (metro Atlanta)
  adapter('georgia-dekalb-county-parcels', 'GA', 'https://services2.arcgis.com/IxVN2oUE9EYLSnPE/arcgis/rest/services/Tax_Parcels_2025/FeatureServer/0',
    { ids: ['ParcelID'], names: [], assessorAcres: [], mappedAcres: ['CalculatedArea'] },
    source('DeKalb County GIS tax parcels 2025', 'https://services2.arcgis.com/IxVN2oUE9EYLSnPE/arcgis/rest/services/Tax_Parcels_2025/FeatureServer/0', '2025 DeKalb County tax parcel release', PARTIAL_STATE_NOTE),
    { bounds: { south: 33.55, west: -84.55, north: 34.35, east: -83.90 } }),

  // Iowa — statewide (University of Iowa, 2017 compilation)
  adapter('iowa-statewide-parcels-2017', 'IA', 'https://services3.arcgis.com/kd9gaiUExYqUbnoq/arcgis/rest/services/Iowa_Parcels_2017/FeatureServer/0',
    { ids: ['STATEPARID', 'UNPARCELID', 'PARCELNUMB'], names: ['COUNTYNAME'] },
    source('Iowa Statewide Parcel Data 2017 (University of Iowa)', 'https://services3.arcgis.com/kd9gaiUExYqUbnoq/arcgis/rest/services/Iowa_Parcels_2017/FeatureServer/0', '2017 statewide parcel compilation', PARTIAL_STATE_NOTE)),

  // Illinois — Lake County
  adapter('illinois-lake-county-parcels', 'IL', 'https://services3.arcgis.com/HESxeTbDliKKvec2/arcgis/rest/services/OpenData_ParcelPolygons/FeatureServer/0',
    { ids: ['legdesc1', 'legdesc2'], names: [['situs_addr_line_1_First', 'situs_addr_city_First']] },
    source('Lake County Illinois open data parcel polygons', 'https://services3.arcgis.com/HESxeTbDliKKvec2/arcgis/rest/services/OpenData_ParcelPolygons/FeatureServer/0', 'Live Lake County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 42.20, west: -88.20, north: 42.85, east: -87.50 } }),

  // Kentucky — Jefferson County (Louisville, via LOJIC)
  adapter('kentucky-jefferson-county-parcels', 'KY', 'https://gis.lojic.org/maps/rest/services/LojicSolutions/OpenDataPVA/MapServer/1',
    { ids: ['PARCELID', 'LRSN'], names: [] },
    source('LOJIC / Jefferson County PVA open data parcels', 'https://gis.lojic.org/maps/rest/services/LojicSolutions/OpenDataPVA/MapServer/1', 'Live Louisville/Jefferson County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 37.95, west: -85.95, north: 38.75, east: -85.40 } }),

  // Louisiana — Baton Rouge (City-Parish)
  adapter('louisiana-baton-rouge-parcels', 'LA', 'https://maps.brla.gov/gis/rest/services/Cadastral/Tax_Parcel/MapServer/0',
    { ids: ['ASSESSMENT_NUM', 'PRONO'], names: ['PHYSICAL_ADDRESS', 'SUBDIVISION'] },
    source('Baton Rouge City-Parish tax parcel service', 'https://maps.brla.gov/gis/rest/services/Cadastral/Tax_Parcel/MapServer/0', 'Live East Baton Rouge Parish parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 30.25, west: -91.35, north: 30.70, east: -90.90 } }),

  // Maryland — statewide parcel boundaries (Maryland iMap / Dept of Planning)
  adapter('maryland-statewide-parcel-boundaries', 'MD', 'https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_ParcelBoundaries/MapServer/0',
    { ids: ['ACCTID', 'JURSCODE'], names: ['ADDRESS'], assessorAcres: ['ACRES'], mappedAcres: ['POLYACRES'], squareFeet: ['LANDAREA'], vintage: ['SDATDATE'] },
    source('Maryland iMap statewide parcel boundaries', 'https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_ParcelBoundaries/MapServer/0', 'Live statewide Maryland parcel boundary service', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),

  // Michigan — Ottawa County
  adapter('michigan-ottawa-county-parcels', 'MI', 'https://gis.miottawa.org/arcgis/rest/services/HostedServices/ParcelsPublic/MapServer/0',
    { ids: ['FinalPIN', 'ParentPIN', 'CondoPIN'], names: ['PropertyAddress', ['AddressNumber', 'AddressStreet']], assessorAcres: ['Acreage'] },
    source('Ottawa County Michigan public parcels', 'https://gis.miottawa.org/arcgis/rest/services/HostedServices/ParcelsPublic/MapServer/0', 'Live Ottawa County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 42.70, west: -86.50, north: 43.35, east: -85.90 } }),

  // Missouri — Kansas City
  adapter('missouri-kansas-city-parcels', 'MO', 'https://mapd.kcmo.org/kcgis/rest/services/AGOL/MapServer/6',
    { ids: ['KIVAPIN', 'APN'], names: ['PLATNAME'] },
    source('Kansas City Missouri GIS parcel layer', 'https://mapd.kcmo.org/kcgis/rest/services/AGOL/MapServer/6', 'Live Kansas City parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 38.80, west: -94.73, north: 39.40, east: -94.30 } }),

  // New Mexico — Doña Ana County (Las Cruces area)
  adapter('new-mexico-dona-ana-county-parcels', 'NM', 'https://services7.arcgis.com/JMIoqakAkedEx0oU/arcgis/rest/services/DAC_Parcels/FeatureServer/0',
    { ids: ['ACCOUNTNUMBER', 'PARCELNUMBER', 'MAP_CODE'], names: ['SITUSADDRS', 'SUBNAME'], assessorAcres: ['TOTALACRES'], squareFeet: ['TOTALSQFT'] },
    source('Doña Ana County Assessor public parcels', 'https://services7.arcgis.com/JMIoqakAkedEx0oU/arcgis/rest/services/DAC_Parcels/FeatureServer/0', 'Live Doña Ana County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 31.30, west: -107.10, north: 32.45, east: -106.30 } }),

  // Oklahoma — Canadian County (OKC metro)
  adapter('oklahoma-canadian-county-parcels', 'OK', 'https://services2.arcgis.com/0NjdXxmJp53hZWPd/arcgis/rest/services/ParcelDataService_2_view/FeatureServer/0',
    { ids: ['subdivision_name', 'subdivision_number'], names: [], assessorAcres: ['acres'] },
    source('Canadian County Oklahoma public parcel data', 'https://services2.arcgis.com/0NjdXxmJp53hZWPd/arcgis/rest/services/ParcelDataService_2_view/FeatureServer/0', 'Live Canadian County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 35.30, west: -98.20, north: 35.90, east: -97.50 } }),

  // Oregon — statewide taxlots (Oregon Department of Forestry)
  adapter('oregon-statewide-taxlots', 'OR', 'https://gis.odf.oregon.gov/ags1/rest/services/WebMercator/TaxlotsDisplay/MapServer/0',
    { ids: ['County', 'Town', 'Range'], names: ['TownPart'], assessorAcres: ['TaxlotAcre'], vintage: ['INSTYEAR'] },
    source('Oregon Department of Forestry statewide taxlot display', 'https://gis.odf.oregon.gov/ags1/rest/services/WebMercator/TaxlotsDisplay/MapServer/0', 'Live statewide Oregon taxlot service', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),

  // Pennsylvania — Chester County
  adapter('pennsylvania-chester-county-parcels', 'PA', 'https://services.arcgis.com/G4S1dGvn7PIgYd6Y/arcgis/rest/services/Parcels_owners/FeatureServer/0',
    { ids: ['UPI', 'PIN_MAP', 'PIN_COMMON', 'PIN_ASMNT'], names: [], assessorAcres: ['ACRE_PLAN_TOT'] },
    source('Chester County Pennsylvania parcel data', 'https://services.arcgis.com/G4S1dGvn7PIgYd6Y/arcgis/rest/services/Parcels_owners/FeatureServer/0', 'Live Chester County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 39.75, west: -76.05, north: 40.25, east: -75.30 } }),

  // Pennsylvania — York County
  adapter('pennsylvania-york-county-parcels', 'PA', 'https://arcweb1.ycpc.org/server/rest/services/OPEN_DATA/Parcels/MapServer/0',
    { ids: ['PIDN', 'PARCEL', 'PARCEL_MAJOR', 'PARCEL_MINOR'], names: ['PROPADR', 'DISTRICT', 'BLOCK'], assessorAcres: ['ACRES'] },
    source('York County Pennsylvania Planning Commission parcels', 'https://arcweb1.ycpc.org/server/rest/services/OPEN_DATA/Parcels/MapServer/0', 'Live York County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 39.70, west: -77.30, north: 40.20, east: -76.50 } }),

  // Rhode Island — statewide tax parcels (RIGIS)
  adapter('rhode-island-statewide-tax-parcels', 'RI', 'https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0',
    { ids: ['PlatLot'], names: ['E911'], assessorAcres: ['Acres'] },
    source('Rhode Island Geographic Information System (RIGIS) tax parcels', 'https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0', 'Live statewide Rhode Island tax parcel service')),

  // South Carolina — York County
  adapter('south-carolina-york-county-parcels', 'SC', 'https://services1.arcgis.com/2AGLxyiJoNiVHKwq/arcgis/rest/services/Parcels/FeatureServer/0',
    { ids: ['TAXMAPID', 'ParcelID', 'AprAccNum'], names: ['PropertyAddress', 'LegalDescription'], assessorAcres: ['deededacres'] },
    source('York County South Carolina public parcels', 'https://services1.arcgis.com/2AGLxyiJoNiVHKwq/arcgis/rest/services/Parcels/FeatureServer/0', 'Live York County SC parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 34.80, west: -81.65, north: 35.20, east: -80.80 } }),

  // South Dakota — Minnehaha County (Sioux Falls area)
  adapter('south-dakota-minnehaha-county-parcels', 'SD', 'https://gis.minnehahacounty.gov/minnemap/rest/services/Parcels/MapServer/0',
    { ids: ['TAG', 'MAP_ID', 'MRRDID'], names: ['FULL_ADDRESS'], assessorAcres: ['TOTAL_ACREAGE'], squareFeet: ['SQFT'], vintage: ['Assmnt_Year'] },
    source('Minnehaha County South Dakota parcel service', 'https://gis.minnehahacounty.gov/minnemap/rest/services/Parcels/MapServer/0', 'Live Minnehaha County parcel service', PARTIAL_STATE_NOTE),
    { bounds: { south: 43.20, west: -96.90, north: 43.90, east: -96.30 } }),

  // Wyoming — statewide parcels (Wyoming State Lands / OSLISDE)
  adapter('wyoming-statewide-parcels-2025', 'WY', 'https://gis2.statelands.wyo.gov/arcgis/rest/services/oslisde/Parcels2025/MapServer/0',
    { ids: ['parcelnb', 'accountno'], names: ['jurisdicti'] },
    source('Wyoming State Lands and Investments Board 2025 parcels', 'https://gis2.statelands.wyo.gov/arcgis/rest/services/oslisde/Parcels2025/MapServer/0', '2025 statewide Wyoming parcel service', PARTIAL_STATE_NOTE), { timeoutMs: 12_000 }),
]

const parcelCache = new Map<string, { result: ParcelSelection; expiresAt: number }>()

function text(value: string | number | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function number(value: string | number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function firstText(properties: Record<string, string | number | null>, fields: string[]) {
  for (const field of fields) {
    const value = text(properties[field])
    if (value && value !== '0' && value.toLowerCase() !== 'null') return value
  }
  return ''
}

function firstNumber(properties: Record<string, string | number | null>, fields: string[] = []) {
  for (const field of fields) {
    const value = number(properties[field])
    if (value) return value
  }
  return undefined
}

function firstName(properties: Record<string, string | number | null>, fieldGroups: Array<string | string[]>) {
  for (const fieldGroup of fieldGroups) {
    const fields = Array.isArray(fieldGroup) ? fieldGroup : [fieldGroup]
    const parts = Array.from(new Set(fields.map((field) => text(properties[field])).filter(Boolean)))
    if (parts.length) return parts.join(' ')
  }
  return ''
}

function titleCase(value: string) {
  if (/[a-z]/.test(value)) return value
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function cleanParcelName(value: string, id?: string) {
  const clean = titleCase(text(value))
  if (clean) return /\bparcel$/i.test(clean) ? clean : `${clean} parcel`
  return id ? `Parcel ${id}` : undefined
}

function ringAreaSquareMeters(ring: number[][]) {
  if (ring.length < 3) return 0
  const radius = 6_378_137
  const radians = Math.PI / 180
  let total = 0
  for (let index = 0; index < ring.length; index += 1) {
    const lower = ring[(index + ring.length - 1) % ring.length]
    const middle = ring[index]
    const upper = ring[(index + 1) % ring.length]
    total += (upper[0] - lower[0]) * radians * Math.sin(middle[1] * radians)
  }
  return Math.abs(total * radius * radius / 2)
}

export function calculateParcelAreaAcres(boundary: NonNullable<ScreeningArea['boundary']>) {
  const polygonArea = (polygon: number[][][]) => {
    const outer = ringAreaSquareMeters(polygon[0] || [])
    const holes = polygon.slice(1).reduce((sum, ring) => sum + ringAreaSquareMeters(ring), 0)
    return Math.max(0, outer - holes)
  }
  const squareMeters = boundary.type === 'Polygon'
    ? polygonArea(boundary.coordinates as number[][][])
    : (boundary.coordinates as number[][][][]).reduce((sum, polygon) => sum + polygonArea(polygon), 0)
  const acres = squareMeters / 4_046.8564224
  return Number.isFinite(acres) && acres > 0 ? acres : undefined
}

function includesPoint(candidate: ParcelAdapter, coordinates: Coordinates) {
  const bounds = candidate.bounds
  return !bounds || (coordinates.lat >= bounds.south && coordinates.lat <= bounds.north
    && coordinates.lng >= bounds.west && coordinates.lng <= bounds.east)
}

async function fetchJson<T>(url: string, timeoutMs: number, attempts = 2, signal?: AbortSignal): Promise<T> {
  let lastError: unknown = new Error('Parcel service unavailable')
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await externalRequest(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Parcel service returned ${response.status}`)
      return await response.json() as T
    } catch (error) {
      lastError = error
      if (signal?.aborted || attempt === attempts - 1) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  throw lastError
}

async function queryAdapter(candidate: ParcelAdapter, coordinates: Coordinates, signal?: AbortSignal): Promise<ParcelSelection> {
  const timeoutMs = candidate.timeoutMs || 8_000
  const attempts = candidate.attempts || 2
  const idParams = new URLSearchParams({
    f: 'json', where: '1=1', geometry: `${coordinates.lng},${coordinates.lat}`,
    geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    returnIdsOnly: 'true', returnGeometry: 'false',
  })
  const ids = await fetchJson<ObjectIdResponse>(`${candidate.queryUrl}?${idParams}`, timeoutMs, attempts, signal)
  if (ids.error) throw new Error(ids.error.message || 'Parcel ID query failed')
  if (!ids.objectIds?.length) return { status: 'none', message: 'No tax parcel contains this exact point. Click inside a parcel rather than a street or right-of-way.' }
  if (ids.objectIds.length > 1) return { status: 'none', message: 'Multiple official parcel records overlap this exact point. LandLens did not guess between them; click farther inside the intended parcel or verify it with the local assessor.' }

  const featureParams = new URLSearchParams({
    f: 'geojson', objectIds: String(ids.objectIds[0]), outFields: candidate.outFields,
    returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', returnZ: 'false', returnM: 'false',
  })
  const collection = await fetchJson<GeoJsonFeatureCollection>(`${candidate.queryUrl}?${featureParams}`, timeoutMs, attempts, signal)
  if (collection.error) throw new Error(collection.error.message || 'Parcel geometry query failed')
  const feature = collection.features?.find((item) => item.geometry?.type === 'Polygon' || item.geometry?.type === 'MultiPolygon')
  if (!feature?.geometry) return { status: 'none', message: 'A parcel record was found, but its polygon geometry was unavailable.' }

  const properties = feature.properties || {}
  const id = firstText(properties, candidate.fields.ids)
  if (!id) {
    return { status: 'none', message: 'The public source returned geometry here without a stable parcel identifier, so LandLens did not use or auto-fill it.' }
  }
  const nameSource = firstName(properties, candidate.fields.names)
  const assessorAcres = firstNumber(properties, candidate.fields.assessorAcres)
  const mappedFieldAcres = firstNumber(properties, candidate.fields.mappedAcres)
  const squareFeet = firstNumber(properties, candidate.fields.squareFeet)
  const geometryAcres = calculateParcelAreaAcres(feature.geometry)
  const acres = assessorAcres || mappedFieldAcres || (squareFeet ? squareFeet / 43_560 : undefined) || geometryAcres
  const acreageKind = assessorAcres ? 'assessor' as const : acres ? 'mapped' as const : undefined
  const vintageValue = firstText(properties, candidate.fields.vintage || [])
  const facts = normalizeParcelFacts(properties, candidate.fields.facts)
  const provenance = vintageValue
    ? { ...candidate.provenance, vintage: `${candidate.provenance.vintage}; record ${vintageValue}` }
    : candidate.provenance

  return {
    status: 'found', message: 'Official parcel matched at the selected point.',
    id, name: cleanParcelName(nameSource, id), acres, acreageKind, facts,
    provenance, boundary: feature.geometry,
  }
}

export function formatParcelAcres(acres: number) {
  const digits = acres < 1 ? 3 : 2
  return acres.toFixed(digits).replace(/\.?0+$/, '')
}

export function getParcelCoverage() {
  const states = Array.from(new Set(parcelAdapters.map((candidate) => candidate.stateCode))).sort()
  return { states, adapterCount: parcelAdapters.length }
}

export function getParcelProviderContracts() {
  return parcelAdapters.map((candidate) => ({
    id: candidate.id,
    stateCode: candidate.stateCode,
    queryUrl: candidate.queryUrl,
    bounds: candidate.bounds ? { ...candidate.bounds } : undefined,
    source: candidate.provenance.source,
    outFields: candidate.outFields.split(',').filter(Boolean),
    factFields: getParcelFactFieldNames(candidate.fields.facts),
    factStatus: candidate.factStatus,
  }))
}

export async function fetchParcelAt(coordinates: Coordinates, stateCode: string, signal?: AbortSignal): Promise<ParcelSelection> {
  const cacheKey = `${stateCode}:${coordinates.lat.toFixed(5)},${coordinates.lng.toFixed(5)}`
  const cached = parcelCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  const candidates = parcelAdapters.filter((candidate) => candidate.stateCode === stateCode && includesPoint(candidate, coordinates))
  if (!candidates.length) {
    const result: ParcelSelection = { status: 'unsupported', message: 'No verified public parcel source is available for this location yet.' }
    parcelCache.set(cacheKey, { result, expiresAt: Date.now() + 10 * 60_000 })
    return result
  }

  let lastNone: ParcelSelection | undefined
  let lastError: unknown
  for (const candidate of candidates) {
    try {
      const result = await queryAdapter(candidate, coordinates, signal)
      if (result.status === 'found') {
        parcelCache.set(cacheKey, { result, expiresAt: Date.now() + 10 * 60_000 })
        return result
      }
      lastNone = result
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
    }
  }

  if (lastNone) {
    parcelCache.set(cacheKey, { result: lastNone, expiresAt: Date.now() + 10 * 60_000 })
    return lastNone
  }
  const message = lastError instanceof Error && lastError.name !== 'AbortError' ? lastError.message : 'service timed out'
  return { status: 'error', message: `Verified parcel coverage exists here, but the public service did not respond: ${message}. Try the point again.` }
}
