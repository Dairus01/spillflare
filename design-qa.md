# Design QA

## Source and implementation

- Source visual truth: two oil-spill analytics screenshots supplied in the current conversation (company table; monthly count and volume charts).
- Product visual system: the existing SpillFlare light/dark design tokens and public website shell.
- Implementation: `http://localhost:3000/oil-spills/analytics?year=2025`.
- Desktop light screenshot: `artifacts/analytics-light.png` (1440 px wide, device scale factor 1, full-page capture).
- Desktop dark screenshot: `artifacts/analytics-dark.png` (1440 px wide, device scale factor 1, full-page capture of the 2024 filter after activating the website theme control).
- Mobile screenshot: `artifacts/analytics-mobile.png` (390 px CSS width, device scale factor 1, full-page capture).
- State: populated NOSDRA snapshot, yearly filter, sortable table, four chart views.

## Full-view comparison evidence

The reference structure is retained: a dense company comparison table followed by cause-based count and volume diagrams. The implementation deliberately adapts the reference's standalone dark report into the established website shell, typography, orange/teal data palette, responsive cards, and light/dark themes. Additional source-backed views cover state ranking and quantity completeness.

## Focused-region evidence

- Table: visible company hierarchy, right-aligned numeric columns, sticky header, sort affordances, supplied-value coverage beneath volume totals, and horizontal containment on mobile.
- Charts: readable titles and definitions, consistent month order, visible legends, non-color-only series names, tooltips, and separate count/volume scales.
- Mobile: body width measured at 390 px against a 390 px viewport; no page-level horizontal overflow. The wide table scrolls inside its own bounded container.
- Dark mode: surfaces, grid lines, table borders, labels, chart series and the source note retain legible contrast.

## Functional verification

- Analytics heading and 2025 total rendered.
- Company sorting changed the first row to `Aiteo E&P` when sorted ascending.
- Year selection submitted and updated every total/chart to 2024; the page showed 1,258 records.
- Theme toggle applied `data-theme="dark"` and rendered the dark chart/table state.
- No Next.js error overlay, browser console errors, or mobile page overflow were detected.
- TypeScript passed, production build passed, and all 8 unit tests passed.

## Findings

No actionable P0, P1 or P2 visual differences remain. The source screenshot's green-on-charcoal palette was intentionally not copied because the product already has an approved orange/teal brand system; information density and analytical hierarchy were retained.

## Comparison history

- Initial desktop and mobile captures showed the intended table/chart hierarchy and no layout breakage.
- The first automated dark capture followed only the system color preference while the product had a stored light preference. QA then activated the actual theme control and recaptured; the verified dark implementation uses the correct dark surfaces and contrast.

## Follow-up polish

- P3: a future iteration could add CSV export specifically for the aggregated company table.

## Final result

final result: passed

---

## State profile filtering and chronology — 31 August 2026

### Source and implementation

- Source visual truth: the two Delta state-profile browser screenshots attached to the current request. They document the broken state—no filter controls, undated/old spill rows above recent records, an unpaginated list and a generic flare trend.
- Implementation: `http://localhost:3000/places/states/delta`.
- Desktop implementation: `artifacts/state-delta-default-final.png` at 1440 CSS px, device scale factor 1, full-page capture.
- Additional state: `artifacts/state-delta-flares-only.png` at 1440 CSS px, device scale factor 1.
- Mobile implementation: `artifacts/state-delta-mobile.png` at 390 CSS px, device scale factor 1.

### Full-view comparison evidence

The existing public-site header, state hero, source rail, map, typography and light design tokens remain intact. The formerly empty area above the map now contains the requested filter workflow and selection-aware metrics. The map/list/chart hierarchy remains recognizably the same state profile rather than becoming a separate dashboard.

### Focused-region evidence

- Filters: year, spill company, data shown, flare month and spill search are grouped in one labelled panel with Apply and Reset actions.
- Chronology: Delta now opens on 2026 and the first record is `CHEVRON/014/2026` dated 22 August 2026. Undated rows are retained under All years but sort after every dated record.
- Pagination: the first page shows 1–10 of 55 with a working Next link; page 2 preserves the active filters.
- Map modes: Both shows both legend entries; Gas flares only shows one flare marker and only the gas-flare legend; Oil spills only shows only spill points and removes the flare chart.
- Monthly chart: 2026 exposes January through May as source-supplied months. All years exposes all 171 supplied Delta months.
- Mobile: document width and viewport width both measured 390 px; no page-level horizontal overflow.

### Required fidelity surfaces

- Typography: existing Manrope/Plex Mono hierarchy, weights and compact metadata labels are preserved.
- Spacing/layout: controls align to the established card grid, collapse to one column on mobile and keep map/list proportions at desktop width.
- Colors/tokens: existing surface, border, brand-orange and data-teal tokens are reused; no new visual language was introduced.
- Image quality/assets: the existing Esri imagery layer and supplied Nigeria brand mark remain unchanged and sharp.
- Copy/content: terminology distinguishes spill companies from state flare totals and explicitly explains that the flare endpoint has no company field.

### Functional verification

- Default Delta page: 55 dated 2026 spill rows, ten visible rows per page, newest dated record first and May 2026 flare value shown.
- Previous/Next pagination, 2026 Chevron spill-only filtering and March 2026 flare-only filtering passed.
- First spill link resolves to `/oil-spills/477945` with HTTP 200.
- The final All-years page contains only undated rows, confirming they are sorted last rather than first.
- No browser console errors were detected.
- TypeScript, production build and all eight unit tests passed.

### Findings

No actionable P0, P1 or P2 differences remain. The attached screenshots were defect evidence rather than a polished target layout, so the new controls follow the approved SpillFlare design system.

### Final result

final result: passed

---

## Historical company flare analytics — 31 August 2026

### Source and implementation

- Visual source of truth: `design-prototypes/08-historical-company-analytics.png` and `design-prototypes-v2/08-historical-company-flare-data.png`.
- Data source: the validated `flareCompany` snapshot containing 2,479 rows, 27 source company labels and 104 supplied months from March 2012 through October 2020.
- Implementation: `http://localhost:3000/gas-flares/companies`.
- Captures: `artifacts/company-flare-light.png`, `artifacts/company-flare-dark.png` and `artifacts/company-flare-mobile.png`.

### Comparison evidence

The implementation retains the approved prototype's essential hierarchy: historical-only warning, selected-month controls, complete multi-company timeline, selected-month ranking, full company table, coverage dates, source caveat and CSV downloads. It uses the public website header and footer established by the approved multi-page architecture rather than the obsolete authenticated sidebar shell.

### Functional verification

- Default October 2020 view rendered eight chart series, eight ranked companies and 21 supplied company rows.
- Changing the URL-backed controls to December 2019 and Top 5 rendered five series, five ranked companies and 24 supplied rows.
- The selected-month export returned 24 data rows plus its header with the filename `nigeria-flare-company-2019-12.csv`.
- The main Gas Flares page exposes the historical company view in both the hero and filter toolbar; the global footer also links to it.
- Light mode, dark mode and a 390 px mobile viewport rendered without console errors or page-level horizontal overflow.
- TypeScript, the production build and all eight unit tests passed.

### Data-integrity decision

No post-October 2020 company values are inferred. “Unknown” remains visible because it is a source-supplied company label, and company association is explicitly described as supplied or presumed rather than proof of legal responsibility.

### Final result

final result: passed
