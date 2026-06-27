# GridProject Cost Time Workspace Review

## Scope

- Branch: `codex/gridproject-cost-time-workspace`
- Base main SHA: `d87dea6b9d07113af7ae07d3042893d5d1ca2919`
- Primary routes: `/?view=timesheets`, `/?view=timesheet-list`, `/?view=costs`
- Test roles: local visual admin-role context and local visual member-role context.
- Sensitive data: no passwords, cookies, tokens, localStorage, sessionStorage, user credentials, or authentication payloads are included in this review package.

## Screenshot Index

| File | Round / State | Route | Viewport | Role |
| --- | --- | --- | --- | --- |
| `round-1-admin-nav.png` | Round 1 navigation check | `/?view=timesheets` | 1440x900 | Admin |
| `round-1-member-nav.png` | Round 1 navigation check | `/?view=timesheets` | 1440x900 | Member |
| `round-1-timesheet-fill-1440.png` | Round 1 fill page check | `/?view=timesheets` | 1440x900 | Admin |
| `round-1-timesheet-list-admin.png` | Round 1 list page check | `/?view=timesheet-list` | 1440x900 | Admin |
| `round-1-cost-admin.png` | Round 1 cost page check | `/?view=costs` | 1440x900 | Admin |
| `round-2-timesheet-fill-1440.png` | Round 2 fill page after list-width fix | `/?view=timesheets` | 1440x900 | Admin |
| `round-2-timesheet-list-admin.png` | Round 2 list page after list-width fix | `/?view=timesheet-list` | 1440x900 | Admin |
| `round-3-timesheet-fill-1440.png` | Round 3 final fill page polish | `/?view=timesheets` | 1440x900 | Admin |
| `round-3-timesheet-list-admin.png` | Round 3 final list page polish | `/?view=timesheet-list` | 1440x900 | Admin |
| `admin-cost-time-nav-expanded.png` | Required navigation state | `/?view=timesheets` | 1440x900 | Admin |
| `member-cost-time-nav-expanded.png` | Required navigation state | `/?view=timesheets` | 1440x900 | Member |
| `timesheet-fill-default-1920.png` | Required fill page | `/?view=timesheets` | 1920x1080 | Admin |
| `timesheet-fill-default-1440.png` | Required fill page | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-pending-current-month.png` | Required pending month | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-pending-history-month.png` | Required pending history month | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-pending-empty.png` | Required pending complete state | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-my-submissions.png` | Required tab state | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-my-responsible.png` | Required tab state | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-daily-modal.png` | Required modal state | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-daily-success.png` | Required success state | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-empty-projects.png` | Required empty project state | `/?view=timesheets` | 1440x900 | Member |
| `timesheet-error-state.png` | Required form error state | `/?view=timesheets` | 1440x900 | Admin |
| `timesheet-list-admin.png` | Required full list | `/?view=timesheet-list` | 1440x900 | Admin |
| `timesheet-list-member.png` | Required full list | `/?view=timesheet-list` | 1440x900 | Member |
| `timesheet-list-filters.png` | Required filtered list | `/?view=timesheet-list` | 1440x900 | Admin |
| `timesheet-list-empty.png` | Required empty list | `/?view=timesheet-list` | 1440x900 | Admin |
| `cost-management-admin.png` | Required cost page | `/?view=costs` | 1440x900 | Admin |
| `cost-management-member-denied.png` | Required denied state | `/?view=costs` | 1440x900 | Member |

## Operation Steps

1. Verified GitHub SSH, fetched origin, fast-forwarded latest `main`, confirmed a clean worktree, and created `codex/gridproject-cost-time-workspace`.
2. Reworked the left navigation into `成本工时` with `工时填报`, `工时列表`, and admin-only `成本管理`.
3. Rebuilt the timesheet fill page around the requested hierarchy: title, pending workdays, role tabs, cycle/fill mode, weekly stats, weekly table, and compact list preview.
4. Added a standalone full `工时列表` page with range, month, project, user, status, and issue-link filters.
5. Kept cost management on the existing page and existing admin guard in the app shell.
6. Added a shared frontend timesheet visibility helper and kept backend create/edit/submit rules restricted to the current user's own draft records.
7. Captured Round 1 screenshots, compared the list and fill page against the reference, and identified that the full list table hid the `操作` column at 1440.
8. Captured Round 2 screenshots after list density and width fixes; verified 1440 horizontal overflow was 0.
9. Captured Round 3 screenshots after final spacing, row-height, empty-state, and no-project refinements.
10. Ran admin and member Chromium smoke flows using isolated local visual contexts.

## Expected And Actual Results

| Area | Expected | Actual |
| --- | --- | --- |
| Admin navigation | `成本工时` expands and shows all three children. | Passed; `工时填报`, `工时列表`, and `成本管理` are visible. |
| Member navigation | `成本管理` is hidden. | Passed; only `工时填报` and `工时列表` are visible. |
| Member direct cost access | Member is blocked from `成本管理`. | Passed; app redirects away and shows a no-permission toast. |
| Admin fill ownership | Admin cannot choose another applicant. | Passed; daily modal applicant is the current user and disabled. |
| Member list scope | Member does not see cost management and sees only allowed timesheet rows. | Passed in member visual context. |
| Pending dates | Weekends and future dates are excluded; submitted dates are removed; drafts remain visible as pending. | Passed; draft dates show a `草稿` marker. |
| Weekly table | Monday-Friday only, future days disabled, project rows added manually. | Passed. |
| Full list | Complete detail fields and filters are available. | Passed; 1440 list table shows `操作` without horizontal overflow. |
| Empty states | No large dashed empty state in cost-time workspace. | Passed; cost-time empty states use solid light borders. |

## Error Counts

- Round 1 Chromium check: Console errors `0`, pageerrors `0`, failed requests `0`, HTTP 4xx/5xx `0`.
- Round 2 Chromium check: Console errors `0`, pageerrors `0`, failed requests `0`, HTTP 4xx/5xx `0`.
- Round 3 and required-state Chromium check: Console errors `0`, pageerrors `0`, failed requests `0`, HTTP 4xx/5xx `0`.
- Maximum measured horizontal overflow: `0px`.

## Measurements

- 1920x1080 fill page content width: `1480px`.
- 1440x900 fill page content width: `1172px`.
- Pending panel height after final polish: `185px`; empty pending panel: `134px`.
- Weekly stat card height: `104px`.
- Admin full list rows in review data: `9`.
- Member full list rows in review data: `6`.
- Filtered list rows in review data: `2`.

## Round Findings And Fixes

| Round | Findings | Fixes |
| --- | --- | --- |
| Round 1 | Navigation grouping worked and member cost menu was hidden. Timesheet hierarchy matched the requested order, but the new full list table overflowed at 1440 and hid the `操作` column. | Compressed the full-list columns, reduced row text size slightly, and kept all required fields visible in the 1440 content area. |
| Round 2 | List overflow was fixed and measured at `0px`. The fill page was stable, but the list and pending sections could be a little tighter. | Reduced final list row height and pending-panel vertical gap/padding. |
| Round 3 | Final screenshots showed the no-project state still exposed fill actions and used the global dashed empty-state style. | Hid fill actions when no reportable projects exist and overrode cost-time empty states to solid light borders only within the cost-time workspace. |

## Final Differences

- Cost management content and calculation remain the existing implementation; this task only moved it under the `成本工时` navigation parent and preserved the existing guard.
- The UI keeps GridProject's current query-string routing model rather than introducing a new router.
- The screenshots use isolated local visual contexts for role coverage; no authentication state or credentials are stored or submitted.
