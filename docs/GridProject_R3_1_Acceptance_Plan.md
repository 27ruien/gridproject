# GridProject R3.1 Acceptance Fix Plan

## Baseline

- Base branch: `codex/gridproject-plane-r3-product-polish`
- Base SHA: `65f1411 docs: record R3 implementation review`
- Working branch: `codex/gridproject-plane-r3-1-acceptance-fixes`
- R3.1 purpose: resolve acceptance issues found in R3 screenshots without starting R4 or redesigning the backend surfaces.

## Problems To Fix

1. Mobile filter areas on cost and people pages take too much vertical space before the first real record.
2. The mobile Gantt tool area exposes the full desktop control set and delays the first schedule card.
3. Timesheet approval status mixes storage values and Chinese UI labels.
4. Cost and people desktop filters still read as traditional admin query forms.
5. Equivalent filter behavior differs between cost, people, and mobile Gantt.

## Allowed Scope

- `src/components/project/GanttChart.vue`: mobile toolbar and mobile filter controls only.
- `src/views/TimesheetView.vue`: status display mapping and approval summary display only.
- `src/views/CostManagementView.vue`: filter layout, active chips, compact mobile header and summary only.
- `src/views/UserManagementView.vue`: filter layout, active chips, compact mobile header only.
- Shared UI for filter popover / bottom sheet and active filter chips.
- Responsive CSS directly related to the R3.1 surfaces.
- R3.1 Playwright tests, screenshot capture script, artifacts, and review docs.

## Explicit Non-Goals

- No changes to home, project library, project cards, account menu, personal settings, Project Header, Project Tabs, Project Toolbar, issue list, or board.
- No changes to desktop Gantt date calculation, tick generation, task bar positioning, or timeline scroll behavior.
- No changes to timesheet business rules, cost calculation rules, people permissions, platform settings, Timeline import, or Excel export structure.
- No backend API, Prisma schema, authentication, permission, database, or GitHub Actions deployment changes.
- No `App.vue` split or route orchestration changes in R3.1.
- No CSRF/Origin hardening work in this branch.

## Design Direction

- Keep the R3 Plane-aligned operational language: light borders, neutral surfaces, compact controls, restrained shadows, and existing radius tokens.
- Convert cost and people filters into a shared progressive-disclosure pattern:
  - Desktop: search, key quick filters where required, filter button, sort, and primary action.
  - Mobile: compact title/action row plus search, filter, and sort controls.
  - Other conditions move into one shared Filter Surface that behaves as a desktop popover and mobile bottom sheet.
- Show active filter chips under toolbars. Chips clear single filters and expose clear all only when filters exist.
- Do not hide overflow problems with document-level `overflow-x: hidden`.

## Page Plans

### Cost Management

- Keep the cost list, detail drawer, weekly detail filter, editing, and export logic intact.
- Move team, owner, and cost type into the shared Filter Surface on desktop.
- Include project, team, owner, cost type, and risk in the mobile bottom sheet.
- Make the mobile header a compact title plus `新建记录` row.
- Change the summary band to four compact metrics and a separate abnormal risk hint.

### People Management

- Keep the personnel table/card content, overflow actions, confirmations, status changes, delete behavior, and permissions intact.
- Move execution team, role, and status into the shared Filter Surface.
- Make the mobile header a compact title plus `邀请成员` row.
- Keep search, filter, and sort as the persistent mobile controls.

### Gantt

- Keep the desktop Gantt timeline core untouched.
- Add a mobile-only two-row control area:
  - Row 1: `排期列表`, task count, filter.
  - Row 2: day/week/month segmented control, today, compact search trigger.
- Move status, overdue, collapse all, and expand all into the mobile bottom sheet.
- Show compact active filter hints when search/status/overdue filters are active.

### Timesheet

- Normalize storage values centrally and display labels through one mapping:
  - `DRAFT` -> `草稿`
  - `SUBMITTED` -> `已提交`
  - `APPROVED` -> `已通过`
  - `REJECTED` -> `已驳回`
- Preserve raw storage/API values and business state checks.
- Replace slash-separated English approval summary with a compact Chinese line using middle dots.

## Screenshot Acceptance

Generate `artifacts/plane-r3-1/` with:

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

Manual review must record whether first cost/person/Gantt records appear earlier, whether desktop Gantt regressed, whether English approval statuses remain visible, and whether page root horizontal scroll or console/page errors exist.

## Verification Plan

- `npm run test`
- `npm run frontend:lint`
- `npm run build`
- `npm run server:lint`
- `npm run server:build`
- `npm run server:test`
- `npx playwright test tests/e2e/plane-r3-1.spec.js -c playwright.config.js`
- `BASE_URL=http://127.0.0.1:<port> npm run capture:plane-r3-1`

Database integration tests may skip if `TEST_DATABASE_URL` is not configured. This branch must not connect to production databases, use port 5433, run `migrate reset`, run `prisma db push`, or perform destructive data operations.
