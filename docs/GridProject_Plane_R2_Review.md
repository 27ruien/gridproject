# GridProject Plane R2 Review

## Scope

R2 is limited to the home page, project library, account menu, personal profile, preferences, and security settings. It does not change Gantt, time entry, cost management, platform settings, user management, Timeline import, project/issue business rules, or the R1 project workspace.

## Product Decisions

- User-facing navigation uses `主页`; the internal route key remains `dashboard` for compatibility.
- The project library is card-only. Search, sort, filters, create, and filter chips share one compact toolbar.
- Project marks use a stable color derived from project ID and do not load network images.
- Home uses compact project cards and does not show four equal metric cards.
- Due items are filtered to authorized projects and exclude `已完成`、`已关闭`、`已验收`.
- The account menu is an anchored popover on desktop and a bottom sheet below 768px.
- Personal settings have stable URLs and support browser history.

## Persistence

The additive migration `20260622120000_add_user_preferences` adds nullable `users.preferences JSONB`. It stores density, date format, week start, navigation default, home due range, and avatar color. No production or Dev database was connected while preparing R2; only Prisma validate/generate are permitted during local verification.

Local demo mode persists profile and preferences through the existing Storage Adapter. API mode persists them through authenticated `/api/auth/profile` and `/api/auth/preferences` routes.

## Password Session Behavior

`PATCH /api/auth/password` verifies the current password, validates the new password, hashes it with Argon2id, keeps the current session, revokes other active sessions for that user, and writes the user update plus AuditLog in one transaction. Password hashes and session token hashes are never returned.

## Visual Evidence

R2 screenshots and comparisons are generated under `artifacts/plane-r2/`. QA scenarios use local in-memory data with unique `plane-r2-*` identifiers and never write to an API or database.

## Deferred

- R3 modules are not started.
- Platform settings and organization-wide language/theme options remain out of scope.
- Password updates are intentionally unavailable as persistence operations in local demo mode; frontend validation remains testable there.
