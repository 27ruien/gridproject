# GridProject Implementation Audit

## Baseline

- Branch: `codex/gridproject-flow-ui-redesign`
- Baseline commit: `7b1c027`
- Frontend stack: Vue 3, Vite, localStorage demo mode and API mode
- Backend stack: Fastify, Prisma, PostgreSQL
- Baseline checks: frontend lint, domain tests, access/cost tests, API-mode source tests, frontend build, server TypeScript build, and Prisma validation passed
- Baseline screenshots: `artifacts/ui-review/before`
- The requested historical design review files were not present. Existing design context was found in `docs/current-state-review.md`, `docs/ux-audit.md`, and `docs/experience-design-spec.md`.

## Flow Before This Work

Project creation opened a single modal, prefilled project and milestone dates, selected the first owner automatically, and created template seed issues immediately. Timeline import was only available after entering a project. It accepted delimited text or JSON, exposed a merge checkbox, and wrote imported issues without a reviewable phase or key-date model.

Project editing exposed the legacy project due date and did not include execution teams. Timeline imports could match an issue by title and overwrite manually maintained issue fields. API issue payloads did not preserve Timeline source metadata, so import identity was lost after a refresh.

## Blocking Problems

### P0-A: Project and Timeline flow

- The browser title still used the former product name.
- Timeline import was not part of project creation or editing.
- There was no Excel workbook parser or explicit file, Sheet, header, date, and no-task error model.
- Key dates were fabricated when no Timeline match existed.
- The project due date remained in the form, while execution teams were absent.
- Save actions had no in-form busy state or duplicate-submit guard.
- Schedule merge could overwrite a manually maintained issue that happened to share a title.
- Timeline metadata existed only in the local frontend model and was not persisted by the API.

### P0-B: Structural interaction issues

- The Gantt header and task rows used different implicit grid structures, so ticks and bars could drift.
- The Gantt task identity and timeline shared one horizontal layout rather than separate fixed and scrollable regions.
- `PersonPicker` used a fixed popover without trigger-relative coordinates.
- Some row interactions relied on propagation suppression instead of explicit primary and secondary action regions.

### P1/P2: Information architecture and visual consistency

- Project fields, status, dates, and actions competed at the same visual level.
- The project table emphasized template and legacy due-date data instead of execution team, current phase, and release risk.
- Low-frequency actions were spread across the header rather than grouped under overflow controls.
- Existing design tokens and base components were useful, but the core screens needed a calmer, denser operational hierarchy.

## Implementation Strategy

1. Make Timeline parsing deterministic, editable, and testable before changing page composition.
2. Reuse `Project.config` for `executionTeams` so existing projects remain compatible without a project-table migration.
3. Add only additive issue schedule metadata if API round-trip persistence requires it. No destructive migration, `prisma db push`, or database reset is permitted.
4. Keep task `startDate` and `dueDate` separate for Timeline, Gantt, workday calculations, and exports. Only remove project `dueDate` from user-facing project forms.
5. Treat imported issues as a distinct source. Merge and replacement operations may update imported issues, while ordinary manually maintained issues remain untouched by default.
6. Complete P0 behavior and interaction structure before visual refinement.

## Timeline Import Rules

The target parser recognizes common Chinese and English field aliases, normalizes full-width text, preserves valid rows when other rows fail, groups recognized tasks into product phases, and retains unmatched tasks in the preview. Tasks inside a phase are sorted by `startDate`.

The target save behaviors are:

- `dates-only`: update project key dates without changing issues.
- `merge`: create new imported tasks and update only matching tasks previously imported from Timeline.
- `replace`: after confirmation, replace only tasks previously imported from Timeline; manually created tasks are preserved.

## Key Date Rules

- Project start: earliest valid task in the requirement phase.
- Development: earliest phase or task containing development terminology.
- Test: internal testing task first, then a general test phase or task.
- Acceptance: exact UAT task, UAT task, UAT phase, then acceptance terminology.
- Release: exact launch task, launch task, launch phase, then Launch, Release, or Go Live terminology.
- Missing matches stay empty. Every extracted date records the matched phase and task and remains editable before save.

## Data Model Plan

- Keep the existing project `description` API field while displaying the label “项目概述”.
- Store `executionTeams` as an array in `Project.config` beside `templateId`.
- Preserve legacy project `dueDate` data but stop collecting or fabricating it in project forms.
- Persist Timeline issue identity as additive schedule metadata only if required for reliable API merge and replace operations.

## Implemented Result

### P0-A: Project and Timeline flow

- Browser titles now default to `GridProject`; project pages use `Project Name | GridProject`.
- Project create/edit is a two-step flow that preserves basic information while Timeline parsing is retried.
- The form uses “项目概述”, supports execution-team multi-select, and no longer displays project `dueDate`.
- XLSX, XLSM, CSV, TSV, JSON, and TXT input shares one parser and one editable preview.
- Preview displays recognized phase count, valid task count, unmatched task count, failed-row count, editable key dates, and source records.
- Empty files, unsupported files, missing workbook Sheets, unrecognized headers, invalid dates, and no-valid-task input produce explicit errors.
- Valid rows survive partial-row failures. Unmatched tasks remain visible and importable.
- Create/save buttons lock while saving. Parse and save errors do not clear entered project fields.
- Import behavior is explicit: dates only, merge imported tasks, or replace imported tasks after confirmation.
- Merge never matches an ordinary task by title. An imported task updated after its import timestamp is preserved rather than overwritten.

### Timeline and date extraction

Timeline text is normalized with Unicode NFKC, trimmed, and matched without English case sensitivity. Recognized phases are requirements, design, content assets, content production, development, internal testing, testing, UAT, acceptance, and release. Tasks in each phase sort by valid `startDate`; unmatched tasks are retained.

- Project start: first dated requirement task.
- Development: first development phase or task, including program, web, frontend, backend, development, or engineering variants.
- Test: exact or contained internal testing task first, then a general test/QA phase or task.
- Acceptance: exact UAT task, UAT task, UAT phase, then acceptance phase/task.
- Release: exact launch task, launch/release task, release phase, then Launch, Release, or Go Live match.
- No match produces an empty date. Each match records phase, task, source label, and rule.

### Data model and API

- `Project.config.executionTeams` stores `商务`, `设计`, `开发`, and `特效` selections beside the existing template id. Old projects normalize to an empty array. Project config patches merge rather than overwrite unrelated keys.
- `Issue.scheduleData` is a new optional JSONB column holding Timeline key, model, owners, workdays, imported timestamp, and source. This makes merge/replace identity survive API reloads.
- Issue creation and patch schemas remain strict and do not accept `creatorId`; the backend continues setting `creatorId` from the authenticated user.
- API project payloads resolve the selected owner name to `ownerId`; internal Timeline and UI-only fields are not sent to strict endpoints.
- Migration: `prisma/migrations/20260621120000_add_issue_schedule_data/migration.sql` adds one nullable JSONB column. It does not delete, rewrite, or backfill existing data.

### P0-B: Structure and interaction

- Issue rows use a non-button row with a dedicated title button and independent status select. No propagation suppression is used.
- Gantt task names and timeline are separate. Tick and lane grid counts match exactly, row heights share one token, and only the timeline scrolls horizontally.
- Gantt supports a sticky scale, today line, overdue/completed tones, single-day milestone shape, and mobile schedule list.
- PersonPicker teleports to `body`, positions from the trigger rectangle, flips above when needed, clamps to the viewport, updates on resize/scroll, closes outside or on Escape, and restores trigger focus. Mobile uses `Modal`.
- `DetailPanel` now declares modal semantics, traps focus by default, locks body scroll, and stays out of the tab order when closed.

### P1/P2: Core workspace redesign

- The shell uses GridProject branding, persistent collapsed navigation, stable top bar, and global search.
- Dashboard remains a compact four-metric operational view with a dedicated project list and task queue.
- Project headers use one status control, a real project overview, owner/team/date property band, four compact signals, one primary create action, and overflow for Timeline/delete actions.
- Project library filters by project text, execution team, and status. Its table now emphasizes execution team, current phase, release date, and risk; mobile uses a readable list.
- Forms, Timeline preview, tables, Gantt, overlays, and responsive layouts share the existing token and component system documented in `DESIGN.md`.

## Priority Status

- P0-A: completed
- P0-B: completed
- P1: completed for the requested core shell, dashboard, project library, and project workspace
- P2: completed for shared tokens, responsive layouts, overlays, tables, forms, and Gantt
- P3: completed for unit, E2E, visual capture, comparison images, and build checks listed below

## Database Safety

No Dev or Prod database was connected during this implementation. No migration command was run. Prisma schema validation and client generation do not connect to a database. The generated migration is additive and reviewable, but it was intentionally not applied because this task forbids connecting to server Dev or Prod data.

## Main Files Changed

- Project Skill: `.codex/skills/frontend-design/`
- Timeline: `src/domain/scheduleImport.js`, `src/services/scheduleFileService.js`, `src/services/issueService.js`, `src/components/project/TimelineImportPanel.vue`, `src/components/project/ScheduleImportModal.vue`
- Project flow: `src/views/ProjectCreateView.vue`, `src/composables/useKiviflowStore.js`, `src/App.vue`
- Backend/data: `prisma/schema.prisma`, the additive migration, project/issue routes, and DTOs
- Interaction: `PersonPicker.vue`, `IssueTable.vue`, `GanttChart.vue`, `DetailPanel.vue`
- Core UI: App shell, dashboard, project table/list, project workspace, tokens, layout, component styles, and responsive styles
- Tests/evidence: Timeline unit tests, Playwright interaction/flow tests, visual test configuration/snapshots, `artifacts/ui-review/`
- Documentation: `DESIGN.md`, this audit

## Verification Results

- Frontend unit/domain suites: passed, including Timeline text/Excel parsing, date priority, partial errors, no-valid input, merge, dates-only, replacement, manual-task protection, project defaults, access, cost, and API-source checks.
- Frontend lint: passed.
- Frontend build: passed. ExcelJS is loaded as a separate on-demand chunk; the chunk-size warning remains informational.
- Backend TypeScript lint and build: passed.
- Backend integration and Dev smoke tests: 4 skipped with the required `TEST_DATABASE_URL` guidance because no temporary PostgreSQL service was available. They did not fall back to Dev or Prod.
- Prisma validate and generate: passed without a database connection.
- Focused Playwright flow/interaction suite: 9 passed.
- Playwright visual suite: 49 passed after intentional baseline update.
- Standalone visual capture: 32 scenarios passed with zero root overflow, console errors, page errors, dialog/viewport overflow, detected control overlap, or unexpected fixed obstruction.
- Baseline: `artifacts/ui-review/before/`
- After: `artifacts/ui-review/after/`
- Comparisons: `artifacts/ui-review/comparison/`
- Summary: `artifacts/ui-review/report.json`

## Known Limits And Follow-up

- The source repository did not contain a Timeline-specific Excel exporter or the referenced external Timeline review documents. This work preserves separate task dates and does not alter the existing cost Excel exporter, but Chinese/English/bilingual Timeline export, logo, Gantt bars, end-date star, and import-export round-trip remain unimplemented in this repository.
- Timeline import writes issues through existing authorized API calls. Project creation plus issue creation is not a single cross-request transaction; a network failure after project creation is reported explicitly, but can leave the project created before all tasks finish.
- Timeline replacement uses authorized soft deletion per imported issue. A future batch endpoint could make replacement atomic and faster for very large files.
- Persistent stage/task drag-order storage is not present in the current Prisma model. This work does not invent an incompatible ordering model.
- XLS (legacy binary Excel) is not supported by ExcelJS; use XLSX or XLSM.
- The additive migration was validated but not executed against any database in this task.
