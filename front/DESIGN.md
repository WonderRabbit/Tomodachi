# Tomodachi Frontend Design System

## Product Direction

Tomodachi is an internal product, project, task, architecture, and agent-run operations tool. The first screen is the authenticated dashboard, not a marketing page. The UI should feel dense, precise, and operational: sidebar navigation, a compact top bar, drill-down summary cards, tables, boards, and a persistent detail panel.

## Visual Tokens

The MVP uses shadcn-compatible CSS variables and local component primitives. These can be replaced by generated `shadcn/ui` components without changing the screen contract.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0f1115` | App background |
| `--panel` | `#151821` | Shell panels and cards |
| `--panel-2` | `#1b1f2a` | Raised rows and selected states |
| `--border` | `#2a3040` | Hairline borders |
| `--text` | `#f3f6fb` | Primary text |
| `--muted` | `#9aa4b2` | Secondary text |
| `--accent` | `#62c8ff` | Primary action and focus |
| `--success` | `#57d68d` | Done/healthy states |
| `--warning` | `#f3c969` | Review/stale states |
| `--danger` | `#ff6b7a` | Blocked/error states |

## Layout

- `AppShell`: top bar, left sidebar, main route content, right detail rail.
- Dashboard first viewport: metric cards, workstream overview, review queue, architecture coverage.
- Desktop uses three columns. Tablet hides the right rail under the content. Mobile collapses sidebar and uses card lists instead of wide tables.
- Cards are interactive only when they route to a useful drill-down.

## Interaction Rules

- TanStack Router owns URL-restorable context such as selected page, detail routes, and search state.
- TanStack Query owns future backend server state. MVP mock queries must keep the same boundary.
- Zustand owns UI-local state only: sidebar collapse, detail rail, command/search open state.
- Frontend never calls OpenCode directly. Agent data displayed in the UI represents normalized backend-owned summaries.

## Component Rules

- Use compact cards with 8px or smaller radius.
- Buttons with actions use lucide icons when an icon exists.
- Tables must keep stable row height and avoid layout shift.
- Empty/error/forbidden/stale states are panel-scoped where possible instead of blanking the full page.
