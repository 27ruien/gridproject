# React shadcn Full Rewrite Manifest

Generated: 2026-06-28T06:46:52.588Z
Base URL: http://127.0.0.1:5173

## Three Round Review Notes

| Round | Focus | Corrections recorded |
| --- | --- | --- |
| Round 1 | Functional structure and page parity | Rebuilt React routes, app shell, project workflow, time/cost, people/settings/profile pages. |
| Round 2 | shadcn/ui density, spacing, and responsive structure | Consolidated UI on shadcn/Radix primitives, Tailwind tokens, compact tables, tabs, sheets and dialogs. |
| Round 3 | Empty/error/disabled/mobile states | Added forbidden/404, empty filters, disabled permission actions, mobile Sheet navigation and responsive captures. |

## Screenshots

| Screenshot | Route | Viewport | Role | Steps | Expected | Actual | Console error | Page error | Failed request |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/login-1440.png | /login?preview=1 | 1440x900 | preview | Open route | 登录页可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/home-member-1920.png | / | 1920x1080 | member | Open route | 成员首页可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/home-admin-1440.png | / | 1440x900 | admin | Open route | 管理员首页可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-library-member-1440.png | /projects | 1440x900 | member | Open route | 项目库可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-library-empty-1440.png | /projects | 1440x900 | member | Run page action | 项目库空状态可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-create-dialog-1440.png | /projects | 1440x900 | member | Run page action | 项目创建弹窗可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-detail-overview-1440.png | /projects/crm | 1440x900 | member | Open route | 项目概览可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-detail-1920.png | /projects/crm | 1920x1080 | member | Open route | 项目详情 1920 可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-tasks-1440.png | /projects/crm | 1440x900 | member | Open tab 工作项; Open route | 工作项页签可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-gantt-1440.png | /projects/crm | 1440x900 | member | Open tab 甘特图; Open route | 甘特图页签可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-members-1440.png | /projects/crm | 1440x900 | member | Open tab 成员; Open route | 成员页签可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-milestones-1440.png | /projects/crm | 1440x900 | member | Open tab 里程碑; Open route | 里程碑页签可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-delivery-1440.png | /projects/crm | 1440x900 | member | Open tab 交付与验收; Open route | 交付与验收页签可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-risk-1440.png | /projects/crm | 1440x900 | member | Open tab 风险; Open route | 风险页签可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/issue-sheet-1440.png | /projects/crm?issue=i1 | 1440x900 | member | Open route | 事项详情 Sheet 可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/schedule-import-dialog-1440.png | /projects/crm | 1440x900 | member | Run page action | 排期导入弹窗可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/timesheet-member-1440.png | /timesheets | 1440x900 | member | Open route | 工时填报可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/timesheet-list-member-1440.png | /timesheet-list | 1440x900 | member | Open route | 工时列表可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/trash-member-1440.png | /trash | 1440x900 | member | Open route | 回收站可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/costs-admin-1440.png | /costs | 1440x900 | admin | Open route | 成本管理可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/costs-admin-1920.png | /costs | 1920x1080 | admin | Open route | 成本管理 1920 可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/people-admin-1440.png | /people | 1440x900 | admin | Open route | 人员管理可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/settings-admin-1440.png | /settings | 1440x900 | admin | Open route | 平台设置可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/profile-member-1440.png | /profile | 1440x900 | member | Open route | 个人资料可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/preferences-member-1440.png | /profile/preferences | 1440x900 | member | Open route | 偏好设置可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/security-member-1440.png | /profile/security | 1440x900 | member | Open route | 安全设置可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/forbidden-member-1440.png | /costs | 1440x900 | member | Open route | 普通成员成本页无权限 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/not-found-1440.png | /missing-react-route | 1440x900 | member | Open route | 404 页面可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/mobile-nav-admin-390.png | / | 390x844 | admin | Run page action | 移动端导航 Sheet 可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/project-mobile-390.png | /projects/crm | 390x844 | member | Open route | 项目详情移动端可见 | Pass | None | None | None |
| artifacts/ui-review/react-shadcn-full-rewrite/screenshots/timesheet-mobile-390.png | /timesheets | 390x844 | member | Open route | 工时填报移动端可见 | Pass | None | None | None |

## Differences From Original Vue

- Routes now use React Router path routes instead of Vue/query-state routes.
- UI primitives now come from shadcn/ui and Radix React components.
- Local demo mode keeps the same seed business data, while API mode still uses HttpOnly cookie-backed backend sessions.
- Old Vue Plane-oriented visual scenarios were replaced by React-route Chromium captures.

## Open Issues

- None recorded by the capture script. Manual review should still inspect the PNGs before release.

