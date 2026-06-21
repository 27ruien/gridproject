# GridProject Plane R1 Core Workspace Mapping

## Scope

This round changes only the real App Shell, project context header, project tabs and view toolbar, issue list, and Kanban board. It preserves GridProject naming, fields, permissions, URL state, persistence, Timeline behavior, and all backend contracts.

Plane is used as an information-architecture and interaction-density reference. GridProject does not reuse Plane branding, logos, source code, or proprietary assets.

## Reviewed Sources

- GridProject baseline: `artifacts/ui-review/after/default-1440x900.png`
- GridProject project baseline: `artifacts/ui-review/after/project-overview-1440.png`
- GridProject board baseline: `artifacts/ui-review/after/board-1440.png`
- GridProject modal baseline: `artifacts/ui-review/after/project-create-open-1440.png`
- Plane project management: <https://plane.so/project-management>
- Plane work items: <https://plane.so/work-items>
- Plane open source workspace and Kanban: <https://plane.so/open-source>
- Plane project overview documentation: <https://docs.plane.so/core-concepts/projects/project-overview>

The comparison review uses official screenshots published by those pages. They are review references only and are not product assets.

## Area Mapping

| GridProject area | Current problem | Plane reference characteristic | R1 change |
|---|---|---|---|
| Sidebar | The 240px rail, 40px brand block, 36px navigation rows, and bordered user card make every section feel equally important. | A narrow workspace rail keeps brand/workspace context compact, stacks 30-32px navigation rows, and treats the current item as a quiet neutral selection. The account control is a footer row rather than a card. | Set expanded/collapsed widths to 220px/54px, brand height to 46px, and navigation rows to 32px. Use separate hover, selected, and focus states. Replace the manager card with a single account trigger row and place role/project count in its popover. Preserve collapsed tooltips. |
| Top Bar | `GridProject / Project Space` plus a large `Project Space` heading duplicates the page title, while the always-open 440px search field dominates the bar. | The top bar carries a concise breadcrumb/workspace context and compact global tools; the project content owns the main title. | Use a 46px shell bar. For project routes show only `Projects / {project}` context. Turn global search into a 32px trigger that expands into the existing searchable combobox on focus. Keep existing results and keyboard behavior. |
| Project Header | The project name competes with the app-level `Project Space` title. Six dates/people cells and four signals form a permanent property dashboard above every view. | Project identity is the visual anchor. Name, status, lead, and actions stay near the title; overview copy follows. Detailed properties are available in context or overview instead of a full-width strip. | Remove the app-level project title. Lead with a compact project mark, 20px name, status, owner avatar, edit, and overflow. Keep one-line description. Move owner/team/key dates/health/progress/open/risk into a keyboard-accessible project-properties popover; expose risk inline only when non-zero. |
| Tabs | Tabs sit inside a detached rounded container and are separated from both identity and the active view controls. | Project tabs form a continuous horizontal project context with a restrained underline or light selection. | Place tabs directly below the project header in a border-bottom context row, use equal 36px heights and an active underline, and allow horizontal scrolling on narrow screens. No outer card or thick outline. |
| Toolbar | Keyword, two dates, assignee, creator, more filters, and reset are always expanded like an admin query form. Sorting/density controls live inside the list panel instead of the view context. | View switch, search, filters, grouping/display controls, and create action occupy one compact line. Active constraints become removable chips. | Add a real `ViewToolbar` composition: compact view icon context, search trigger/input, Filter popover, Sort menu, and Display menu on the left; the single primary `New item` action on the right. Reuse existing URL-backed filter/sort/view-mode values. Show chips and clear only when filters are active. |
| Issue Row | Nine columns give equal visual weight to creator, hours, start date, due date, and status select. Every row has a card border, weakening scan rhythm. | Work item rows establish a left-to-right anchor: type, code, title, state, priority, assignee, date, overflow. Rows use dividers and restrained hover/selection rather than individual cards. | Render the required eight-part row at 42px: type icon, code, strongest title, compact state marker, priority icon/label, owner avatar, short due date, and hover/focus overflow. Remove inline status select from the persistent row. Keep row/detail click separation and expose status changes from the overflow menu. |
| Kanban Card | The permanent full-width status select makes every card look editable; title and metadata share similar weight. Empty columns contain oversized empty-state panels. | Cards prioritize code/type and title, then concise metadata. Status changes happen through drag, menu, or details. Column headers carry state/count/add actions, and empty columns remain compact. | Remove the persistent status select. Add a top metadata row with type/code and an overflow status menu, a two-line title, and a footer with priority, date, optional labels, and avatar. Use light borders/no default shadow. Add compact column headers, concise empty copy, visible drop-target styling, and board-only horizontal scrolling. |

## Visual Foundation

- Direction: dense operational workspace with neutral surfaces and sparing blue for action, focus, links, and explicit selection.
- Type hierarchy: 20px project name, 14px primary work text, 13px navigation and controls, 12px metadata.
- Stable dimensions: 46px shell bar, 32px compact controls, 42px issue rows, 30-32px navigation rows, and board columns constrained by viewport.
- Grouping: continuous surfaces, whitespace, and 1px dividers; shadows are reserved for menus, popovers, drawers, and modals.
- Interaction: hover, selected, focus-visible, pressed, open-popover, and drag-target states remain visually distinct.

## Non-goals

- No Dashboard body redesign.
- No project creation modal redesign.
- No changes to time entry, cost, people, settings, or Gantt content.
- No API, Prisma, database, Timeline import, permissions, export, or business-rule changes.
- No `/__visual-lab` or parallel demo components.
