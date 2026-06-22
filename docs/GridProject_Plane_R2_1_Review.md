# GridProject Plane R2.1 Review

## Scope

R2.1 only polishes the project library, home attention semantics, account overlays, personal settings layout, password verification rate limiting, and the R2 ownership inside `App.vue`. R1 workspace, Timeline import, Gantt, time entry, costs, platform settings, user management, deployment, project rules, and issue rules are unchanged.

## UI Decisions

- Project cards use 3 columns from 1440–1679px, 4 columns from 1680px, 2 columns from 768–1279px, and 1 column below 768px. Cards keep a minimum width of 300px.
- The project page header keeps only the secondary recycle-bin action. The toolbar is the single create-project entry.
- Home uses `待关注事项`, with explicit `已逾期` and `未来 7 天` groups. Mobile home renders two compact project cards before the attention list.
- Desktop account access is in the top bar. Mobile account access is in the shell bar, so the navigation drawer and account sheet cannot be open together.
- Personal settings fill the viewport, use a 260px identity/navigation rail, and keep the form reading width at 800px. Mobile navigation remains a single non-overflowing row.

## Password Verification Limit

`PATCH /api/auth/password` has a dedicated in-process failure bucket keyed by `userId + request IP`. Five current-password mismatches are allowed within 15 minutes; the sixth request returns 429. A successful password update clears the bucket. Verification failures and rate-limit responses create AuditLog entries containing only reason/count metadata, never password values. The current session remains active and other sessions are revoked after a successful update.

## Release Blocker

The server currently has a CORS origin allowlist and the session cookie uses `SameSite=Lax`, but there is no global server-side Origin/Referer enforcement or CSRF token protection for cookie-authenticated write requests. CORS headers alone do not prevent a write request from being processed. This remains a release blocker and must be resolved before a production release.

## Evidence

Screenshots and machine-readable checks are generated under `artifacts/plane-r2-1/`. QA scenarios use local in-memory data and do not write to an API or database.
