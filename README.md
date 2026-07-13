# LandLens

LandLens is a browser-based US land intelligence MVP. It helps users decide whether a site is interesting enough for deeper development research without presenting the result as a final investment or development decision.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. A production build can be generated with `npm run build`.

```bash
npm run test       # run 193 unit/provider/component tests
npm run lint       # eslint
npm run build      # tsc + vite build
npm run test:e2e   # browser save → compare → report regression test
npm run verify:providers # 79 live national/local, jurisdiction, parcel, and schema contracts
npm run verify:architecture # keep jurisdiction-specific logic isolated behind packs
npm run audit:parcel-facts # compare registered public fields with live service schemas
```

## Production data proxy

Public GIS services are intentionally accessed through one client boundary. For a production deployment, run the included proxy alongside the static app and set `VITE_DATA_PROXY_URL` to its `/api/data` endpoint at build time:

```bash
npm run proxy
VITE_DATA_PROXY_URL=https://data.example.com/api/data npm run build
```

`server/data-proxy.mjs` only permits LandLens provider hosts, adds a five-minute bounded cache, applies a per-client rate limit, rejects oversized requests, and exposes `/health`. Set `LANDLENS_ALLOWED_ORIGIN` to the deployed frontend origin and use platform-managed logging/monitoring. The proxy is a reliability layer, not an authorization to reuse any provider beyond its terms of service.

## MVP capabilities

- All 50 states with accurate state boundaries, state-scoped address search, street/terrain layers, click selection, and a draggable pin
- Nineteen progressive official/local observations spanning FEMA, USGS, Census, USFWS, USDA, EPA, FCC reference context, PAD-US, BTS rail, regional hazards, zoning, utilities, easements, and authority resolution
- Parcel-wide overlays: FEMA floodplain %, NWI wetland %, USGS slope stats, NRCS hydric/severe-soil %, USGS-3DEP parcel drainage, local easement/ROW intersection, EPA FRS contamination, USFWS critical habitat, and intended-use-aware perimeter setbacks
- Exact screening buildable envelope: floodway, wetlands, interpolated slope over 20%, mapped easement/ROW polygons, and setbacks are unioned cell-by-cell on one deterministic parcel grid so overlaps count once. Soil shares and title-only easement flags are visibly separated as non-spatial aggregate adjustments
- Hybrid gate + 14-category weighted feasibility score, calibrated so 50 is an average parcel: clean screens score near-average, 75+ requires affirmative verified strength, with hard-gate manual-diligence routing, a weighted regional-hazards category (sea-level rise, wildfire, radon), and a weight-scaled confidence penalty
- All 14 scoring categories wired to data sources — no fabricated values, no neutral fallbacks
- Cost of buildable land: price per net-developable acre (falls back to gross acres) with a comparison to the assessor's land value — surfaced in the analysis, the report, the portfolio comparison, and CSV/GeoJSON exports
- Resilient by design: React error boundaries isolate a failure to a single region (map, analysis, report, or portfolio) instead of white-screening, with automatic recovery on navigation; a single corrupt saved record can never take down the whole portfolio
- Exact parcel outlining and source-backed name/acreage autofill through 58 verified public adapters, including new Sonoma County (CA), Wyandotte County (KS), and statewide Mississippi sources
- Fifty-seven enriched parcel adapters plus one audited geometry-only source normalize every usable development-relevant public field they publish; owner names and mailing addresses are intentionally excluded
- Optional Census ACS population trend with a free Census API key
- Manual land details, source provenance, and transparent weighted scoring
- Plain-English metric explanations, strengths, red flags, unknowns, and confidence
- Browser-local saved sites with persisted parcel, jurisdiction, authority, parcel facts, analysis, and buildable-envelope geometry
- Batch screening for up to 100 U.S. coordinate rows per CSV with bounded concurrency, per-row isolation, automatic saving, and identical official/overlay/scoring logic to the interactive workflow
- Portfolio CSV and GeoJSON export, including parcel and screening-envelope geometries and source-backed decision fields
- Side-by-side site comparison across eight weighted categories
- Browser report with map preview, hard-gate findings, and a printable manual-diligence checklist
- Honest unavailable categories when no official source is wired yet — never fabricated
- No neutral “50” fallback: unknown categories are excluded and the app waits for at least 50% verified evidence before showing an overall score
- Extensible parcel-provider registry with fast two-stage ArcGIS queries and honest gap/offline states
- Pack-based local entitlement engine with national architecture guards and source-faithful Austin, Houston, Dallas, and Charlotte packs
- Austin/Travis: jurisdiction classification, zoning overlays, neighborhood-plan future land use, 30 exact uses across the full §25-2-491 matrix, Austin Energy context, and codified RR/SF principal standards
- Houston: full/limited/ETJ authority, no-citywide-zoning behavior, minimum-lot/building-line/historic controls, and use review definitions
- Dallas: base zoning, 13 high-impact overlays, Chapter 51A district-family logic, ForwardDallas sources, and concrete-use review
- Charlotte: official zoning, UDO district-family/overlay logic, petition context, 2040 policy source, and concrete-use review
- Jurisdiction-aware setbacks: recognized Austin base-district front/interior-side/rear values replace generic distances and immediately recompute net developable acreage; special districts and superseding controls stay flagged for manual review
- Austin exact-use screen: an optional concrete-use selector checks 30 high-value residential, commercial, industrial, agricultural, and civic uses across all 38 §25-2-491 base-district columns, preserving permitted, conditional, prohibited, and footnoted/special-review outcomes

Search and map tiles use public OpenStreetMap-based services. State boundaries are derived from U.S. Census Bureau cartographic data distributed by `us-atlas`. The analysis reads FEMA NFHL, USGS 3DEP elevation, Census TIGERweb Transportation, and FWS National Wetlands Inventory services directly. Population trend uses 2019 and 2024 ACS 5-year tract estimates when `VITE_CENSUS_API_KEY` is configured; copy `.env.example` to `.env` and add a free Census API key.

Verified statewide or statewide-mosaic parcel sources are currently connected for **AK, AR, CO, CT, DE, FL, HI, IA, ID, IN, MA, MD, ME, MN, MS, MT, NC, ND, NE, NH, NJ, NY, NV, OH, OR, RI, TN, UT, VA, VT, WA, WV, WI, and WY**, plus local official coverage from **Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, and Tarrant** sources in Texas; **Sonoma County** in California; **Wyandotte County** in Kansas; **Maricopa County** in Arizona; **Mobile County** in Alabama; **DeKalb County** in Georgia; **Lake County** in Illinois; **Jefferson County** in Kentucky; **Baton Rouge** in Louisiana; **Ottawa County** in Michigan; **Kansas City** in Missouri; **Doña Ana County** in New Mexico; **Canadian County** in Oklahoma; **Chester and York Counties** in Pennsylvania; **York County** in South Carolina; and **Minnehaha County** in South Dakota. This is 38 states through 58 adapters. Local participation and update dates vary, so even a supported state can contain gaps. Parcel facts are public assessor/GIS attributes and may be coded or stale; values are not appraisals, recorded frontage is not legal access, and utility descriptors are not capacity commitments. Owner names and mailing addresses are intentionally excluded. Unsupported and offline coverage is labeled explicitly; LandLens never invents a boundary or missing fact.

## Batch CSV format

The saved-sites page accepts up to 100 rows per run. Required headers are `name`, `latitude`, and `longitude`. Optional headers are `intended_use`, `location`, `acres`, `estimated_price`, and `notes`. `intended_use` accepts `residential`, `commercial`, `mixed-use`, `industrial`, or `other`; it defaults to `other`. Each row is independently validated and screened, so one provider or coordinate failure does not discard successful rows.

## Project record

The agreed plan, decisions, implementation history, validation, and deferred work are maintained in [docs/PROJECT_RECORD.md](docs/PROJECT_RECORD.md).
