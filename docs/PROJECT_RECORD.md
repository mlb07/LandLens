# LandLens Project Record

This is the living source of truth for what was planned, what was decided, what was implemented, and what remains. Update it whenever project scope or implementation changes.

## Product statement

LandLens is a lightweight, browser-based US land intelligence website. A user chooses a state, searches for a location or clicks its map, adds information they know about the land, and receives a transparent preliminary development feasibility score from 0–100.

The question LandLens answers is: **“Is this land interesting enough to research further?”** It must never present its result as a final investment or development decision.

## Agreed MVP plan

The first working version must let a user:

1. Open the website.
2. Search or click a location on a map.
3. Drop a pin and see latitude/longitude.
4. Enter manual land details.
5. Generate a 0–100 development feasibility score.
6. Read a plain-English explanation of the score.
7. See strengths, red flags, and unknowns.
8. Save the site locally.
9. Compare saved sites.
10. View and print a simple site report.

The score uses an agreed **hybrid gate + weighted score** model. First, hard gates screen for conditions serious enough to send the parcel straight to manual diligence. Then a 13-category weighted score ranks the survivors.

### Hard gates (any one → "Manual diligence required" verdict, no numeric rank)

- Use not permitted or entitlement path unclear
- No legal access / no viable frontage
- Mapped regulatory floodway in likely buildable core
- No viable water / sewer / septic path
- Severe on-site contamination flag *(not yet wired)*
- Critical habitat / regulatory resource overlap requiring specialist review *(not yet wired)*
- Net developable acreage below minimum viable yield for the intended product

### Weighted core categories (weights sum to 100)

| Category | Weight | Source status |
| --- | ---: | --- |
| Zoning & entitlement fit | 12 | User-supplied zoning notes (official zoning atlas is a planned adapter) |
| Net developable acreage & yield | 9 | User-supplied gross acres (parcel-wide overlays are a planned later phase) |
| FEMA floodplain & floodway | 10 | FEMA NFHL (live) |
| Wetlands, waters & buffers | 10 | FWS NWI (live) |
| Slope, relief & pad area | 8 | USGS 3DEP / EPQS (live) |
| Utilities availability & capacity | 10 | EPA SDWIS water service areas (live) + user-supplied |
| Access, frontage & roadway context | 7 | Census TIGERweb (live) + user frontage |
| Soils & geotech suitability | 8 | USDA NRCS SSURGO / Soil Data Access (live, point-based) |
| Stormwater & outfall feasibility | 7 | USGS 3DEP drainage proxy (live, 8-direction elevation analysis) |
| Easements, encumbrances & ROW | 5 | Local GIS adapter framework (registry-based; ALTA/title when no adapter) |
| Environmental contamination | 5 | EPA Facility Registry Service (live, 1 km buffer) |
| Species, critical habitat & historic | 4 | USFWS ECOS Critical Habitat (live, point intersection) |
| Market support & absorption | 5 | Census ACS 5-year population trend + Census BPS building permits (live with API key) |

### Modifiers

- **Regional hazard modifier:** 0 to −5 from NOAA sea-level rise (−3 for inundation hit), USFS wildfire hazard potential (0 to −4 by WHP class), and EPA radon zones (−2 for Zone 1). Total clamped to [−5, 0]. May be unavailable due to CORS limitations.
- **Confidence penalty:** 0 to −10 scaled by the number of categories with no source at all. With all 13 categories wired (easements may still be unavailable when no local adapter is registered), the penalty is typically 0–3.

### Verdict bands

| Score | Verdict |
| --- | --- |
| 85–100 | Strong shortlist candidate |
| 70–84 | Viable — needs targeted diligence |
| 50–69 | Challenged — only if pricing/assemblage is exceptional |
| Below 50 | Low priority / likely reject |
| Any hard gate triggered | Manual diligence required |
| Less than 50% weighted evidence | Not enough verified data; no numeric score |

The principle is unchanged from the original MVP: **never fabricate.** Categories without a wired official source are shown as unavailable or user-supplied and excluded from the weighted calculation until a real source is wired. The ≥50% weighted evidence rule still gates whether any numeric score is shown.

## Original MVP decisions — June 22, 2026

These decisions describe the first Texas-only release and are retained as project history. The nationwide expansion below supersedes its geography and sample-data decisions.

- MVP geography: **Texas only**.
- Visual direction: polished light interface with deep green, slate, cream, and amber accents.
- Initial map: Texas, with the map constrained to the state and a visible state outline.
- Basemap and search: public OpenStreetMap-based services requiring no API key are acceptable.
- Samples: include clearly marked sample Texas sites so comparison works immediately.
- Unknowns: unknown values score neutrally but lower a separate data-confidence rating and create research warnings.
- Technical foundation: React, TypeScript, Vite, Leaflet, and browser local storage.
- Reports: browser report and print/save-to-PDF support now; dedicated PDF generation later.
- Data architecture: MVP mock values must be isolated behind a provider boundary so official sources can replace them later.

## Four-part coding plan and status

### Part 1 — Foundation and Texas Map Explorer — Complete

Planned:

- Scaffold the React/TypeScript browser app.
- Establish the visual system and responsive application shell.
- Build a Texas-focused interactive map.
- Add Texas address/location search, click selection, draggable pin, coordinates, and basic layers.
- Start this living project record.

Completed:

- Created the Vite + React + TypeScript project from an empty workspace.
- Added Leaflet/react-leaflet and Lucide icons.
- Built the responsive LandLens shell and Texas-branded navigation.
- Added street and terrain layers, Texas bounds/outline, map click selection, draggable pin, latitude/longitude display, and OpenStreetMap/Nominatim search.
- Added honest map/search attribution.
- Created this record and connected it from the README.

### Part 2 — Inputs, Score, Explanations, and Red Flags — Complete

Planned:

- Build all requested manual site inputs.
- Add replaceable mock data providers.
- Implement the transparent weighted score and verdicts.
- Add plain-English explanations, strengths, risks, unknowns, and confidence.

Completed:

- Added site name, acres, location, price, intended use, frontage, utilities, zoning notes, and personal notes.
- Implemented deterministic coordinate-seeded mock flood, slope, road, and demographic results.
- Implemented the agreed weighted scoring model and verdict thresholds.
- Manual inputs affect road and site-readiness scores.
- Added data-source labels: Modeled, User supplied, and Unknown.
- Added a separate preliminary confidence score.
- Added beginner-friendly metric explanations, strengths, red flags, unknowns, and due-diligence disclaimer.

### Part 3 — Saved Sites and Comparison — Complete

Planned:

- Save sites and analyses in browser local storage.
- Add seeded sample sites.
- Add a side-by-side comparison table.

Completed:

- Added local create, update, open, and delete behavior.
- Saved records include coordinates, all manual inputs, notes, final score, complete breakdown, findings, and timestamps.
- Added three labeled sample sites in Austin, San Antonio, and Dallas on first use.
- Added desktop comparison table and mobile comparison cards with the requested columns and report/open/delete actions.

### Part 4 — Report, Polish, and Verification — Complete

Planned:

- Build a selected-site report.
- Add responsive and print styling.
- Verify the production build and code quality.

Completed:

- Added a report containing site identity, coordinates, interactive map preview, final score, weighted breakdown, findings, supplied facts, notes, and next research steps.
- Added print/save-to-PDF browser support.
- Added mobile navigation and responsive map, form, comparison, and report layouts.
- Added application title, description, theme color, and LandLens favicon.
- Verified `npm run build` and `npm run lint` successfully.

## Current data truth and limitations

- **Public-source point observations:** FEMA NFHL flood zone, USGS 3DEP local elevation samples and derived slope, Census TIGERweb mapped-road proximity, and FWS NWI wetland intersection.
- **Optional public-source trend:** 2019–2024 ACS 5-year tract population change when a Census API key is configured.
- **User supplied:** acres, price, intended use, stated road frontage, stated utility proximity, zoning notes, and personal notes. These are not independently verified.
- **Never fabricated:** if an official service fails, lacks coverage, or is not configured, its category is shown as unavailable and excluded from the weighted calculation. LandLens requires at least 50% weighted evidence before displaying an overall score.
- **Parcel coverage:** exact point-in-polygon matches are connected for AK, AR, CO, CT, DE, FL, HI, ID, IN, MA, ME, MN, MT, NC, ND, NE, NH, NJ, NY, OH, TN, UT, VT, WA, WV, and WI through official statewide or statewide-mosaic services. Texas has verified local coverage from Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, and Tarrant sources. State mosaics can contain local gaps. Name and assessor acreage are filled only from returned official fields; when acreage is absent, LandLens calculates mapped acreage from the returned official polygon and labels it as mapped.
- **Unavailable:** authoritative nationwide parcel boundaries, parcel ownership verification, legal access, zoning, utility capacity, comparable sales, project-specific market feasibility, and net buildable acreage.
- **All 13 scoring categories are now wired to data sources.** Stormwater uses a USGS drainage proxy. Easements uses a local adapter framework that returns "unavailable — title/ALTA required" when no local GIS adapter is registered for the jurisdiction.
- **Important remaining limitation:** soils, stormwater, and easements are point-based screens (not parcel-wide overlays). Setbacks and buffers are not yet subtracted from net developable acreage. The grid sampling approach is a screening approximation, not survey-grade. Several federal APIs may have CORS limitations when called directly from the browser; a backend proxy would resolve these for production.
- Public geocoding and tile services have usage policies and are suitable for this demo, not an unbounded production workload. Production should use an appropriately licensed provider or hosted service.

## Prepared future integrations

The official-data provider, scoring layer, and parcel-provider interface are separate from the UI. Future integrations can add:

- State/county parcel GIS or a licensed national parcel provider
- Parcel-wide FEMA, NWI, and terrain overlays with net-buildable-area calculations
- USDA SSURGO soils, hydric-soil, septic suitability, and shrink/swell screening
- Local zoning and future-land-use data
- Recorded easement, access, and road-authority data
- Census Building Permits, employment, income, supply, and absorption signals by intended use
- Home values, land sales, and market data

## Recommended next backlog

1. ~~Run FEMA, wetlands, terrain, setbacks, and easement overlays across the loaded parcel to calculate net buildable acreage.~~ **Done for FEMA/NWI/slope (Phase 3). Setbacks and easements still need local GIS adapters.**
2. Add a backend cache/proxy for public services, rate limiting, monitoring, and credentials. This would resolve CORS limitations for USDA SDA, EPA FRS, USFWS ECOS, NOAA SLR, USFS WHP, and EPA radon.
3. Add USDA SSURGO ~~soils and~~ subtract hydric/severe soils from net developable acreage. ~~A net-buildable-acre calculation that subtracts floodway, wetlands, steep slope, setbacks, and easements.~~ **Soils adapter wired (Phase 4). Parcel-wide soil overlays and net-buildable subtraction still needed.**
4. ~~Add EPA Envirofacts / UST Finder for contamination screening and USFWS IPaC / ECOS for species/historic screening.~~ **Done (Phase 4).**
5. Add zoning/future-land-use and utility-capacity adapters jurisdiction by jurisdiction. **Local adapter framework in place (Phase 6); register specific jurisdictions as needed.**
6. Add intended-use-specific market and financial models instead of using population and permits as the sole market signals.
7. ~~Add automated provider-contract tests and browser tests for the critical map-save-compare-report flow.~~ **49 automated tests added (Phase 7): geometry, scoring, storage migration, local adapter registry. Browser E2E tests still deferred.**
8. ~~Add NOAA sea-level rise, USFS wildfire risk, and EPA radon as a 0 to −5 regional hazard modifier.~~ **Done (Phase 5).**
9. Register local easement/ROW adapters for high-priority jurisdictions (e.g. major Texas counties, Florida, California).
10. Add parcel-wide soils and stormwater overlays to complement the existing FEMA/NWI/slope parcel overlays.

## Change log

### 2026-06-24 — Stormwater adapter, local jurisdiction framework, and automated tests (Phase 6 + 7)

- **Stormwater (USGS 3DEP drainage proxy):** created `src/data/stormwaterProvider.ts` that samples USGS EPQS elevations in 8 directions (N/NE/E/SE/S/SW/W/NW) around the selected point and computes dominant drainage direction, slope-to-low-point, flatness index, positive-outfall detection, and detention suitability. Scores as good/moderate/challenging/unknown. This is a screening proxy, not a civil stormwater concept or outfall survey — local stormwater criteria and a civil concept plan are still required.
- **Local jurisdiction adapter framework:** created `src/data/localAdapters.ts` with a pluggable registry pattern for local GIS adapters (easements, zoning atlases, utility capacity). Adapters declare their jurisdiction, state, bounds, and a query function. `fetchEasements` checks the registry for the point's jurisdiction and uses the adapter if one exists. When no adapter is registered, the category shows as unavailable with a clear explanation that title commitment and ALTA survey are the authoritative source. This framework is extensible — new local adapters can be registered without changing the scoring or UI code.
- **Easements category:** now uses the local adapter framework. When no local adapter covers the point (the common case), it shows as unavailable with provenance pointing to ALTA/title as authoritative. When a local adapter is registered and returns data, it scores based on whether recorded easements are present.
- Extended `OfficialSiteData` with `stormwater` and `easements` fields. Extended `OfficialCategory` to 12 categories. Updated `fetchOfficialSiteData` to run all 12 sources in parallel. The function now accepts an optional `stateCode` parameter for the easements local adapter lookup.
- Updated `scoring.ts`: replaced `notYetWired('stormwater')` and `notYetWired('easements')` with real `stormwaterMetric` and `easementsMetric` functions. **All 13 scoring categories are now wired to data sources.** The only category that can still show as "unavailable" is easements when no local GIS adapter is registered for the jurisdiction — this is honest behavior, not a missing implementation.
- Updated `App.tsx` `sourcesPending` count from 10 to 12. Updated ScorePanel loading message and parcel-wide note.
- **Automated tests (Phase 7):** installed vitest with jsdom environment. Created 4 test files with 49 tests:
  - `src/lib/geometry.test.ts` (17 tests): point-in-polygon, holes, MultiPolygon, bbox, area, grid sampling, ArcGIS conversion, unit conversions
  - `src/lib/scoring.test.ts` (25 tests): weights sum to 100, 13 categories, basic scoring, all 7 hard gates, zoning regex edge cases, parcel overlays, regional hazard modifier (clear/SLR/clamped), verdict bands
  - `src/lib/storage.test.ts` (5 tests): empty state, save/load, legacy v1 migration (13 categories, inputs preserved, v1 cleared), idempotent migration
  - `src/data/localAdapters.test.ts` (2 tests): registry starts empty, registers and queries adapters
- Added `npm run test` and `npm run test:watch` scripts to package.json.
- Verified `npm run build`, `npm run lint`, `npm run test`, and `tsc -b` all pass.

### 2026-06-24 — Regional hazard modifier (Phase 5)

- Wired the regional hazard modifier (0 to −5) with three national screening sources: NOAA sea-level rise, USFS wildfire hazard potential, and EPA radon zones.
- Created `src/data/regionalHazardProvider.ts` with three hazard adapters:
  - **NOAA Sea-Level Rise:** queries the NOAA SLR ArcGIS REST service for 1.5 ft (0.46m) inundation at the point. Returns "severe" (penalty −3) if the point is within the projected inundation polygon, "none" otherwise. Only applies to coastal areas.
  - **USFS Wildfire Hazard Potential:** queries the USFS WHP 2024 ArcGIS REST service for the wildfire hazard class at the point. Scores 0 (none) through −4 (very high) based on the WHP class index.
  - **EPA Radon Zones:** queries the EPA radon zone ArcGIS REST service for the county-level radon zone. Zone 1 (highest, ≥4 pCi/L) applies a −2 penalty and a red flag recommending radon-resistant construction.
- Total penalty is the sum of individual hazard penalties, clamped to [−5, 0]. The modifier is applied to the raw weighted score alongside the confidence penalty to produce the final score.
- Updated `analyzeSite()` to accept an optional `RegionalHazardData` parameter. When hazard data is available, the modifier reflects real screening results instead of the placeholder 0. When unavailable (CORS or service failure), the modifier stays 0 and an unknown is pushed explaining the limitation.
- Updated `App.tsx` with a new effect that fetches regional hazards alongside official data on each coordinate change. Updated all `analyzeSite` calls to pass hazards. Reset hazards on coordinate/state/site changes.
- Updated `ScorePanel` modifier card to show each hazard source individually with its penalty and an icon (Waves/Flame/Atom). Penalty values are highlighted in red when active. Falls back to the single-line modifier display when hazards aren't available.
- Added red flags for severe sea-level rise inundation, high/severe wildfire hazard, and EPA Radon Zone 1.
- Updated unknowns to describe which hazard sources returned data or failed.
- Verified `npm run build`, `npm run lint`, `tsc -b` all pass. Runtime-tested with 7 scenarios: no-hazards, all-clear, sea-level rise hit (−3), wildfire severe (−4), radon Zone 1 (−2), all hazards combined (clamped to −5), and CORS-unavailable fallback.

### 2026-06-24 — National adapters for soils, contamination, species, utilities, and permits (Phase 4)

- Wired five new national federal data adapters, moving 5 of 13 scoring categories from "not yet wired" to official sources. Only stormwater and easements remain not-yet-wired.
- **Soils (USDA NRCS SSURGO / Soil Data Access):** queries the SDA POST REST endpoint with a spatial SQL query using SQL Server `geography::Point()` to find the dominant soil map unit at the selected point. Extracts drainage class, hydric class, septic tank absorption field rating, and dwelling without basements rating. Scores severe/moderate/slight and flags hydric soils. NRCS soils are mapped interpretations, not borings — a geotech report and perc testing remain required.
- **Contamination (EPA Facility Registry Service):** queries the EPA FRS ArcGIS REST service for regulated facilities within a 1,000-meter buffer of the selected point. Returns facility count, types (RCRA, CERCLA, TRI, NPDES, UST, etc.), and whether any have major hazardous/toxic program flags. The contamination hard gate now triggers when major flags are present. EPA FRS may have CORS limitations from the browser; when it does, the category shows as unavailable and a Phase I ESA remains the diligence standard.
- **Species / Critical Habitat (USFWS ECOS):** queries the USFWS ECOS ArcGIS REST service for critical habitat polygon intersection at the point. Returns whether the point hits critical habitat, the species names, and the layer count. The species-historic hard gate now triggers on a critical habitat hit. IPaC's standard resource list is informational and not official consultation.
- **Utilities (EPA SDWIS Public Water System Service Areas):** queries the EPA water service area ArcGIS REST service to check whether the point is within a mapped public water system service area. Returns the PWS name and ID. Falls back to user-supplied utilitiesNearby when EPA data is unavailable. EPA explicitly states service area boundaries may differ from actual service areas.
- **Market — Building Permits (Census BPS):** queries the Census Building Permits Survey API for county-level annual permit totals, normalizes to permits per 1,000 population using ACS, and computes a year-over-year permit trend. The market metric now composites ACS population growth (60% weight) and BPS permit trend (40% weight) when both are available, or uses either alone. Requires `VITE_CENSUS_API_KEY`.
- Created `src/data/nationalAdapters.ts` with all five adapter functions, each following the existing `OfficialObservation<T>` pattern with provenance, timeouts, and honest unavailable states.
- Extended `OfficialSiteData` with `soils`, `contamination`, `species`, `utilityService`, and `bps` fields. Updated `OfficialCategory` to include the five new categories. Updated `fetchOfficialSiteData` to run all 10 sources in parallel with progressive delivery.
- Updated `scoring.ts`: new `soilsMetric`, `contaminationMetric`, `speciesMetric` functions; `utilitiesMetric` now accepts and prefers official EPA water service area data; `marketMetric` now composites ACS + BPS. Updated hard gates for contamination and species-historic to trigger from official data instead of always returning `false`. Updated strengths and red flags for all new categories.
- Updated `App.tsx` `sourcesPending` initial count from 5 to 10. Updated ScorePanel loading message to list all 10 sources.
- Each adapter degrades gracefully: if a federal API has CORS restrictions or is offline, the category shows as unavailable with an explanation. No data is ever fabricated.
- Verified `npm run build`, `npm run lint`, `tsc -b` all pass. Runtime-tested with 10 scenarios: no-adapters fallback, all-good (score 97, confidence 79), severe soils, contamination gate, species gate, combined ACS+BPS market, BPS-only market, utility fallback to user input, weights sum to 100, and only 2 categories remain not-yet-wired (stormwater, easements).

### 2026-06-24 — Parcel-wide overlays (Phase 3)

- When a parcel boundary is loaded, LandLens now runs parcel-wide FEMA NFHL, FWS NWI, and USGS 3DEP/EPQS overlays instead of point-only screens for the floodplain, wetlands, and slope categories.
- Added `src/lib/geometry.ts` with dependency-free point-in-polygon (ray casting with hole support), boundary bounding box, adaptive grid sampling, spherical polygon area, and ArcGIS REST polygon JSON conversion utilities.
- Added `src/data/parcelOverlayProvider.ts` with three parcel-wide overlay fetchers:
  - **FEMA floodplain overlay**: queries NFHL MapServer/28 with the parcel polygon as geometry, returns intersecting flood hazard zone polygons, then tests a 400-point interior grid against each polygon to compute SFHA fraction, floodway fraction, and whether floodway intersects the buildable core.
  - **NWI wetlands overlay**: queries the Wetlands MapServer with the parcel polygon, returns intersecting wetland polygons, tests the same grid to compute wetland coverage fraction and wetland-type counts.
  - **USGS slope overlay**: samples a 25-point adaptive elevation grid across the parcel (limited to 6 concurrent EPQS API calls), computes slope from adjacent grid-cell elevation gradients, and reports mean, p90, max slope, and fractions over 15/20/30%.
- Added a **net developable acreage** calculation that subtracts the union of floodway, wetlands, and steep slope (>20%) from gross parcel acres, producing net developable acres, net-to-gross ratio, and per-constraint acreage breakdown. Uses the independence approximation for the union (`1 - (1-a)(1-b)(1-c)`) which slightly overestimates overlap but is conservative for screening.
- Updated `analyzeSite()` to accept an optional `ParcelOverlayData` parameter. When overlays are available, the floodplain, wetlands, slope, and net-developable metrics use parcel-wide official data instead of point screens. Point-based data is still used as fallback when overlays are unavailable or still loading.
- Updated the floodway-in-core hard gate to trigger from parcel-wide floodway intersection (not just point-based floodway). Updated the net-yield hard gate to compare **net developable acres** (not gross) against the minimum viable yield floor when overlays are available.
- Updated strengths, red flags, and unknowns to reflect parcel-wide results. The point-screen note in ScorePanel now reads "Parcel-wide overlays active" when overlays are loaded. Next steps shift from "run parcel overlays" to "add soils, stormwater, easements, and contamination overlays."
- Added a parcel-overlay loading indicator in the ScorePanel that shows while FEMA/NWI/slope overlays are running.
- Storage migration updated to pass `null` for overlays on legacy sites. Opening a migrated site triggers a fresh parcel lookup and overlay fetch that repopulates parcel-wide data.
- Verified `npm run build`, `npm run lint`, and `tsc -b` all pass. Runtime-tested scoring with six overlay scenarios (all-clear, floodway, heavy wetlands, steep slope, tiny net yield, partial overlay failure), geometry utilities (point-in-polygon, holes, MultiPolygon, bbox, area, grid sampling, ArcGIS conversion), and legacy storage migration.

### 2026-06-24 — Hybrid gate + 13-category weighted score framework

- Replaced the original 6-category weighted score (flood/slope/road/demographics/environmental/manual, summing to 100) with the agreed hybrid gate + 13-category weighted score model from the LandLens Feasibility Metrics and Data Architecture report.
- Added seven hard gates that route a parcel to "Manual diligence required" regardless of the weighted score: use-permitted, legal-access, floodway-in-core, utility-path, contamination, species-historic, and net-yield. Contamination and species-historic gates are now wired to EPA FRS and USFWS ECOS respectively (Phase 4).
- Reorganized FEMA flood, NWI wetlands, USGS slope, TIGER roads, and ACS population into renamed categories (floodplain, wetlands, slope, access, market) with new weights of 10, 10, 8, 7, and 5.
- Added user-supplied categories for zoning (12), net developable acreage (9), and utilities (10) that derive a subscore from zoning notes, gross acres, and the utilities-nearby answer respectively, with explicit "user-supplied, not verified" provenance.
- Added five not-yet-wired categories — soils, stormwater, easements, contamination, species — that always render as unavailable in this phase, with explanations of the planned adapter (NRCS SSURGO, DEM flow analysis, local GIS, EPA Envirofacts, USFWS IPaC / NPS / SHPO).
- Added a regional hazard modifier slot (0 to −5) for sea-level rise, wildfire, and radon. Not yet wired; always 0 in this phase.
- Added a confidence penalty (0 to −10) scaled by the number of categories with no source at all. With five not-yet-wired national adapters, the penalty in this phase is typically −8.
- Updated verdict bands to Strong shortlist candidate / Viable — needs targeted diligence / Challenged / Low priority / Manual diligence required, and added a `manual` verdict tone.
- Added a hard-gate banner to the analysis panel, a gates section to the browser report, a regional-hazard + confidence-penalty modifier card, and a printable "lowest-regret manual diligence checklist" to the report (ALTA survey, title, zoning verification, wetland delineation, floodplain review, utility will-serve letters, geotech borings, perc testing, Phase I ESA, civil/stormwater concept, SHPO scoping).
- Expanded the saved-sites comparison table to eight weighted categories (zoning, net developable, floodplain, wetlands, slope, utilities, access, market) plus score and verdict.
- Migrated browser-local storage to `landlens.saved-sites.v2`. Legacy v1 sites are detected by their 6-category analysis shape and re-derived from their saved inputs (coordinates, acres, frontage, utilities, zoning notes) using the new `analyzeSite()` so the comparison view renders valid new-shape metrics. Old official-source observations are not retained on saved sites; opening a migrated site triggers a fresh official-source fetch that repopulates the analysis.
- Updated README MVP capabilities list to reflect the new framework.
- Verified `npm run build`, `npm run lint`, and `tsc -b` all pass cleanly, and ran runtime sanity checks across empty inputs, all four wired hard gates (no-frontage, no-utilities, floodway, sub-minimum-acreage), prohibited-zoning detection, all-official-good scoring, and legacy storage migration (idempotent, inputs preserved, v1 key cleared).

### 2026-06-23 — Broad public parcel expansion

- Audited national ArcGIS catalogs and state GIS service directories, accepting only government, university/state GIS clearinghouse, or explicitly authoritative public parcel compilations.
- Expanded from 2 local adapters to 34 verified adapters covering 27 states: AK, AR, CO, CT, DE, FL, HI, ID, IN, MA, ME, MN, MT, NC, ND, NE, NH, NJ, NY, OH, TN, TX, UT, VT, WA, WV, and WI. Texas now includes Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, and Tarrant coverage sources.
- Added exact object-ID-first point queries followed by a single-polygon fetch. This avoids loading statewide feature records and reduced several tested services from tens of seconds to sub-second or low-single-digit responses.
- Added mapped-acre calculation from official GeoJSON polygons when no trustworthy acreage attribute exists. Assessor acreage remains preferred and is labeled separately.
- Added fallback adapter sequencing, per-service timeouts, retry behavior, source-specific provenance, record vintage when returned, and explicit distinctions between unsupported, local coverage gaps, overlapping records, identifierless composites, and temporary service failures.
- Rejected non-authoritative copies, parcel-centroid-only layers, PLSS sections, public-land-only layers, and incomplete hazard-only parcel subsets.

### 2026-06-23 — Analysis-first workflow and verified parcel selection

- Made Analysis the first/default panel and moved Site inputs to the second tab.
- Changed official-source loading to progressive delivery: the score appears once at least 50% weighted evidence is ready, while slower sources continue updating visibly.
- Parallelized retry-protected USGS elevation samples and added ten-minute coordinate caches for repeat analysis and parcel lookups.
- Added an extensible verified parcel-provider registry with exact point-in-polygon matching; no nearest-parcel guessing is allowed.
- Added Travis County Tax Maps and City of Dallas GIS certified tax parcel adapters.
- Added a distinct orange parcel outline, automatic parcel zoom, match/unsupported/right-of-way states, and source-backed parcel name and acreage autofill without overwriting user-entered values.
- Persisted parcel geometry with saved sites and added the boundary and acreage disclaimer to browser reports.
- Browser-tested the Texas Capitol (24.5 assessor acres), Dallas City Hall campus (16.02 mapped acres), unsupported California coverage, right-of-way clicks, rapid state changes, progressive analysis, reports, scrolling, and console errors.

### 2026-06-22 — Removed misleading unknown-as-50 behavior

- Changed unavailable metrics from a neutral 50 to a true unscored state shown as an em dash.
- Replaced the transient 50 after a map click with a dedicated live-source loading screen.
- Normalized the overall result across verified categories only and require at least 50% weighted evidence before showing any overall number.
- Added visible evidence coverage and a “Promising, limited evidence” verdict so a high partial score cannot masquerade as a high-confidence strong candidate.
- Added source retries and sequential USGS elevation sampling to reduce intermittent terrain failures.
- Verified direct map clicks produce loading → score or loading → unscored, never loading → fabricated 50. Verified Austin and Dallas return distinct source-backed scores.

### 2026-06-22 — Official source-backed screening

- Removed the coordinate-seeded mock provider and all fabricated metric generation.
- Added independent live adapters for FEMA NFHL flood zones, USGS 3DEP local slope, Census TIGERweb road proximity, optional ACS tract population trend, and FWS NWI wetlands.
- Added per-metric source links, vintage/coverage notes, loading state, timeouts, and honest unavailable states with no synthetic fallback.
- Rebalanced the score to include mapped wetlands as a distinct 20% factor; a regulatory floodway or mapped wetland point hit caps the preliminary score below 50 pending review.
- Separated mapped-road proximity from legal frontage and made the limitation explicit.
- Added a point-versus-parcel warning, screening-area record type, and a parcel-provider interface. No fake national parcel boundary is substituted because parcel authority is local and fragmented.
- Browser-tested a low-hazard Texas point and a FEMA AE coastal Louisiana point, including live cross-origin source calls and console errors.

### 2026-06-22 — Nationwide state expansion

- Replaced the Texas-only map with a shared state-aware boundary and selection engine for all 50 states.
- Added a persistent state selector, state-scoped search, per-state camera fitting, and accurate multipolygon handling for coastal states, Alaska, and Hawaii.
- Removed seeded sample sites and added migration that deletes old sample records while preserving user-created sites.
- Stored each site's state so opening a saved analysis restores the correct map automatically.
- Replaced Texas-specific product copy and metadata with nationwide language.
- Ran an automated browser gauntlet across all 50 states, plus focused Alaska, Hawaii, Rhode Island, and Florida geometry checks and a cross-state save/open/delete test.
- Made map clicks and marker drags geography-aware: selecting a point in a different state now changes the state context automatically, while the dropdown remains the direct state-navigation control.

### 2026-06-22 — MVP v1 created

- Recorded the original product philosophy, scoring, page requirements, and Texas-only clarifications.
- Implemented all four MVP coding parts.
- Confirmed production TypeScript build and ESLint pass.
