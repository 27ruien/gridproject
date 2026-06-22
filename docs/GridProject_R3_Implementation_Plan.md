# GridProject R3 Implementation Plan

## Repository Baseline

- Repository: `/Users/kivisense/Documents/Codex/2026-06-22/gridproject-codex-gridproject-plane-r2-1/gridproject`
- Base branch: `codex/gridproject-plane-r2-1-polish`
- Base SHA: `0c883d7 test(ui): capture R2.1 visual evidence`
- R3 branch: `codex/gridproject-plane-r3-product-polish`
- Initial `src/App.vue` size: 1049 lines
- Data mode: localStorage demo by default, optional API mode through `VITE_DATA_SOURCE=api`
- Database policy: no production DB, no port 5433, no `migrate reset`, no `prisma db push`, no destructive data operation

## Read Context

- Product and architecture: `README.md`, `DESIGN.md`, `package.json`
- Project design skill: `.codex/skills/frontend-design/SKILL.md`
- Frontend shell and routes: `src/App.vue`, `src/router/routes.js`
- Views: `DashboardView`, `ProjectLibraryView`, `ProjectWorkspaceView`, `TimesheetView`, `CostManagementView`, `UserManagementView`, `PlatformSettingsView`, `PersonalSettingsView`
- Components: project workspace, Gantt, issue table/drawer, account settings, UI primitives, modal/drawer/empty-state components
- Styles: tokens, layout, responsive rules, table, filter, board/Gantt, overlay/form component parts
- State and services: `useKiviflowStore`, `useProjectWorkspace`, project, issue, time-entry, cost, user, settings services
- Backend routes: auth/bootstrap/project/issues/time-entries/cost-records/users/settings and shared auth/access policies
- Data model: `prisma/schema.prisma`
- Design evidence: all R1, R2, R2.1 review docs and `artifacts/plane-r1-revision`, `artifacts/plane-r2`, `artifacts/plane-r2-1`

## Completed R1/R2/R2.1 Scope To Preserve

R1 is the accepted direction for the real project workspace: app shell density, project identity header, tabs, view toolbar, issue list, Kanban board, project properties popover, compact row/card states, and no page-level horizontal overflow.

R2 covers the home page, project library, account menu, personal profile, preferences, and security settings. It establishes the card-only project library, compact home summary, `待关注事项`, authorized due items, desktop account popover, mobile account sheet, stable personal setting URLs, profile/preference persistence, and password update behavior.

R2.1 polishes project-card density, home attention semantics, account overlay behavior, full-viewport personal settings, mobile account entry, and password failure rate limiting. These areas are regression-only in R3.

## Current Page State

### App Shell And App.vue

`App.vue` already delegates major page bodies to independent views, but it still owns URL state, route selection, global search, personal settings URL overlay state, toast, confirm dialog, project/issue/time/cost/user CRUD bridges, and all global modal/drawer orchestration. It is still too large for the intended App Shell role.

The safe R3 move is to split only shared orchestration concerns into composables, without changing business behavior or moving complete pages back into `App.vue`.

### Gantt

`GanttChart.vue` already separates the task column from the timeline scroll area and renders a mobile list. Missing R3 requirements include day/week/month scale, today jump, search/filter controls, phase grouping, collapse/expand, richer task identity fields, weekend weakening, sticky tick alignment checks, milestone/overdue cues in both desktop and mobile, and stronger empty/loading/error pattern alignment.

### Timesheet

`TimesheetView.vue` is currently a month-based record table with role scope, filters, missing-date hints, and create/edit modal. R3 needs a weekly entry workspace on desktop and a date-grouped input flow on mobile while preserving existing create/update/submit/approve/delete events and backend rules.

### Cost Management

`CostManagementView.vue` supports project cost records, person-day calculations, weekly filtering inside the detail drawer, Excel export, editable planned person-days, and Raw Data preview. The current surface is still a wide table plus metric grid. R3 should move to a compact summary band, restrained toolbar, project cost list, clear risk only for true overrun, and mobile project cost list.

### People Management

`UserManagementView.vue` supports admin-only list/create/edit/status/delete/reset-password flows and detail drawer. There is no real team field in the data model or API, so R3 must not invent editable team assignment. It can display execution-team involvement derived from project ownership and membership. The current page is a wide admin table with many inline buttons; R3 should use a compact people list/table, status lozenges, overflow-style lower-frequency actions, and mobile information rows.

### Platform Settings

`PlatformSettingsView.vue` currently only edits platform name and two-character logo text. Backend settings confirm that these are the only real supported settings. R3 should align the page with the personal settings workspace language, but show only the real brand/basic settings section and avoid unsupported notifications, theme, language, security audit, or workflow settings.

## R3 Modification Scope

1. Rebuild the Gantt experience inside the existing project workspace.
2. Redesign timesheet as desktop weekly entry and mobile date-grouped entry.
3. Redesign cost management around compact summaries, list rows, and detail drawer.
4. Redesign people management around compact personnel list, detail drawer, and safe actions.
5. Align platform settings with the settings workspace language using only real settings.
6. Split `App.vue` by extracting route state, global search, and overlay state into composables if they reduce responsibility.
7. Add R3-specific shared styles for toolbar, lists, mobile rows, and setting workspace consistency.
8. Extend visual scenarios and screenshot automation for R3.
9. Add/adjust tests for the R3 pages and regression areas.
10. Record R3 review findings and screenshot evidence.

## Non-Goals

- Timeline import business rules
- Project and issue data model changes
- Project permission business rule changes
- Excel export structure changes
- Database migrations or data destructive operations
- CSRF/Origin hardening
- Password failure limiter shared storage
- GitHub Actions deployment changes
- Production deployment
- Re-designing R1/R2/R2.1 accepted areas

## App.vue Split Plan

Create composables only where responsibility moves cleanly:

- `src/composables/useRouteState.js`: top-level route view, current project, active project tab, issue selection, workspace filters/sort/page/view mode, URL encode/decode, popstate synchronization.
- `src/composables/useGlobalSearch.js`: global search text, debouncing, result grouping, keyboard navigation, opening active result.
- `src/composables/useOverlayState.js`: toast state, confirm dialog state, personal settings overlay URL state.

Keep in `App.vue`:

- Store initialization and auth gating
- App shell rendering
- Page/view composition
- High-level event bridge to the store
- Global modal/drawer placement

Success measure: reduce `App.vue` line count materially without changing URL behavior, visual scenarios, personal settings routes, global search, toast, confirm dialog, or CRUD event behavior.

## Page Implementation Plan

### Gantt

- Add a compact toolbar with scale, today, search, status filter, overdue filter, and collapse/expand.
- Build grouped rows by phase/milestone/status-derived section using existing issue and project milestone data.
- Keep desktop structure as fixed left task area plus independent timeline scroll.
- Use a stable row height token shared by task rows and timeline lanes.
- Generate ticks from one array and bind CSS grid columns to the same count.
- Add weekend weakening, today line, overdue tone, milestone shape, and title tooltips.
- Mobile switches to grouped schedule cards and never shows the desktop grid.

### Timesheet

- Use a weekly range derived from the current selected week.
- Desktop: project/issue grouped rows, Monday-Sunday inputs, row totals, day totals, week total, missing and abnormal hints, submit/save status labels.
- Mobile: date-grouped list with project, issue, hours, add-line, and save controls.
- Preserve existing create/update events. New cells save by creating new entries or updating existing entries where a matching reporter/date/project/issue row exists.
- Do not add unavailable approval batch rules.

### Cost Management

- Compute a compact global summary from visible cost records.
- Add restrained filters: search, project, owner/team derived from real project data, risk, and sort.
- Use a project cost list with budget/actual/projected/variance/risk/details.
- Keep detail drawer editing planned person-days, weekly filter, people contribution, top people, Raw Data, and Excel export.
- Mobile uses project cost cards and detail drawer.

### People Management

- Keep admin-only visibility from existing route filtering.
- Add search, role, status, involvement/team-derived filter, and invitation/create action.
- Desktop list shows avatar, name/email, role/status lozenges, execution-team involvement derived from owned/member projects, project counts, recent activity, and actions.
- Detail drawer keeps owned/member project lists and total hours/recent time entry.
- Destructive/status operations remain disabled for the current user and rely on existing service guards.
- Mobile uses compact people rows and moves low-frequency data into the drawer.

### Platform Settings

- Use settings workspace layout with left/top section navigation.
- Keep only a real "基本设置" section for platform brand settings.
- Show save state and current preview.
- Include an informational unavailable state for unsupported categories only if needed, but do not render fake editable settings.

## Testing And Screenshot Plan

Commands to attempt:

- `npm run test`
- `npm run frontend:lint`
- `npm run build`
- `npm run server:lint`
- `npm run server:build`
- `npm run server:test`
- `npm run test:visual` or targeted R3 Playwright specs
- R3 screenshot script under `scripts/capture-plane-r3.mjs`

R3 artifacts:

- `artifacts/plane-r3/gantt-1440x900.png`
- `artifacts/plane-r3/gantt-390x844.png`
- `artifacts/plane-r3/timesheet-1440x900.png`
- `artifacts/plane-r3/timesheet-390x844.png`
- `artifacts/plane-r3/cost-management-1440x900.png`
- `artifacts/plane-r3/cost-management-390x844.png`
- `artifacts/plane-r3/people-management-1440x900.png`
- `artifacts/plane-r3/people-management-390x844.png`
- `artifacts/plane-r3/platform-settings-1440x900.png`
- `artifacts/plane-r3/platform-settings-390x844.png`
- R1/R2/R2.1 regression screenshots for home, project library, project list, board, account menu, and personal settings

## Acceptance Criteria

- No document-level horizontal overflow in required desktop and mobile screenshots.
- R3 pages use Plane-aligned dense operational surfaces rather than dashboard cards or admin query forms.
- Gantt mobile renders schedule list, not squeezed desktop grid.
- Timesheet mobile renders date groups, not a seven-column table.
- Cost and people mobile render information lists/cards, not compressed desktop tables.
- Platform settings remains a real single-column settings workspace with only supported settings.
- Shared component or style changes do not regress R1/R2/R2.1 evidence pages.
- Tests and screenshots report console errors, page errors, and overflow truthfully.

## Independent Security Branch Plan

After R3, create a separate branch `codex/gridproject-security-csrf-hardening` for server-side Origin/Referer and CSRF hardening. That branch should evaluate cookie-authenticated write routes globally, token or double-submit strategy, local/dev origin behavior, tests, and rollout notes. It must not be mixed into R3 UI commits.
