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

## Priority Status

- P0-A: in progress
- P0-B: pending
- P1: pending
- P2: pending
- P3: pending

## Database Safety

No Dev or Prod database was connected during this audit. No migration command was run. Any migration produced by this work will be reviewable SQL only and will not target `gridproject_prod`, port `5433`, or an unknown database.

## Files Changed So Far

- `.codex/skills/frontend-design/SKILL.md`
- `.codex/skills/frontend-design/LICENSE.txt`
- `docs/GridProject_Implementation_Audit.md`

## Risks And Follow-up

- Excel workbook behavior requires browser and automated parser coverage because workbook layouts vary.
- API-mode Timeline replacement needs explicit source metadata and authorization-aware deletion behavior.
- Visual snapshots must be regenerated only after functional changes stabilize.
- Final test evidence and unresolved constraints will be appended after implementation.
