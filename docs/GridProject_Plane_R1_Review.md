# GridProject Plane R1 Visual Review

## Review Boundary

This review covers only the real App Shell, project context header, project tabs and view toolbar, issue list, and Kanban board. Engineering checks and screenshot automation do not constitute visual approval. The user decides whether this round passes visual review.

## Checklist

1. **Was the repeated page title removed?**

   Yes. The app-level `Project Space` title was removed. The 46px Top Bar now carries only `Projects / {project}` context, and the project header owns the single page title.

2. **Is the project name the page's primary visual anchor?**

   Yes. A compact project mark and 20px project name lead the content area, followed by a status lozenge and actions. No larger competing title remains.

3. **Does the Header still lay out many properties horizontally?**

   No. Owner, teams, four dates, health, progress, open count, and schedule risk moved into the `Project properties` popover. Only a non-zero schedule-risk alert remains visible beside the status.

4. **Do Tabs and Toolbar form a clear hierarchy?**

   Yes. Project identity is followed by a divider-based tab row and then one compact view toolbar. The active tab uses a restrained underline; sorting and display are grouped inside View Options so mobile keeps view/search/filter/create on one row.

5. **Does the Toolbar still resemble an admin query form?**

   No. Dates and people are available on demand in the Filter popover. Active constraints appear as removable chips, and `Clear all` appears only when filters exist.

6. **Can the issue list be scanned quickly?**

   More quickly than the baseline. Each 40-42px row now follows type, code, strongest title, state, priority, owner avatar, due date, and overflow. Row dividers replace individual card borders. Hover, selected, and keyboard-focus states are distinct.

7. **Do Kanban cards still resemble edit forms?**

   No. The persistent state select was removed. Cards now prioritize type/code, a two-line title, priority, due date, and assignee. Status changes remain available through drag, the card menu, and issue details.

8. **Are there still cards nested inside cards?**

   Not in the five reviewed regions. Desktop board columns are background lanes rather than cards; mobile status groups are unframed sections. Project properties are a popover, not another card inside the header.

9. **Does the UI still depend on many borders for grouping?**

   Less than the baseline. The shell and project workspace use continuous surfaces, spacing, and dividers. Borders remain where they communicate a real boundary: popovers, the list container, board cards, and focus/drop targets.

10. **Does the UI still rely heavily on low-contrast small text?**

    Reduced, but not eliminated. Primary work text is 14px with higher contrast; navigation and controls are 13px; 12px is limited to codes, dates, counts, and secondary metadata. Some dense metadata remains intentionally secondary.

11. **What are the three most visible remaining differences from Plane?**

    - Plane has deeper workspace/project navigation and more project-specific sections in the Sidebar; GridProject retains its smaller global product navigation because no new business modules were allowed.
    - Plane cards can show richer labels, real member photos, and more expressive item-type icons. GridProject's current data model provides names and types but no label collection or avatar media, so R1 uses initials and restrained generated marks.
    - Plane exposes richer layout/grouping/display controls and a mature command-search experience. GridProject preserves its existing view, sort, filter, and density capabilities rather than inventing unsupported grouping rules.

12. **Which pages should a later round extend to?**

    Dashboard modules, project library rows, issue detail drawer, Gantt chrome, time entry, cost, people, and settings can be reviewed in later rounds. They were intentionally left outside R1 except for inheriting the new App Shell.

## Screenshot Evidence

- `artifacts/plane-r1/after/project-list-1440x900.png`
- `artifacts/plane-r1/after/project-board-1440x900.png`
- `artifacts/plane-r1/after/project-list-1280x800.png`
- `artifacts/plane-r1/after/project-board-1280x800.png`
- `artifacts/plane-r1/after/project-list-390x844.png`
- `artifacts/plane-r1/after/project-board-390x844.png`
- `artifacts/plane-r1/comparison/project-list-comparison.png`
- `artifacts/plane-r1/comparison/project-board-comparison.png`
- `artifacts/plane-r1/comparison/shell-comparison.png`

The original automated capture report is `artifacts/plane-r1/report.json`. The visual-acceptance revision produces new evidence under `artifacts/plane-r1-revision/`; neither report marks visual alignment as accepted.
