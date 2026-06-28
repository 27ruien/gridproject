# GridProject React + shadcn/ui Full Rewrite Product Audit

Date: 2026-06-28

Branch: `codex/react-shadcn-full-rewrite`

Base main SHA: `d768f39 feat(timesheet): introduce cost time workspace`

## Scope

This audit records the Vue frontend before the rewrite. It is the parity baseline for replacing the frontend with React + TypeScript + Vite + shadcn/ui while preserving the existing backend, API semantics, database, permissions, authentication, cost calculations, time-entry rules, and deployment output path.

## Technical Architecture

| Area | Current State |
| --- | --- |
| Current Vue frontend directory | `src/` at repository root |
| Current frontend entry | `src/main.js` imports `createApp` from Vue, mounts `src/App.vue`, and imports `src/styles.css` |
| Current root app | `src/App.vue` controls auth state, URL state, app shell, route-like view switching, global overlays, and CRUD event bridges |
| Router | No Vue Router package. Route state is custom query/path handling in `src/composables/useRouteState.js`; navigation keys come from `src/router/routes.js` |
| Pinia or global store | No Pinia package. State is a Vue reactive singleton in `src/composables/useKiviflowStore.js` backed by `src/services/stateService.js` |
| API client | `src/services/apiClient.js` wraps `fetch`, sends `credentials: include`, parses JSON errors, and triggers registered unauthorized handlers on 401 |
| API mode switch | `VITE_DATA_SOURCE=api` enables real API mode; default local mode uses localStorage demo data |
| Login authentication | API mode uses `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`; session restoration calls `/api/auth/me` and `/api/bootstrap` |
| Token or cookie mechanism | HttpOnly cookie set by Fastify backend; frontend does not read token; `fetch` uses `credentials: include` |
| Environment variables | `VITE_DATA_SOURCE`, `VITE_API_BASE_PATH` / `VITE_API_BASE_URL`, `VITE_APP_BASE_PATH`, `VITE_APP_ENV`; backend uses `DATABASE_URL`, `SESSION_SECRET`, cookie options, `FRONTEND_ORIGIN` |
| Permissions implementation | Frontend imports policy modules from `src/server/policies/*` plus `src/domain/access.js`. Backend has parallel TypeScript access rules under `server/src/policies/access.ts` |
| File upload | Timeline import supports local file upload in `src/components/project/TimelineImportPanel.vue`; parsing is handled by `src/services/scheduleFileService.js` |
| Download and export | Cost export calls `/api/cost-records/:id/export`, receives a binary response, and downloads an Excel file in `downloadResponse()` |
| Forms | Plain Vue forms with custom validation in each page/component; no form library |
| Charts | No chart library. Progress, cost, and timeline visuals are custom HTML/CSS |
| Rich text | No rich-text editor. Descriptions and comments are plain textarea/input |
| Date library | No date library. Date utilities are hand-written in views/domain services |
| Internationalization | No i18n package. UI text is inline Chinese |
| Current build scripts | `npm run dev` -> Vite; `npm run build` -> Vite build; `npm run frontend:lint` -> custom JS syntax checker; `npm run test` -> Node domain tests; `npm run test:visual` -> Playwright |
| Current deployment output | Vite `dist/` at repository root |
| Nginx/static dependency | Deployment docs serve Vite `dist/` and reverse proxy `/api/`; base path is controlled by `VITE_APP_BASE_PATH`; production examples use `/tool/project/` and dev examples use `/tool/dev/project/` |

## Existing Frontend Structure

| Path | Purpose |
| --- | --- |
| `src/views/*.vue` | Page-level Vue views: login, home, project library, project creation modal, project workspace, timesheets, costs, users, settings, trash, personal settings |
| `src/components/ui/*.vue` | Custom Vue UI primitives: AppShell, Button, Modal, DetailPanel, DataTable, filters, tabs, toast, confirm dialog, icons |
| `src/components/project/*.vue` | Project library, project header, board, Gantt, Timeline import, toolbar |
| `src/components/issue/*.vue` | Issue cards, table, filters, create modal, detail drawer |
| `src/components/account/*.vue` | Account menu and personal settings panels |
| `src/components/common/*.vue` | Empty state, person picker, priority/progress helpers |
| `src/composables/*.js` | Vue state, route state, overlay state, search, project workspace helpers |
| `src/domain/*.js` | Framework-independent project, issue, workflow, schedule, cost, time, user preference, access, trash rules |
| `src/services/*.js` | API client, local state service, project/issue/user/cost/time services, password helpers |
| `src/storage/*.js` | localStorage and API storage adapter boundary |
| `src/styles/` | Existing design tokens, reset, layout, component CSS, responsive CSS |
| `src/qa/visualScenarios.js` | Old local visual scenario data injection |

## Complete Page Inventory

| Page/Module | Current Route Mechanism | Current Vue Files | Key Existing Capabilities |
| --- | --- | --- | --- |
| Login | `/login` path in custom URL state when API mode unauthenticated | `src/views/LoginView.vue`, `src/App.vue` | Email/password form, submit on Enter, error text, loading state, session restoration, logout |
| Home | `?view=dashboard` | `src/views/DashboardView.vue` | Greeting, current date/week, accessible project cards, due tabs for all/mine/others, week time summary, risk list, quick jump to timesheets/projects |
| Project library | `?view=projects` | `src/views/ProjectLibraryView.vue`, project card/grid/toolbar/filter components | Card-style project library, search, sort, status/team/owner/phase/release/risk filters, create entrypoint, edit project, trash entrypoint, empty state |
| Project create/edit | Global modal rather than route | `src/views/ProjectCreateView.vue`, `TimelineImportPanel.vue` | Two-step basic/timeline flow, template choice, owner/team/status/date fields, Timeline upload/paste/import behavior, edit existing project |
| Project details | `?view=project&project=:id&tab=:tab` | `src/views/ProjectWorkspaceView.vue`, project/issue components | Header, project status update, edit/delete/import actions, overview, work items, milestone, delivery/acceptance, risk views |
| Project overview | Project tab `概览` | `ProjectWorkspaceView.vue` | Completion/health/hour/milestone metrics, attention filters, weekly people/items view, recent activity, upcoming milestones/delivery, team load |
| Project tasks/work items | Project tab `工作项` | `ProjectWorkspaceView.vue`, `AgileBoard.vue`, `IssueTable.vue`, `IssueCard.vue`, `ViewToolbar.vue` | Kanban/list/table/Gantt modes, group by status/phase/owner/priority, keyword/date/owner/creator filters, sort, density, pagination, status changes |
| Gantt | Work item sub-view `甘特图` | `src/components/project/GanttChart.vue` | Day/week/month scale, search, status filter, overdue filter, grouped rows, expand/collapse, today jump, task bars, milestone/overdue/weekend cues, mobile cards |
| Project members | Within project header/workspace permissions and users data; no dedicated current Vue tab | `ProjectContextHeader.vue`, `UserManagementView.vue`, policy modules | Project owner/member concepts enforced by policies; member API exists (`projectMembers`) but current workspace has no standalone member tab UI |
| Issue create modal | Global modal | `src/components/issue/IssueCreateModal.vue` | Type/title/owner/priority/status/dates/hours/description/next fields |
| Issue detail drawer | Global detail panel | `src/components/issue/IssueDrawer.vue` | Tabs for details, comments, time entries, activity; edit issue, add comment, add linked time entry, delete issue |
| Schedule import modal | Global modal | `src/components/project/ScheduleImportModal.vue`, `TimelineImportPanel.vue` | File upload or pasted text, parse preview, dates-only/merge/replace behavior, warnings |
| Timesheet fill | `?view=timesheets` | `src/views/TimesheetView.vue` | My submissions, my responsible projects, pending dates/month switching, week editor, add project row, daily submit, draft/submitted states, edit draft, submit draft, success modal, empty/error states |
| Timesheet list | `?view=timesheet-list` | `src/views/TimesheetListView.vue` | Month/time/project/person/status filters, search, pagination, status display, submit draft, admin/project-owner visibility logic |
| Cost management | `?view=costs` guarded by admin in current shell | `src/views/CostManagementView.vue` | Admin-only shell route, list active cost records, filters, create record, detail panel, weekly filter, edit planned person-days and standard hours/day, raw data preview, Excel export |
| People management | `?view=users` guarded by admin in current shell | `src/views/UserManagementView.vue` | Admin-only list, search/filter/sort/pagination, detail panel, create/edit user, activate/deactivate, soft delete, reset password, project and time stats |
| Platform settings | `?view=settings` guarded by admin in current shell | `src/views/PlatformSettingsView.vue` | Edit platform name and 1-2 character logo text only |
| Personal settings | Path overlay `/profile`, `/preferences`, `/security` | `src/views/PersonalSettingsView.vue`, account panels | Profile name/avatar color, preferences (density/date/week/nav/home due range), security password update, account menu |
| Security settings | Personal settings `security` section | `SecuritySettingsPanel.vue` | API-only current/new/confirm password fields, visibility toggles, validation |
| Trash | `?view=trash` | `src/views/TrashView.vue` | List soft-deleted project/issue/milestone/cost/user items, 30-day restore window |
| No permission | Current implementation redirects to dashboard with toast for admin-only pages; project access redirects with toast | `src/App.vue` guards | No dedicated full page yet; React rewrite must add one |
| 404 | No dedicated Vue 404 route because custom state falls back to dashboard | `useRouteState.js`, `App.vue` | React rewrite must add one |

## Modal, Drawer, Dropdown, Empty, and Error Inventory

| Surface | Current Files | Notes |
| --- | --- | --- |
| Project create/edit modal | `ProjectCreateView.vue` | Basic fields plus Timeline step |
| Issue create modal | `IssueCreateModal.vue` | Creates issue in current project |
| Issue drawer | `IssueDrawer.vue` + `DetailPanel.vue` | Edit issue, comment, linked time entry, activity, delete |
| Schedule import modal | `ScheduleImportModal.vue`, `TimelineImportPanel.vue` | Upload/paste parser; import confirmation for replace lives in `App.vue` confirm dialog |
| Time-entry cell modal | `TimesheetView.vue` | Week cell draft edit/create |
| Daily time-submit modal | `TimesheetView.vue` | Immediate submitted entry |
| Time-entry result modal | `TimesheetView.vue` | Confirmation after daily submit |
| Cost create modal | `CostManagementView.vue` | Project, planned hours/person-days, standard hours/day |
| Cost detail drawer/panel | `CostManagementView.vue`, `DetailPanel.vue` | Summary, settings, people, raw data, export |
| User detail drawer/panel | `UserManagementView.vue`, `DetailPanel.vue` | Profile, participation, stats |
| User create/edit/reset modals | `UserManagementView.vue` | Admin operations |
| Confirm dialog | `ConfirmDialog.vue` | Delete project, delete issue, timeline replace, user status/delete |
| Account dropdown | `AccountMenu.vue`, `AccountMenuContent.vue` | Profile/preferences/security/timesheet shortcuts/logout |
| Overflow menus | `OverflowMenu.vue`, ProjectCard, IssueCard/Table, UserManagement | Low-frequency row/card actions |
| Filter popovers/surfaces | `FilterSurface.vue`, `ProjectFilterPopover.vue`, `FilterPopover.vue` | Project/issue/gantt/cost/user filters |
| Empty states | `EmptyState.vue` and inline page text | Project library, dashboard projects, work items, risks, delivery, timesheet, cost, users, trash |
| Error states | Inline form errors, toast messages, API error text | No global error boundary; React rewrite must add one |

## Permissions Baseline

Existing permissions are not a single role-only model. They combine organization role, active user status, project ownership, project creator, active project membership, resource ownership, and backend validation.

| Actor | Meaning |
| --- | --- |
| Ordinary member | Active `MEMBER` user, not necessarily a member of the target project |
| Project member | Active project membership for a project |
| Project creator | `project.createdById === user.id` |
| Project lead / owner | `project.ownerId === user.id` |
| Project Owner | Same persisted owner concept as project lead in current code |
| Organization administrator | Active `ADMIN` user in the same organization |

| Page/Operation | Ordinary Member | Project Member | Project Creator | Project Owner/Lead | Organization Admin |
| --- | --- | --- | --- | --- | --- |
| Login/logout/session restore | Yes for active users | Yes | Yes | Yes | Yes |
| Home | Yes, but only accessible projects/issues | Yes | Yes | Yes | Yes, all org projects/issues |
| Project library view | Only owned/created/member projects | Active member projects | Created projects | Owned projects | All non-deleted org projects |
| Create project | Any active user may create | Any active user may create | Yes | Yes | Yes |
| View project detail/board | No unless owner/creator/member | Yes | Yes | Yes | Yes |
| Edit project | No | No unless owner/admin | Current policy `canUpdateProject` currently allows owner/admin only; creator gets cost/time visibility but not general edit unless owner | Yes | Yes |
| Delete project | No | No | Same as edit: owner/admin only | Yes, if no blocking backend rule | Yes, if backend permits |
| Manage project members | No | No | Same as edit: owner/admin only | Yes | Yes |
| Create issue/task | Requires visible project; backend/project visibility applies | Yes in visible project | Yes | Yes | Yes |
| Edit issue/task | Requires visible project and backend validation | Yes in visible project | Yes in visible project | Yes | Yes |
| Delete issue/task | Requires visible project and backend validation | Limited by backend/project visibility | Yes in visible project | Yes | Yes |
| View own time entries | Own only | Own only | Own and owned/created project scoped lists | Own and project scoped lists | All org entries |
| Create time entry | Only for self, only active member of selected project | Yes, self only | Self only, if active project member | Self only, if active project member | Self only, if active project member; admin cannot fill for another user |
| Edit/delete/submit time entry | Own draft only | Own draft only | Own draft only | Own draft only | Own draft only |
| Approve/reject time entry | No | No | Current server policy allows admin or project owner; creator gets list visibility but not approval unless owner/admin | Yes for submitted entries | Yes for submitted entries |
| View others' time entries | No | No by membership alone | Owned/created project list via current frontend services; backend supports owner/creator/admin visibility in list | Owned project entries | All org entries |
| Timesheet export | No | No | Not currently exposed as standalone UI except cost export; policy has project owner/admin export for time entries | Yes by policy | Yes |
| Cost management page | No | No | Cost policy allows creator/owner/admin by record/project; current shell only exposes route to admin | Cost policy allows owner, but current shell only exposes route to admin | Yes |
| Create/edit/delete/export cost record | No | No | Allowed by cost policy if creator; current UI route prevents access unless admin | Allowed by cost policy; current UI route prevents access unless admin | Yes |
| People management | No | No | No | No | Yes |
| Platform settings | No | No | No | No | Yes |
| Personal settings | Own account only | Own account only | Own account only | Own account only | Own account only |
| Trash restore | Depends on type and backend/project scope | Depends on type and backend/project scope | Project-scoped restore when creator/owner/admin rules allow | Project-scoped restore | Admin can restore allowed org resources |

Important invariants for React rewrite:

- Admin users must not be able to create time entries for other people.
- Project owners/leads must not be able to create time entries for other people.
- Ordinary members must not access cost management.
- Users outside a project must not view project content.
- Hiding buttons is not sufficient; routes/pages/actions must also check policy and backend errors must be surfaced.

## Backend/API Baseline

The rewrite must preserve the existing Fastify API contract.

| API Module | Current Endpoints Used by Frontend |
| --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/profile`, `PATCH /api/auth/preferences`, `PATCH /api/auth/password` |
| Bootstrap | `GET /api/bootstrap` |
| Users | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`, `POST /api/users/:id/restore`, `POST /api/users/:id/reset-password` |
| Projects | `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`, `GET /api/projects/:id/board` |
| Project members | `GET /api/projects/:projectId/members`, `POST /api/projects/:projectId/members`, `PATCH /api/projects/:projectId/members/:memberId`, `DELETE /api/projects/:projectId/members/:memberId` |
| Issues | `GET /api/projects/:projectId/issues`, `POST /api/projects/:projectId/issues`, `GET /api/issues/:issueId`, `PATCH /api/issues/:issueId`, `DELETE /api/issues/:issueId`, `POST /api/issues/:issueId/restore` |
| Comments | `GET /api/issues/:issueId/comments`, `POST /api/issues/:issueId/comments`, `PATCH /api/comments/:commentId`, `DELETE /api/comments/:commentId` |
| Milestones | `GET /api/projects/:projectId/milestones`, `POST /api/projects/:projectId/milestones`, `PATCH /api/milestones/:milestoneId`, `DELETE /api/milestones/:milestoneId`, `POST /api/milestones/:milestoneId/restore` |
| Time entries | `GET /api/time-entries`, `POST /api/time-entries`, `PATCH /api/time-entries/:id`, `POST /api/time-entries/:id/move`, `DELETE /api/time-entries/:id`, `POST /api/time-entries/:id/submit`, `POST /api/time-entries/:id/approve`, `POST /api/time-entries/:id/reject` |
| Cost records | `GET /api/cost-records`, `POST /api/cost-records`, `GET /api/cost-records/:id`, `PATCH /api/cost-records/:id`, `DELETE /api/cost-records/:id`, `POST /api/cost-records/:id/restore`, `GET /api/cost-records/:id/summary`, `GET /api/cost-records/:id/raw-data`, `GET /api/cost-records/:id/export` |
| Settings | `GET /api/settings`, `PATCH /api/settings` |
| Trash | `GET /api/trash`, `POST /api/trash/:type/:id/restore` |

## Rewrite Risks and Required Parity Checks

- The Vue app does not use Vue Router; React Router must introduce real routes while maintaining query-compatible deep links where useful.
- Local demo mode is used by old visual tests; React must preserve local state hydration unless API mode is explicitly enabled.
- Current frontend imports `src/server/policies/*.js`; React should move or convert shared policies into frontend-safe TypeScript modules so source does not contain server-only paths.
- Current cost route is admin-only at shell level, while cost policy allows project owner/creator. The rewrite must preserve effective current behavior unless explicitly changing it is required; ordinary members still cannot access costs.
- Project members API exists but current workspace lacks a dedicated members tab. React rewrite should add a project members view to satisfy product requirements without changing backend semantics.
- Current no-permission and 404 are toast/redirect based. React rewrite must add explicit pages.
- File upload and Excel download need real browser verification.
