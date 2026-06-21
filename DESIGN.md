# GridProject Design System

## Product Principles

GridProject is a calm enterprise workspace for repeated project operations. The interface prioritizes current state, responsibility, deadlines, risk, and the next action. It avoids marketing composition, decorative dashboards, and controls that do not change real data.

The project-level frontend design Skill used for this work is `.codex/skills/frontend-design/SKILL.md`, imported from `nexu-io/open-design/skills/frontend-design`. Its Apache-2.0 license is preserved at `.codex/skills/frontend-design/LICENSE.txt`. The Skill guided information hierarchy, component restraint, responsive behavior, and accessibility; GridProject business rules remain authoritative.

## Information Architecture

1. Global navigation: home, projects, time entries, costs, people when authorized, settings.
2. Top bar: current area and global project/issue search.
3. Page header: page title, short operational context, one primary action.
4. Project header: project identity first, status adjacent to the name, one-line overview, owner and actions. Detailed properties belong in the project-properties popover or overview; only real exceptions stay visible.
5. Project tabs: overview, board or phase plan, issue views, Gantt, milestones, and activity views supplied by the project template.
6. View toolbar: search, frequent filters, optional advanced filters, and the primary create action.

## Visual Theme

The direction is Calm Enterprise + Dense Operational Workspace. Surfaces are white or cool neutral, dividers carry most grouping, and shadows are reserved for overlays. Project screens use compact rows and property bands instead of nested cards.

## Color Palette

- Background: `#f7f8fa`
- Surface: `#ffffff`
- Subtle surface: `#f3f4f6`
- Text: `#17202a`
- Muted text: `#5f6b7a`
- Border: `#dfe3ea`
- Primary action: `#2563eb`
- Success: `#0f8f63`
- Warning: `#b86b00`
- Danger: `#c93535`

Status colors communicate state and are not used as decoration. Never rely on color alone; pair it with text.

## Typography

Use the system sans stack in `src/styles/tokens.css`. Page titles are 24px, section titles 16px, body text 14px, controls 13px, and captions 12px. Letter spacing is zero. Long project and task names truncate in tables and wrap where full context is required.

## Spacing

Use the 4/8/12/16/24/32px token rhythm. Dense table and toolbar controls may use 6px gaps. Do not introduce one-off viewport-scaled font or spacing values.

## Layout

- Application shell: fixed-width collapsible navigation plus `minmax(0, 1fr)` workspace.
- Content: full-width page bands with constrained internal alignment.
- Home: a restrained greeting and inline summary, up to six priority project cards, due items split into all/mine/others, and a risk section only when real exceptions exist.
- Project library: a card-only responsive grid with compact search, sort, filter, and create controls. There is no table/card mode toggle.
- Project workspace: an 80-96px desktop identity header, tabs, one compact view toolbar, then the active work surface. Mobile keeps project identity through tabs within roughly 140-160px.
- Tables, boards, and Gantt may scroll inside their own containers; the page root must not scroll horizontally.

## Components

- Buttons use the shared `Button`, `IconButton`, and `OverflowMenu` components.
- Only one primary button appears in a page or workspace toolbar.
- Low-frequency or destructive actions live in an overflow menu.
- Project status is a lozenge by default. Editing opens its menu or popover; a native select does not remain visible in the header.
- Execution teams use multi-select checkboxes and remain separate from project members and task execution ownership.
- Tabs, modals, panels, empty states, tables, and filters use existing shared components.

## Project Card Rules

Project library cards have stable equal heights and a deterministic abstract mark derived from project ID. The primary card action opens the project; the overflow menu is a separate sibling control and must not propagate. Cards show identity, two-line overview, state, phase, owner, team, progress, release date, and actual risk/overdue signals. The library uses 3-4 columns at wide desktop, 2-3 at medium desktop, 2 on tablet, and 1 on mobile.

Home reuses the compact `ProjectCard` variant and never embeds the project library toolbar. Risk/overdue projects sort first, followed by close release dates, current-user ownership, and recent updates.

## Table Rules

Desktop project tables prioritize name, status, owner, execution teams, progress, phase, release date, and risk. Headers stay visible inside the table. Low-priority columns may disappear at narrow widths; mobile uses an information list. Table rows expose an independent primary open action, while selects and menus remain separate controls.

Project tables are not used in the project library. This table rule remains for issue, time-entry, cost, and other operational data surfaces.

## Form Rules

Labels stay above controls. Required errors appear next to the field. Project forms preserve values after parsing and save failures. Dates remain separate fields. Project `dueDate` is not collected; issue `startDate` and `dueDate` remain separate. Save controls disable immediately while work is in progress.

## Modal Rules

Use `Modal`, `DetailPanel`, and `ConfirmDialog`. Overlays require a dialog role, accessible title, Escape close, focus management, focus return, body scroll lock where modal, fixed header/footer, and independently scrolling content. Dangerous replacement and deletion operations require confirmation.

The account menu uses a body-level anchored popover on desktop and a bottom sheet on mobile. Personal settings use `/settings/profile`, `/settings/preferences`, and `/settings/security`; the close action returns to the page from which settings were opened.

## Gantt Rules

The task identity column and timeline are separate. Timeline ticks and task lanes share the same exact day-column count and row-height token. The timeline alone scrolls horizontally. Today, overdue work, completed work, and single-day milestones use semantic styles. Mobile defaults to a schedule list.

## Responsive Rules

- 1440px and above: full operational layout with optional secondary column.
- 1024-1439px: single-column content where secondary modules would compress the workspace.
- Below 768px: overlay navigation, a single-row project toolbar with chips on demand, information lists instead of full tables, full-width detail panels, and modal personnel selection.
- Verify 390, 768, 1024, 1280, 1440, 1728, and 1920 widths and browser scaling from 80% through 200%.

## Accessibility

All controls need accessible names and visible focus. Tabs support Arrow keys, Home, and End. Dialogs trap focus where modal. Escape closes only the top overlay. Search supports keyboard navigation without automatically opening the first result. Controls must remain usable without a pointer.

## Do / Don't

Do use dividers, compact property popovers, explicit status text, and stable dimensions. Make the project name the header anchor and keep status next to it. Preserve user input and show data source information before writing imported data.

Don't use glass effects, decorative gradients, nested cards, page-wide horizontal scrolling, fixed popovers without coordinates, permanent project status forms, header signal dashboards, fabricated key dates, or hidden destructive behavior.

## Agent Implementation Guide

1. Read the business flow and existing components before editing visuals.
2. Keep localStorage and API modes behaviorally compatible.
3. Add fields through existing configuration or additive migrations only.
4. Preserve organization authorization and backend ownership rules.
5. Run unit, server, E2E, visual, and build checks after behavior changes.
6. Record screenshots and test evidence; never claim a check that did not execute.
