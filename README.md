# LandLens

LandLens is a browser-based US land intelligence MVP. It helps users decide whether a site is interesting enough for deeper development research without presenting the result as a final investment or development decision.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. A production build can be generated with `npm run build`.

```bash
npm run test       # run 88 unit/provider tests
npm run lint       # eslint
npm run build      # tsc + vite build
npm run test:e2e   # browser save → compare → report regression test
npm run verify:providers # live FEMA, USGS, Austin zoning, and Austin Energy contracts
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
- Live FEMA flood-zone, USGS terrain, Census road, FWS wetland, USDA soils, EPA contamination, USFWS critical habitat, EPA water service area, Census building permits, USGS stormwater drainage, and local easement screening
- Parcel-wide overlays: when a parcel boundary is loaded, FEMA floodplain %, NWI wetland %, USGS slope stats, NRCS hydric/severe-soil %, USGS-3DEP parcel drainage, local easement/ROW intersection (where a local adapter is registered), EPA FRS contamination facility count, USFWS critical-habitat % intersect, perimeter setbacks (intended-use-aware), and net developable acreage are computed across the full parcel
- Analysis-first workflow with progressive results as 14 official and local sources return
- Hybrid gate + 13-category weighted feasibility score with hard-gate manual-diligence routing, regional hazard modifier (sea-level rise, wildfire, radon), and confidence penalty
- All 13 scoring categories wired to data sources — no fabricated values, no neutral fallbacks
- Exact parcel outlining and source-backed name/acreage autofill across 35 states through 55 verified public adapters
- Optional Census ACS population trend with a free Census API key
- Manual land details, source provenance, and transparent weighted scoring
- Plain-English metric explanations, strengths, red flags, unknowns, and confidence
- Browser-local saved sites with no preset records
- Side-by-side site comparison across eight weighted categories
- Browser report with map preview, hard-gate findings, and a printable manual-diligence checklist
- Honest unavailable categories when no official source is wired yet — never fabricated
- No neutral “50” fallback: unknown categories are excluded and the app waits for at least 50% verified evidence before showing an overall score
- Extensible parcel-provider registry with fast two-stage ArcGIS queries and honest gap/offline states
- First local entitlement/utility adapters: City of Austin zoning atlas and Austin Energy service-area screening, with explicit legal/capacity caveats

Search and map tiles use public OpenStreetMap-based services. State boundaries are derived from U.S. Census Bureau cartographic data distributed by `us-atlas`. The analysis reads FEMA NFHL, USGS 3DEP elevation, Census TIGERweb Transportation, and FWS National Wetlands Inventory services directly. Population trend uses 2019 and 2024 ACS 5-year tract estimates when `VITE_CENSUS_API_KEY` is configured; copy `.env.example` to `.env` and add a free Census API key.

Verified statewide or statewide-mosaic parcel sources are currently connected for **AK, AR, CO, CT, DE, FL, HI, IA, ID, IN, MA, MD, ME, MN, MT, NC, ND, NE, NH, NJ, NY, NV, OH, OR, RI, TN, UT, VA, VT, WA, WV, WI, and WY**, plus local official coverage from **Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, and Tarrant** sources in Texas, **Maricopa County** in Arizona, **Mobile County** in Alabama, **DeKalb County** in Georgia, **Lake County** in Illinois, **Jefferson County** in Kentucky, **Baton Rouge** in Louisiana, **Ottawa County** in Michigan, **Kansas City** in Missouri, **Doña Ana County** in New Mexico, **Canadian County** in Oklahoma, **Chester and York Counties** in Pennsylvania, **York County** in South Carolina, and **Minnehaha County** in South Dakota. This is 35 states through 55 adapters; California, Kansas, and Mississippi remain unsupported. Local participation and update dates vary, so even a supported state can contain gaps. Parcel outlines are not surveys, and public-source results do not establish buildable acreage, legal access, jurisdictional wetlands, survey-grade topography, zoning, utility capacity, or market feasibility. Unsupported and offline coverage is labeled explicitly; LandLens never invents a boundary.

## Project record

The agreed plan, decisions, implementation history, validation, and deferred work are maintained in [docs/PROJECT_RECORD.md](docs/PROJECT_RECORD.md).
