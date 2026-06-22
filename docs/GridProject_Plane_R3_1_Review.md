# GridProject Plane R3.1 Review

## Baseline

- Base branch: `codex/gridproject-plane-r3-product-polish`
- Base SHA: `65f1411 docs: record R3 implementation review`
- R3.1 branch: `codex/gridproject-plane-r3-1-acceptance-fixes`
- Scope: acceptance fixes for filter density, mobile Gantt controls, and timesheet status localization.

## What Changed

### Shared Filter Surface

- Added one shared `FilterSurface` for desktop popover and mobile bottom sheet behavior.
- Added one shared `FilterChips` component for active filter visibility, single-filter clearing, and clear-all.
- Escape closes the surface, scrim click closes it, page scroll locks while open, focus returns to the trigger, and the sheet respects reduced-motion preferences.
- Cost, people, and mobile Gantt now use the same interaction model instead of separate page-specific filter overlays.

### Cost Management

- Mobile header is now title plus `新建记录`.
- Mobile summary is four compact two-column metrics with over-budget risk as a compact hint row.
- Mobile toolbar now keeps only search, filter, and sort. Project, team, owner, cost type, and risk are in the bottom sheet.
- Desktop toolbar now keeps search, project, risk, filter, sort, and create. Team, owner, and cost type are in the popover.
- Cost list, detail drawer, planned person-days editing, weekly filter, Raw Data preview, and Excel export behavior were not changed.

### People Management

- Mobile header is now title plus `邀请成员`.
- Mobile toolbar now keeps only search, filter, and sort.
- Execution team, role, and status moved into the shared Filter Surface.
- Desktop toolbar now keeps search, filter, sort, and invite.
- Personnel cards/table, overflow actions, status changes, delete confirmation, and permission behavior were not changed.

### Gantt

- Desktop Gantt workspace, tick generation, bar positioning, today line, and timeline scroll logic were not changed.
- Mobile Gantt now has a compact two-row control area:
  - Row 1: `排期列表`, task count, filter.
  - Row 2: day/week/month, today, search icon.
- Mobile search is collapsed by default and expands into a compact input.
- Status, overdue-only, collapse all, and expand all moved into the bottom sheet.
- The old mobile explanatory paragraph and always-visible status/select/checkbox/collapse controls were removed from the mobile first screen.

### Timesheet

- Added centralized status normalization and display mapping.
- Storage/API state values remain `DRAFT`, `SUBMITTED`, `APPROVED`, and `REJECTED`.
- Chinese UI now displays `草稿`, `已提交`, `已通过`, and `已驳回`.
- Weekly approval summary now uses a compact line: `草稿 4 · 已提交 4 · 已通过 3`.
- Record row status lozenges use the same display mapping.

## Automated Verification

- `npm run frontend:lint`: passed.
- `npm run build`: passed. Vite still reports the existing `exceljs` chunk-size warning.
- `npx playwright test tests/e2e/plane-r3-1.spec.js -c playwright.config.js`: passed, 4/4.
- `BASE_URL=http://127.0.0.1:5173 npm run capture:plane-r3-1`: passed.

## Screenshot Evidence

Directory: `artifacts/plane-r3-1/`

- `cost-management-1440x900.png`
- `cost-management-390x844.png`
- `cost-filter-desktop-open.png`
- `cost-filter-mobile-open.png`
- `people-management-1440x900.png`
- `people-management-390x844.png`
- `people-filter-desktop-open.png`
- `people-filter-mobile-open.png`
- `gantt-1440x900-regression.png`
- `gantt-390x844.png`
- `gantt-mobile-filter-open.png`
- `timesheet-1440x900.png`
- `timesheet-390x844.png`
- `home-regression.png`
- `projects-regression.png`
- `board-regression.png`
- `report.json`

`artifacts/plane-r3-1/report.json`:

- `passed`: `true`
- console errors: `0`
- page errors: `0`
- horizontal overflow: `0` for every capture
- Cost mobile first record top: `474`
- People mobile first record top: `279`
- Gantt mobile internal controls-to-first-card height: `134`
- Timesheet English approval status visible: `false`
- Desktop Gantt regression: passed

## Manual Review

1. Cost mobile now shows the first project cost record within the first screen. The summary is still visually present but no longer blocks the list with five vertical full-width blocks.
2. People mobile now shows multiple personnel cards in the first screen after the title and compact toolbar.
3. Gantt mobile first task appears much earlier. The internal Gantt area from compact controls to first card is about 134px in the automated check.
4. Cost and people share the same Filter Surface, button behavior, bottom sheet behavior, apply/reset actions, and active chip behavior.
5. Timesheet no longer shows `DRAFT`, `SUBMITTED`, `APPROVED`, or `REJECTED` in the Chinese UI surfaces covered by R3.1.
6. Desktop Gantt remains visible and the mobile controls are hidden at 1440px.
7. No page root horizontal scroll was detected in the captured R3.1 pages or regression pages.
8. No console errors or page errors were detected during screenshot capture.

## Remaining Visual Issues

- Cost mobile still has a relatively tall summary section because four person-day metrics remain necessary above the list. It is now acceptable for R3.1, but a future product iteration could support a collapsible summary if users prioritize list scanning over at-a-glance budget context.
- The shared Filter Surface uses the current native select-based `SelectField` primitive. It is styled consistently with the existing system, but a future design-system pass could replace selects with a richer custom menu if keyboard and screen-reader parity are preserved.
- Mobile Gantt still sits below the existing project header, tabs, and project toolbar. R3.1 reduced only the internal Gantt controls as requested; any further reduction would touch R1/R3 accepted project workspace structure.
- Filter chips are functional and compact, but saved views and persistent filter presets remain outside R3.1.

## Out Of Scope Confirmed

- No backend API changes.
- No Prisma schema changes.
- No database commands, migrations, destructive operations, or production deployment.
- No GitHub Actions deployment changes.
- No CSRF/Origin security work.
- No additional `App.vue` split.
- No redesign of home, project library, project cards, account menu, personal settings, Project Header, Project Tabs, Project Toolbar, issue list, or board.
