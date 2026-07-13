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

The score uses an agreed **hybrid gate + weighted score** model. First, hard gates screen for conditions serious enough to send the parcel straight to manual diligence. Then a 14-category weighted score ranks the survivors.

**Score calibration (2026-07-11):** 50 is an average parcel, not a passing grade. 0–25 is a verified hard problem; 25–45 a meaningful constraint; ~50 average; 55–60 a clean point screen; 62–70 a clean parcel-wide verified screen; 75+ requires affirmative verified strength (by-right use in the permitted-use table, sourced water + sewer, net/gross ≥ 90%, strong market). One-sided risk screens (flood, wetlands, contamination, species, easements, hazards) top out in the 60s by design — the absence of a problem is the norm, not excellence.

### Hard gates (any one → "Manual diligence required" verdict, no numeric rank)

- Use not permitted or entitlement path unclear
- No legal access / no viable frontage
- Mapped regulatory floodway in likely buildable core
- No viable water / sewer / septic path
- Severe on-site contamination flag (EPA FRS screen + parcel overlay)
- Critical habitat / regulatory resource overlap requiring specialist review (USFWS ECOS + parcel overlay)
- Net developable acreage below minimum viable yield for the intended product

### Weighted core categories (weights sum to 100)

| Category | Weight | Source status |
| --- | ---: | --- |
| Zoning & entitlement fit | 13 | User-supplied notes + City of Austin official zoning atlas where covered |
| Net developable acreage & yield | 13 | Parcel-wide constraint overlays when parcel geometry is available; user gross acres otherwise (capped below the affirmative range) |
| FEMA floodplain & floodway | 8 | FEMA NFHL (live) |
| Wetlands, waters & buffers | 7 | FWS NWI (live) |
| Slope, relief & pad area | 6 | USGS 3DEP / EPQS (live) |
| Utilities availability & capacity | 11 | EPA SDWIS water service areas (live), Austin Energy service area where covered, + user-supplied |
| Access, frontage & roadway context | 8 | Census TIGERweb (live) + user frontage |
| Soils & geotech suitability | 6 | USDA NRCS SSURGO / Soil Data Access (live, point-based) |
| Stormwater & outfall feasibility | 6 | USGS 3DEP drainage proxy (live, 8-direction elevation analysis) |
| Easements, encumbrances & ROW | 4 | Local GIS adapter framework (registry-based; ALTA/title when no adapter) |
| Environmental contamination | 5 | EPA Facility Registry Service (live, 1 km buffer) |
| Species, critical habitat & historic | 4 | USFWS ECOS Critical Habitat (live, point intersection) |
| Market support & absorption | 5 | Census ACS 5-year population trend + Census BPS building permits (live with API key) |
| Regional hazards (wildfire, SLR, radon) | 4 | NOAA SLR inundation + USFS Wildfire Hazard Potential + EPA radon zones (live; formerly a −5 modifier) |

Net developable acreage owns the *quantity* question (how much usable land survives the constraint union); the individual flood/wetland/slope/soils/easement categories carry reduced weights and act as *severity* signals, which limits double counting between them.

### Modifiers

- **Regional hazards** are now a weighted category (above), not a score modifier. Clean screen ≈ 62; worst combined exposure ≈ 12.
- **Confidence penalty:** 0 to −10 scaled by the total category *weight* with no source at all (≈1 point per 5 unscored weight points), so a missing high-weight category costs more than a missing low-weight one.

### Verdict bands (recentered 2026-07-11)

| Score | Verdict |
| --- | --- |
| 75–100 | Strong shortlist candidate |
| 50–74 | Viable — needs targeted diligence |
| 38–49 | Challenged — only if pricing/assemblage is exceptional |
| Below 38 | Low priority / likely reject |
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
- **Parcel coverage:** 58 verified adapters cover 38 states, including statewide/mosaic sources and targeted county layers. Sonoma County, CA; Wyandotte County, KS; and statewide Mississippi close the former CA/KS/MS gaps. State mosaics and county layers can still contain local gaps. Name and assessor acreage are filled only from returned official fields; when acreage is absent, LandLens calculates mapped acreage from the returned official polygon and labels it as mapped.
- **Normalized parcel facts:** 57 adapters normalize every verified development-relevant public field their source publishes; one geometry-only source is explicitly audited as having no usable public fact fields. Facts persist with saved sites and print in reports. Owner and mailing fields are deliberately excluded.
- **Local entitlement/utility evidence:** source-faithful jurisdiction packs now cover Austin, Houston, Dallas, and Charlotte behind a national pack registry. Austin includes its exact-use matrix and principal RR/SF standards; Houston preserves its no-citywide-zoning framework; Dallas applies Chapter 51A family logic and high-impact overlays; Charlotte applies UDO family/overlay logic. Special districts, superseding controls, plats, deed restrictions, exact capacity, and legal interpretations remain controlling.
- **Unavailable:** authoritative nationwide parcel boundaries, parcel ownership verification, legal access, utility capacity commitments, comparable sales, project-specific market feasibility, and survey/engineering-grade net buildable acreage.
- **All 13 scoring categories are now wired to data sources.** Stormwater uses a USGS drainage proxy. Easements uses a local adapter framework that returns "unavailable — title/ALTA required" when no local GIS adapter is registered for the jurisdiction.
- **Important remaining limitation:** the screening buildable envelope exactly unions all constraints that have cell-level spatial evidence on the shared parcel grid: FEMA regulatory floodway, NWI wetlands/waters, nearest-sample-interpolated slope over 20%, polygon easements/ROW, and setbacks. NRCS only supplies parcel-intersecting component shares through this integration, and some local adapters expose only a recorded-easement flag; those evidence types are transparently applied once as non-spatial aggregate adjustments and are not drawn as fake geometry. Raster cells remain a screening approximation, not survey-grade. Moderate soils are not subtracted. Contamination and critical habitat remain hard gates and are intentionally not land-use takeouts. The allow-listed proxy/cache resolves browser CORS limitations when deployed and configured; provider uptime and data licenses still require monitoring.
- Public geocoding and tile services have usage policies and are suitable for this demo, not an unbounded production workload. Production should use an appropriately licensed provider or hosted service.

## Prepared future integrations

The official-data provider, scoring layer, and parcel-provider interface are separate from the UI. Future integrations can add:

- State/county parcel GIS or a licensed national parcel provider
- Parcel-wide FEMA, NWI, and terrain overlays with net-buildable-area calculations
- USDA SSURGO soils, hydric-soil, septic suitability, and shrink/swell screening
- Additional jurisdiction packs for local zoning, future land use, overlays, and development standards beyond Austin/Travis
- Recorded easement, access, and road-authority data
- Census Building Permits, employment, income, supply, and absorption signals by intended use
- Home values, land sales, and market data

## Recommended next backlog

1. ~~Run FEMA, wetlands, terrain, setbacks, and easement overlays across the loaded parcel to calculate net buildable acreage.~~ **Done for FEMA/NWI/slope (Phase 3). Hydric/severe soils and recorded easements added (Phase 8). Perimeter setbacks added (Phase 12). All six land-use constraints are now subtracted from net developable acreage.**
2. ~~Add a backend cache/proxy for public services, rate limiting, monitoring, and credentials.~~ **Done for the production service boundary (v1): `server/data-proxy.mjs` has an allow-list, bounded cache, request-size limits, timeouts, per-client rate limiting, CORS configuration, and `/health`; deploy it with `VITE_DATA_PROXY_URL`. Platform monitoring and alert routing remain deployment configuration.**
3. Add USDA SSURGO ~~soils and~~ subtract hydric/severe soils from net developable acreage. ~~A net-buildable-acre calculation that subtracts floodway, wetlands, steep slope, setbacks, and easements.~~ **Done (Phase 8): parcel-wide soil overlay and hydric/severe subtraction are wired; moderate soils are not subtracted at the screening stage.**
4. ~~Add EPA Envirofacts / UST Finder for contamination screening and USFWS IPaC / ECOS for species/historic screening.~~ **Done (Phase 4).**
5. Add zoning/future-land-use and utility-capacity adapters jurisdiction by jurisdiction. **Austin/Travis pack completed: live jurisdiction type, zoning, 17 high-impact overlay layers, FLUM, district-family screen, 30 concrete §25-2-491 uses across all 38 base-district columns, principal RR/SF-1/SF-2/SF-3 standards, local setback override, persistence/reporting, and Austin Energy coverage. Water/sewer capacity, legal access, the remaining specialized §25-2-491 uses, and more jurisdictions remain.**
6. Add intended-use-specific market and financial models instead of using population and permits as the sole market signals. **Partially addressed (Phase 10): `marketMetric` is now intended-use-aware — `residential`/`mixed-use` get full BPS permit-trend credit because Census BPS measures residential-structure permits; `commercial`/`industrial`/`other` get a capped permit contribution plus a surfaced unknown recommending an intended-use-specific market study. True intended-use models (commercial rents/vacancy, industrial lease rates/employment) still require a market-data adapter and are deferred.**
7. ~~Add automated provider-contract tests and browser tests for the critical map-save-compare-report flow.~~ **Done and expanded: 161 unit/provider/component tests plus Playwright parcel lookup → exact proposed use → jurisdiction profile → facts → save → compare → report coverage. `npm run verify:providers` runs 19 live checks covering FEMA, USGS, four Austin planning/utility services, and all 12 enriched parcel schemas.**
8. ~~Add NOAA sea-level rise, USFS wildfire risk, and EPA radon as a 0 to −5 regional hazard modifier.~~ **Done (Phase 5).**
9. Register local easement/ROW adapters for high-priority jurisdictions (e.g. major Texas counties, Florida, California). **Travis County, TX easement adapter registered (Phase 8). All eight verified Texas county parcel layers — Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, Tarrant — now have easement adapters registered (Phase 9).**
10. ~~Add parcel-wide soils and stormwater overlays to complement the existing FEMA/NWI/slope parcel overlays.~~ **Done (Phase 8).**
11. ~~Parcel-wide contamination and species overlays (EPA FRS buffer + USFWS critical habitat intersection across the parcel grid).~~ **Done (Phase 9).**
12. ~~Jurisdiction-specific setback overlays for the net developable acreage calculation.~~ **Done and upgraded: front/side/rear edge classification is wired; generic intended-use distances remain the national fallback, while Austin RR/SF-1/SF-2/SF-3 principal base setbacks override them inside mapped full/limited-purpose jurisdiction. Every setback change recomputes net developable acreage. Corner lots and superseding controls remain manual-review items.**
13. ~~Normalize and persist development-relevant assessor parcel attributes.~~ **Done: rich facts from FL/CT/MT/NY and all eight Texas county parcel sources, dedicated explorer/report surfaces, privacy filtering, scoring use for parcel zoning/utilities/frontage, unit contracts, live schema checks, and E2E persistence coverage.**

## Change log

### 2026-07-12 — Price-per-net-acre (land economics)

- **New `src/lib/valuation.ts`**: `computePriceEconomics` derives cost per developable acre from the user's asking price and the parcel's usable acreage. Prefers verified net-developable acreage (`buildableEnvelope.adjustedNetAcres`), falls back to gross acres with an explicit `acreBasis` flag, and returns null when price or acreage is missing/non-positive (guards divide-by-zero on fully constrained parcels). Also computes `priceToAssessedRatio` against the parcel's *land* value (market → appraised → assessed), and ships `formatUsd`/`formatRatio` display helpers. Price never feeds the feasibility score — it is the buyer's variable, surfaced beside the score, not inside it.
- **Surfaced everywhere the number matters**: a premium valuation card in the ScorePanel (big "$X / net-developable acre" with asking price, basis, and vs-assessed ratio); a valuation band in the printed report; a `$/acre` column in the portfolio comparison table and mobile cards (replacing the less-actionable parcel-value cell); a discoverability hint under the price form field.
- **Exports**: CSV gained `estimated_price`, `price_per_acre`, `price_acre_basis`, `price_to_assessed_land` (estimated_price was previously collected but never exported); GeoJSON properties gained `estimatedPrice`, `pricePerAcre`, `priceAcreBasis`.
- **Tests**: 216 passing (was 200). Added `valuation.test.ts` (14 cases: net/gross basis, currency parsing, zero/negative/missing guards, assessed-value preference) and 2 `siteExports` cases asserting the new columns and GeoJSON properties. Verified in-browser: valuation card, portfolio column, and report band all render with correct math ($480k / 12 ac = $40k/gross acre).

### 2026-07-12 — "Field office" visual redesign; scoring version + re-screening; score levers

- **Complete frontend restyle** (`index.html`, `src/index.css`, `src/App.css`): dark topographic shell (deep green-black surfaces) with a survey-lime accent, Fraunces display serif for headings and score numerals, JetBrains Mono for coordinates and data values, and a subtle contour-line SVG texture on hero/empty/report backgrounds. The map stays light (the artifact you study); the report stays a white paper sheet (the deliverable you print) — all `.report-sheet` content is scoped to paper tokens so print output is unchanged. All existing class names and layout geometry were preserved; only the visual system changed. Verified in-browser at desktop and mobile widths: explorer, site-inputs form, portfolio table, and report.
- **`SCORING_VERSION` (currently 2) stamps every analysis.** Saved sites whose `analysis.scoringVersion` differs show an "old scale" badge in the portfolio view plus a banner with a one-click "Re-screen N outdated" action. `rescreenSavedSite`/`rescreenSites` in `batchScreening.ts` re-run the full pipeline (parcel, official sources, overlays, hazards) keeping the user's inputs, id, and creation date.
- **"What could raise this score" panel** in the ScorePanel: `buildScoreImprovements` in `scoring.ts` ranks the highest-leverage diligence actions — verifying unscored categories (weighted-evidence gain + confidence-penalty recovery), upgrading point screens to parcel-wide overlays, and replacing user-supplied answers with official evidence — each with an honest "up to +N" bound and a footnote that adverse findings lower the score instead.
- The score hero now states the scale plainly: 50 is an average parcel; 75+ is exceptional, verified land.

### 2026-07-11 — Score recalibration: 50 = average, weighted-average bug fix, hazards category

- **Fixed a raw-score normalization bug that pinned every score at ~100.** `analyzeSite` divided the Σ(score×weight) sum by `scoredWeight / 100` (100× too small a divisor), so `clamp()` saturated every raw score at 100 whenever ≥50 weighted evidence existed. Final scores were effectively `100 − hazard modifier − confidence penalty`, which is why every parcel landed in the 90s regardless of its metrics. The divisor is now `scoredWeight`.
- **Recentered every category curve so 50 is an average parcel.** Clean point screens now score 55–60 and clean parcel-wide verified screens 62–70 (previously 85–95 for the mere absence of a problem); constraints score 25–45; verified hard problems stay 0–25. Scores of 75+ require affirmative verified strength: by-right use in a jurisdiction permitted-use table (90), sourced EPA water + sewer boundaries (82), net-to-gross ≥ 90% (92), road at the parcel edge with assessor frontage (85), strong population + permit trend (≈90). One-sided risk screens intentionally top out in the 60s.
- **Promoted regional hazards (NOAA SLR, USFS wildfire, EPA radon) from a −5 score modifier to a 14th weighted category** (weight 4; clean ≈ 62, worst combined exposure ≈ 12). `SiteAnalysis.regionalHazardModifier` was removed; ScorePanel and SiteReport now describe hazards as scored evidence.
- **Rebalanced weights to reduce double counting with net developable acreage.** Net developable (the constraint-union quantity signal) rose 9→13 and zoning 12→13; the overlapping severity categories shrank: floodplain 10→8, wetlands 10→7, slope 8→6, soils 8→6, stormwater 7→6, easements 5→4; utilities 10→11, access 7→8. Gross-acreage fallback (no overlays) is capped at 72 since it is unverified.
- **Confidence penalty is now weight-scaled** (≈1 point per 5 unscored weight points, max −10) instead of a flat per-category count.
- **Verdict bands recentered:** strong ≥75, viable 50–74, challenged 38–49, reject <38. Strength/red-flag trigger thresholds updated to the new scale. Hard gates unchanged.
- **Calibration fixture suite added** (`scoring.calibration.test.ts`): four synthetic archetypes (prime verified ≈ 76, average ≈ 50, constrained ≈ 38, poor ≈ 23) pin the distribution and ordering so anchor drift fails tests.
- **Tests:** 200 passing (was 196); scoring, storage, and calibration suites updated to the 14-category shape and new anchors.

### 2026-07-11 — Nationwide product roadmap phases 1–6 complete

- **National jurisdiction engine:** isolated all local code logic behind typed packs and added architecture guards that prevent jurisdiction-specific logic from leaking into national providers or UI. Registered source-faithful Austin, Houston, Dallas, and Charlotte packs with authority, zoning, overlay, standards, future-policy, and concrete-use behavior appropriate to each jurisdiction.
- **Parcel depth and coverage:** audited all 58 public parcel adapters, enriched 57 with every usable development-relevant public field, retained one explicitly geometry-only source, and added CA Sonoma, KS Wyandotte, and statewide MS coverage. Coverage telemetry now reports national, state, adapter, fact, local-pack, and source limitations directly in the product.
- **National context:** added EPA drinking-water/sewershed context, USGS PAD-US protection status, BTS rail proximity, and a reference-only FCC workflow that explicitly does not redistribute licensed Location Fabric or invent parcel broadband availability.
- **Exact buildable-envelope artifact:** replaced the legacy independence approximation with a deterministic shared-grid union. Floodway, wetland, mapped easement, setback, and interpolated steep-slope cells overlap exactly once. NRCS soil shares and title-only easement flags remain separately labeled aggregate adjustments. The resulting MultiPolygon, method, resolution, counts, acreage, constraints, adjustments, and provenance render on the explorer map and persist into saved reports.
- **National batch product workflow:** added strict quoted-CSV parsing, U.S. state validation, a 100-row cap, two-site bounded concurrency, independent row failures, the same official/parcel/hazard/overlay/jurisdiction/scoring path as interactive analysis, and automatic persistence. Added portfolio CSV and GeoJSON export with point, parcel, and buildable-envelope features.
- **Verification:** 22 files / 193 automated tests, ESLint, TypeScript/Vite production build, architecture guard, parcel schema audit harness, and diff hygiene pass locally. The live provider matrix passed 79/79 at the Phase 5 boundary. A final identical live rerun on July 11 was blocked before network access by the Codex approval-usage limit; Phase 6 did not modify provider URLs/contracts. Local browser launch was likewise blocked by localhost permission/approval limits, so the committed Playwright workflow remains the final environment-dependent rerun.

### 2026-07-10 — Austin exact proposed-use screening

- **Concrete-use input:** added an optional Austin selector with 30 frequently evaluated uses spanning residential, commercial, industrial, agricultural, and civic programs. Selecting a concrete use also synchronizes the broad intended-use model; changing the broad model clears the stale concrete selection.
- **Full base-district matrix:** encoded the current §25-2-491 result for every selected use across all 38 published base-district columns. Direct `P`, `C`, and not-permitted cells remain distinct; numeric footnotes plus `PC`/`CP` cells fail closed to special review. Matrix construction rejects any row with a shifted cell count.
- **Safe combining-district behavior:** MU/V combining districts prevent a base-table prohibition from being presented as final; NP/CO and mapped overlays reduce confidence and retain review flags. ETJ and special-district locations stay unresolved or special-review.
- **Decision integration:** exact permitted uses receive stronger zoning evidence, conditional uses surface entitlement risk, and an unmodified base-table prohibition triggers the existing use-permitted hard gate. Results persist with the site and print in reports with the raw source cell and §25-2-491 link.
- **Verification:** 161 tests, lint, TypeScript, and production build pass. Every proposed-use row has an independently asserted published anchor cell in addition to matrix-width validation. Playwright covers selecting a concrete use, saving it, and rendering the exact result in the report; its final Chromium launch was blocked by the local execution-usage limit, while test discovery/compilation passed.

### 2026-07-10 — Austin/Travis jurisdiction standards engine

- **Four-layer official profile:** expanded the Austin adapter to query base zoning, City planning jurisdiction (full purpose, limited purpose, ETJ, and other coded areas), 17 high-impact zoning-overlay layers in one identify call, and the neighborhood-plan Future Land Use Map. Official FLUM integer codes are translated through the published layer domain.
- **Conservative code intelligence:** added an extensible jurisdiction profile with intended-use compatibility statuses that are explicitly district-family screens, not legal by-right conclusions. Special districts and ETJ locations remain unresolved. Principal dimensional standards are registered only for unambiguous RR/SF-1/SF-2/SF-3 code rows, with use-specific and superseding requirements called out.
- **Geometry and scoring integration:** recognized Austin setbacks replace national defaults only in the applicable City jurisdiction. Front/interior-side/rear distances feed the parcel grid and net developable acreage is recomputed atomically. Zoning scoring now consumes the profile without turning a coarse family conflict into a legal hard gate.
- **Product surfaces and durability:** added the local development profile to site inputs and printable reports, including authority, jurisdiction, zoning, overlays, FLUM, standards, review flags, and official-source links. Profiles persist with saved sites.
- **Verification:** at completion of this phase, 117 tests passed; lint and production build passed; the Playwright workflow included the jurisdiction profile; all 19 live provider contracts passed. A real Austin parcel smoke test verified `SF-3-NP` normalization to `SF-3`, full-purpose jurisdiction, Residential Design Standards overlay, FLUM label, and principal dimensional values.

### 2026-07-10 — Rich parcel facts and schema-drift protection

- **Normalized fact model:** added optional, source-backed parcel fields for situs/jurisdiction, property use/class/zoning, legal description/subdivision, market/appraised/assessed/land/improvement/taxable values, recorded sale, valuation year, improvements, frontage/depth, utility descriptors, and agricultural/crop/forest/grazing/irrigated acreage. Empty and invalid source values remain absent.
- **Twelve enriched adapters:** mapped every verified development-relevant field from the statewide Florida DOR, Connecticut CAMA, Montana cadastral, and New York tax-parcel layers plus Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, and Tarrant County sources. Exact source fields are requested—never `outFields=*`.
- **Product integration:** official parcel facts appear with site inputs, persist as a compact parcel snapshot on saved sites, surface in comparison, and print in a dedicated report section with provenance and assessor links where published.
- **Responsible scoring:** parcel zoning, water/sewer descriptors, and reported frontage can fill evidence gaps while retaining explicit municipal-code, capacity-letter, title, plat, and access-permit caveats. Assessed/market values do not alter feasibility scoring.
- **Privacy and durability:** owner and mailing attributes are excluded, including removal of two legacy owner/mailing-based parcel labels. Added normalization, privacy, mapping, persistence, scoring, component, and browser tests (104 local tests) plus live schema contracts for all 12 enriched services.

### 2026-07-10 — v1 production readiness, local decision data, and test coverage

- **Release stabilization:** fixed the pending lazy-loaded report/saved-site chunk configuration; lint, TypeScript, and production builds now pass. README and this record reflect 88 unit/provider tests, 35-state / 55-adapter parcel coverage, and the completed overlay/hard-gate work.
- **Production data boundary:** added `src/data/externalRequest.ts` and migrated every third-party browser request through it. `server/data-proxy.mjs` is a no-dependency Node service with an explicit host allow-list, five-minute bounded response cache, per-client rate limit, request-body/URL limits, timeout, CORS configuration, and health endpoint. Production builds opt in with `VITE_DATA_PROXY_URL`; local direct requests remain possible for development.
- **Local decision data:** registered two verified City of Austin services under the existing local-adapter registry: zoning district lookup feeds the zoning/entitlement metric conservatively, and Austin Energy’s electric-service boundary supplements EPA water-service screening. Neither adapter represents a legal-use or capacity commitment; their score details surface the appropriate municipal-code and will-serve caveats.
- **Automated confidence:** added Playwright Chromium coverage for the saved-site workflow (save → compare → report) and a live provider-contract command checking FEMA NFHL, USGS elevation, Austin zoning, and Austin Energy. Added Playwright output exclusions to Git.

### 2026-07-07 — Expand parcel coverage to 30 states (VA, NV, AZ Maricopa County)

- **Virginia (VA):** wired VGIN (Virginia Geographic Information Network) statewide parcels at `https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/FeatureServer`. Verified `esriGeometryPolygon` with fields `PARCELID`, `PTM_ID`, `VGIN_QPID`, `LOCALITY`, `FIPS`, `LASTUPDATE`. First statewide parcel adapter for Virginia.
- **Nevada (NV):** wired the Nevada Division of Water Resources county parcel compilation at `https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_in_Nevada/MapServer/0`. Verified `esriGeometryPolygon` with fields `APN`, `PIN`, `Acres`, `County`, `SourceDate`, `SiteCity`. First statewide parcel adapter for Nevada.
- **Arizona (AZ) Maricopa County:** wired the Maricopa County Assessor parcel layer at `https://gis.maricopa.gov/arcgis/rest/services/IndividualService/Parcel/MapServer/1`. Verified `esriGeometryPolygon` (layer 1) with fields `APN`, `APNDash`, `PropertyFullStreetAddress`. Arizona does not publish a statewide parcel service; Maricopa County covers the Phoenix metropolitan area, the state's largest population center.
- Researched but did not find verified authoritative statewide parcel services for: AL, CA, GA, IA, IL, KS, KY, LA, MD, MI, MO, MS, NM, OK, OR, PA, RI, SC, SD, WY. Most of these states either publish parcels county-by-county (no statewide compilation), or their GIS services did not respond to verification. Maryland's iMap serves parcel centroid points (not polygon boundaries) and was rejected per the project standard. Pennsylvania's PASDA hosts county-level services but no statewide compilation. The architecture is ready to wire additional adapters as services are discovered and verified.
- Coverage expanded from 27 states / 34 adapters to 30 states / 37 adapters. All parcel-wide overlays (FEMA, NWI, slope, soils, stormwater, easements, contamination, species, setbacks, net developable) now work in the three newly-covered areas.
- Tests: 88 passing (unchanged). Lint, build, tsc all clean.

### 2026-07-06 — Perimeter setback overlay; 6-factor net developable acreage (Phase 12)

- **Setback overlay:** added `SetbackOverlay` and `computeSetbackOverlay` in `parcelOverlayProvider.ts`. For each of the 400 parcel grid points, computes the distance to the nearest parcel boundary edge using `pointToBoundaryDistanceMeters` (new in `geometry.ts`, using haversine + point-to-segment projection). Points within the setback distance are "setback-constrained" and subtracted from net developable acreage.
- **Intended-use-aware setback distances:** conservative US-default front/side/rear fallback by intended use — residential 25/10/25 ft, mixed-use 30/15/20 ft, commercial 50/20/30 ft, industrial 50/30/30 ft, other 25/10/25 ft. Parcel edges are classified relative to the pin as a road-facing proxy. The Austin jurisdiction pack can now replace these defaults with recognized principal base-district values; corner-lot and superseding controls remain manual.
- **Instant recompute on intended-use change:** the setback overlay is pure geometry (no network calls). A separate `useEffect` in `App.tsx` recomputes only the setback when the user changes the intended-use dropdown, without re-fetching FEMA/NWI/USGS/EPA overlays. The other overlays stay cached.
- **6-factor net developable acreage:** `computeNetDevelopable` now subtracts the union of floodway + wetlands + steep slope + hydric/severe soils + mapped easements + perimeter setbacks using the independence approximation `1-(1-a)(1-b)(1-c)(1-d)(1-e)(1-f)`. `NetDevelopableOverlay` extended with `setbackAcres`. The score detail, provenance `coverageNote`, and the ScorePanel "parcel-wide overlays active" note all mention setbacks explicitly. The previous "Does not subtract setbacks" caveat has been removed.
- **Geometry:** added `pointToSegmentMeters` and `pointToBoundaryDistanceMeters` to `geometry.ts` using haversine distance and standard point-to-segment projection. These are pure functions with no external dependencies.
- **Tests:** `npm run test` now 88 tests (was 84). Added 4 cases: setback subtraction from net developable, 6-factor independence approximation math (`1-(0.85)^6 ≈ 0.6228`), `computeSetbackOverlay` returns nonzero fraction for a real parcel, and industrial intended use uses a larger setback distance than residential. Updated existing test fixtures with `setback` + `setbackAcres` fields.
- **Docs:** backlog #1 and #12 marked Done. README MVP capabilities bullet expanded to include perimeter setbacks.
- Verified `npm run test`, `npm run lint`, `npm run build`, and `tsc -b` all pass. Build is ~636 kB (~194 kB gzipped) — no new runtime dependencies.

### 2026-07-06 — Provider contract tests for parcel overlay compute functions (Phase 11)

- **New test file:** `src/data/parcelOverlayProvider.test.ts` with 19 tests covering the pure compute functions that were previously untested — the most bug-prone part of the codebase.
- **`ringsToWkt`** (3 tests): single-ring polygon, polygon with hole, negative US longitudes.
- **`computeSlopeFromElevations`** (3 tests): flat grid returns 0% slope, steep grid returns >20% max slope, grid with <4 samples returns unavailable.
- **`computeStormwaterFromElevations`** (2 tests): positive outfall when terrain slopes to a low point, flat terrain reports no outfall + flatness index 1.
- **`computeEasementsOverlayFromAdapter` / `buildEasementsOverlay`** (4 tests): unavailable when no adapter result, 5% placeholder fraction when presence-only flag, zero fraction when no easements, polygon intersection against the parcel grid.
- **`computeNetDevelopable`** (7 tests): zero-area boundary returns null, no constraints returns full net developable, floodway subtraction, hydric/severe soil subtraction (max of the two), easement subtraction, 5-factor independence approximation math verified (`1-(0.8)^5 = 0.67232`), and the explicit assertion that contamination + critical habitat do NOT subtract from net developable.
- Exported `SharedElevations`, `computeSlopeFromElevations`, `computeStormwaterFromElevations`, `ringsToWkt`, `computeEasementsOverlayFromAdapter`, and `computeNetDevelopable` so they're testable from the test file. These are pure functions with no internal state; exporting them adds no API surface risk.
- `npm run test` now 84 tests (was 65). Lint, build, and `tsc -b` all clean. No new runtime dependencies.

### 2026-07-06 — Intended-use-aware market weighting (Phase 10)

- **`marketMetric` is now intended-use-aware.** Census BPS measures residential-structure permits (1-unit, 2-4 unit, 5+ units). For `residential` and `mixed-use` intended uses the permit trend is a direct demand signal and gets full credit in the 60/40 composite. For `commercial`, `industrial`, and `other` the permit trend is informative but indirect — the permit contribution to the market sub-score is capped at 78 (vs. 100 for residential/mixed-use) and the composite weighting shifts from 60% pop / 40% permits to 80% pop / 20% permits. The metric `displayValue` and `detail` flag the indirect signal and recommend an intended-use-specific market study (retail/commercial rents/vacancy/household income for commercial; industrial vacancy/lease rates/employment for industrial; intended-use demand/absorption for `other`).
- **Surfaced market unknown for non-residential intent.** `analyzeSite` now pushes an `unknowns` entry when the market metric is `official` and the intended use is not `residential`/`mixed-use`, describing what an intended-use market study should cover (rents/vacancy/income for commercial; vacancy/lease rates/employment for industrial; intended-use demand/absorption for `other`). This makes the missing-evidence caveat visible alongside the score rather than buried in the metric detail.
- **Tests:** `npm run test` now 65 tests (was 61). Added 4 cases asserting: residential market score ≥ industrial market score given the same data; industrial market detail mentions "indirect" and surfaces an unknown; residential intent does not surface the indirect-signal unknown; and `marketMetric` still produces a score when only ACS demographics are available (no BPS).
- **Honesty preserved:** the metric never fabricates an intended-use score; it just weights the existing verified Census data by how directly it measures the requested use and flags the gap. Full intended-use models (commercial rents, industrial vacancy, employment by sector) still require a market-data adapter — the architecture is ready for one and the limitation is explicit in the metric detail and the unknowns list.
- Verified `npm run test`, `npm run lint`, `npm run build`, and `tsc -b` all pass. Build is ~633 kB (~193 kB gzipped) — no new runtime dependencies.

### 2026-07-06 — Parcel-wide contamination + critical habitat overlays; all 8 verified Texas county easement adapters (Phase 9)

- **Parcel-wide contamination overlay (EPA FRS parcel polygon):** added `ContaminationOverlay` and `fetchContaminationOverlay` in `parcelOverlayProvider.ts`. The overlay queries the EPA FRS ArcGIS service with the parcel polygon as `esriGeometryPolygon` + `esriSpatialRelIntersects`, returning the list of EPA-regulated facility points that fall within (or within a small surrounding buffer of) the parcel polygon, the unique program/interest types, whether any are UST/LUST/RCRA/CERCLA/Superfund/TRI/air/hazardous/toxic (`hasMajorFlag`), and the nearest facility name. The overlay degrades to `available: false` on CORS or service failure exactly like the existing point query. The point-based 1 km buffer screen in `nationalAdapters.ts` is retained as the fallback when no parcel boundary is loaded.
- **Parcel-wide species overlay (USFWS ECOS critical habitat parcel-grid):** added `SpeciesOverlay` and `fetchSpeciesOverlay`. The overlay queries USFWS ECOS for critical-habitat polygons intersecting the parcel polygon, then intersects the returned habitat polygons against the existing 400-point parcel grid to compute a parcel-wide `habitatFraction`. The overlay surfaces the intersecting species/layers, the species count, the habitat fraction, and the grid sample count. The point-based species screen is retained as fallback.
- **Hard gates now fire from overlay data:** updated `evaluateHardGates` in `src/lib/scoring.ts` so the `contamination` and `species-historic` gates can trigger from either the point-based screen (1 km buffer / point intersection) or the parcel-wide overlay (parcel polygon intersection), whichever returns a hit. Overlay reason text explicitly notes the parcel-wide buffer / habitat fraction when it fires.
- **Net developable acreage unchanged for contamination + critical habitat:** contamination and critical habitat are hard gates, not land-use takeouts — they do NOT subtract from `NetDevelopableOverlay`. The overlay still improves the `contamination` and `species` metric scores and gates to manual diligence; buildable acreage remains the union of floodway + wetlands + steep slope + hydric/severe soils + mapped easements.
- **All eight verified Texas county parcel layers now have easement adapters:** refactored the Travis County easement adapter into a reusable `makeTexasCountyEasementAdapter` factory in `localAdapters.ts`. Registered easement adapters for Travis, Dallas, Harris, Bexar, Collin, Williamson, Montgomery, and Tarrant counties — all pointing at the same authoritative county parcel FeatureServer already verified in `parcelProvider.ts`. Each adapter queries the parcel layer at the selected point and inspects returned attributes for common Texas appraisal-district easement/ROW flag field names. The registry is still empty in unit tests; production registers them via `registerDefaultLocalAdapters()`.
- **Scoring tests:** `npm run test` now 61 tests (was 56). Added 5 cases covering: parcel-wide contamination overlay preference, parcel-wide species overlay preference, contamination hard gate firing from overlay major flag, species-historic hard gate firing from overlay habitat hit, and the explicit assertion that contamination + critical habitat hits do NOT subtract from net developable acreage. Updated the `goodOverlays` fixture with `contamination` + `species` fields.
- **UX + docs:** ScorePanel parcel-overlay-loading message and the "parcel-wide overlays active" note now mention EPA contamination + USFWS critical habitat. README MVP capabilities bullet expanded to include EPA FRS contamination facility count and USFWS critical-habitat % intersect. PROJECT_RECORD backlog #11 marked Done; #9 updated; the "current data truth" limitation paragraph revisited.
- Verified `npm run test`, `npm run lint`, `npm run build`, and `tsc -b` all pass. Build is ~632 kB (~193 kB gzipped) — no new runtime dependencies.

### 2026-06-26 — Parcel-wide soils, stormwater, and easements overlays; Travis County easement adapter (Phase 8)

- **Parcel-wide soils overlay (USDA NRCS SDA, parcel polygon):** added `SoilsOverlay` to `src/data/parcelOverlayProvider.ts` and the `fetchSoilsOverlay` function that issues a single SDA POST spatial-SQL query (`mupolygon.STIntersects(geography::STGeomFromText(...))`) against the parcel polygon. Returns one row per intersecting soil map unit with dominant-component NRCS interpretations (drainage class, hydric class, Septic Tank Absorption Fields and Dwellings Without Basements ratings). Coverage fraction is approximated by `comppct_r` share across intersecting map units because SDA does not return polygon geometry. The soil overlay degrades honestly to `available: false` on CORS or service failure, exactly like the existing point query. The overlay surfaces `hydricFraction`, `severeFraction`, `moderateFraction`, `dominantRating`, a per-mukey share map, and `samplePoints` (the 400-point parcel grid). The scoring `soilsMetric` now prefers the overlay when a parcel is loaded, scoring `severe` with `severeFraction > 0.25` at 18, `severe` at 35, `moderate` at 45–58, `slight` at 85, and unknown at 60.
- **Parcel-wide stormwater overlay (USGS 3DEP):** refactored `fetchSlopeOverlay` into `sampleParcelElevations` + `computeSlopeFromElevations` + `computeStormwaterFromElevations` so the same 25-point USGS EPQS elevation grid is shared between slope and stormwater. Parcel-wide stormwater identifies the parcel low point, scores each sampled cell's elevation difference vs. that low point, finds the dominant drainage direction from per-cell directional gradients, and produces an honest screening level (good / moderate / challenging / unknown). Eases the USGS API load by halving the number of elevation samples per parcel. The scoring `stormwaterMetric` prefers the overlay when a parcel is loaded.
- **Travis County, TX easement adapter:** added `registerDefaultLocalAdapters` in `src/data/localAdapters.ts` and a registered Travis County easement adapter that queries the already-verified Travis County Tax Maps parcel layer at the parcel point and inspects returned attributes for common Texas appraisal-district easement/ROW flag fields (`EASEMENT`, `EAS_YN`, `NUM_EAS`, `ROW`, etc.). When the parcel layer does not expose easement polygons, the overlay applies a conservative 5% placeholder acreage subtraction under presence-only flag; otherwise it intersects the returned easement polygons against the 400-point parcel grid for an accurate fraction. App startup (`App.tsx`) calls `registerDefaultLocalAdapters()` once.
- **Net developable acreage now subtracts hydric/severe soils and easements:** extended `NetDevelopableOverlay` with `soilConstrainedAcres` and `easementAcres`. The union independence approximation now spans five factors (`1-(1-a)(1-b)(1-c)(1-d)(1-e)`). The score detail/`coverageNote` text and the parcel-wide-overlay-status note in `ScorePanel.tsx` mention soils + easements explicitly. The provenance still notes that setbacks and buffers are not subtracted and an ALTA survey remains authoritative. Added a red flag when `severeFraction > 30%` of the parcel.
- **Easements overlay hook:** added `EasementsOverlayInput` and `buildEasementsOverlay` in `parcelOverlayProvider.ts`; `localAdapters.ts` exposes `fetchEasementsOverlayForParcel` that returns `null` when no adapter covers the state. Where no adapter is registered, the overlay remains unavailable with the standard ALTA/title fallback (identical to pre-Phase-8 point behavior).
- **Tests:** `npm run test` now 56 tests (was 49): added 7 scoring cases covering parcel-wide soils/stormwater/easements overlays, severe-soil subtraction, easement subtraction, and unavailable-easements fallback; updated the existing parcel-overlay fixtures with the new fields. Added one local-adapter test asserting `registerDefaultLocalAdapters` is idempotent and that Travis County appears in the easements summary.
- **Docs:** moved backlog items #10 and #3 to Done; updated #1, #9; added backlog items #11 (parcel-wide contamination/species overlays) and #12 (jurisdiction-specific setback overlays).
- Verified `npm run test`, `npm run lint`, `npm run build`, and `tsc -b` all pass. Build is ~622 kB (~191 kB gzipped) — no new runtime dependencies.

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
