# Masar — Design System & UI Template

This is the "nice design template" the project starts from. Phase 0 builds these shells with empty states **before** any business logic, so every later feature drops into a finished frame. Tokens live in `design/tokens.css`; a static preview of the dispatcher dashboard and driver PWA is in `design/preview.html`.

## 1. Design principles
1. **Calm operations console** — lots of white space, one accent colour (brand blue), colour reserved for *meaning* (category, status, conflict).
2. **Glanceable** — the dispatcher must see "what needs me now" in 3 seconds: conflicts, unacknowledged, delayed.
3. **Thumb-first for drivers** — one giant primary action button, 44 px targets, high contrast in sunlight, works one-handed.
4. **Mirror, don't translate** — Arabic is a first-class layout, not a flipped afterthought. Logical properties everywhere (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`).
5. **Dark mode parity** — every token has a dark value; no hard-coded colours in components.

## 2. Foundations

### 2.1 Colour
| Role | Token | Use |
|---|---|---|
| Primary | `--brand-500` (#2F5FF5) | buttons, links, active nav, focus ring (`--brand-400`) |
| Category: routine | `--cat-routine` teal | calendar blocks, badges, map pins |
| Category: airport | `--cat-airport` indigo | |
| Category: delivery | `--cat-delivery` amber | |
| Category: escort | `--cat-escort` pink | |
| Status | `--status-*` | status pills, timeline dots |
| Danger / conflict | `--danger` | blocking conflicts, no-show |
| Warning | `--warning` | non-blocking conflicts, delays |
| Surfaces | `--bg` / `--surface` / `--surface-2` | page / cards / inset panels |

Rules: category colour is applied as a **4 px start-border + 10 % tinted background** on cards and calendar blocks (never a full fill, which fights with status). Status is a **pill** with a dot. Conflicts add a **red/amber corner badge with count**.

### 2.2 Typography
Manrope for Latin (geometric, friendly, tabular numerals), IBM Plex Sans Arabic for Arabic (matching x-height). Scale: 12 / 14 / 16 / 18 / 22 / 28 / 36. Numbers in tables use `font-variant-numeric: tabular-nums`. Arabic body text gets `line-height: 1.7`.

### 2.3 Spacing & shape
4-pt grid; cards `--radius-lg` (14 px) with `--shadow-sm`; inputs and buttons `--radius-md` (10 px); pills `--radius-full`. Page gutter 24 px desktop, 16 px mobile.

### 2.4 Iconography
`lucide-react`. Directional icons (arrow-left/right, chevrons, "send") get `rtl:-scale-x-100`; symmetric icons (plane, car, bell, map-pin) do not flip.

### 2.5 Motion
`--dur-base` 200 ms `--ease` for hover/expand; panels slide from the **inline-end** side (right in LTR, left in RTL). Reduce-motion respected.

## 3. Tailwind mapping (`tailwind.config.ts`)
```ts
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'var(--brand-50)', 100:'var(--brand-100)', 200:'var(--brand-200)', 300:'var(--brand-300)',
                 400:'var(--brand-400)', 500:'var(--brand-500)', 600:'var(--brand-600)', 700:'var(--brand-700)',
                 800:'var(--brand-800)', 900:'var(--brand-900)', DEFAULT:'var(--brand-500)' },
        cat: { routine:'var(--cat-routine)', airport:'var(--cat-airport)', delivery:'var(--cat-delivery)', escort:'var(--cat-escort)' },
        status: { draft:'var(--status-draft)', scheduled:'var(--status-scheduled)', assigned:'var(--status-assigned)',
                  acknowledged:'var(--status-acknowledged)', 'en-route':'var(--status-en-route)', 'in-progress':'var(--status-in-progress)',
                  delayed:'var(--status-delayed)', completed:'var(--status-completed)', cancelled:'var(--status-cancelled)', 'no-show':'var(--status-no-show)' },
        bg:'var(--bg)', surface:{ DEFAULT:'var(--surface)', 2:'var(--surface-2)', 3:'var(--surface-3)' },
        border:{ DEFAULT:'var(--border)', strong:'var(--border-strong)' },
        fg:{ DEFAULT:'var(--text)', 2:'var(--text-2)', 3:'var(--text-3)' },
        success:'var(--success)', warning:'var(--warning)', danger:'var(--danger)', info:'var(--info)',
      },
      fontFamily: { sans:['var(--font-sans)'], arabic:['var(--font-arabic)'], mono:['var(--font-mono)'] },
      borderRadius: { sm:'var(--radius-sm)', md:'var(--radius-md)', lg:'var(--radius-lg)', xl:'var(--radius-xl)' },
      boxShadow: { xs:'var(--shadow-xs)', sm:'var(--shadow-sm)', md:'var(--shadow-md)', lg:'var(--shadow-lg)' },
    },
  },
  plugins: [animate],
} satisfies Config;
```
> **Implementation note (Phase 0).** `tailwindcss-rtl` is *not* installed. Tailwind 3.4
> emits every logical utility natively — `ms-`/`me-`/`ps-`/`pe-` (`margin|padding-inline-*`),
> `start-`/`end-` (`inset-inline-*`), `rounded-s`/`rounded-e`, `border-s`/`border-e`,
> `float-start`/`float-end`, `text-start`/`text-end` — plus the `rtl:`/`ltr:` variants.
> The plugin *overrode* those with weaker `:lang()` + `[dir]` duplicate rules keyed off
> `<html lang>` rather than `dir`, tripling the emitted CSS. The one gap is
> `transform-origin`, which has no logical utility in v3: use `ltr:origin-left rtl:origin-right`.
> The config is loaded as ESM (`import animate from 'tailwindcss-animate'`), so `require()`
> is not available in `tailwind.config.ts`.
Use `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start` — never `ml/mr/pl/pr/left/right/text-left`. ESLint rule: `tailwindcss/no-physical-properties` (custom) fails CI.

## 4. Layout shells

### 4.1 Dispatcher / admin (desktop & web ≥ 1024 px)
```
┌─────────────┬──────────────────────────────────────────────────────┐
│  Sidebar    │ Topbar: site switcher · search ⌘K · lang · 🔔 · avatar │
│  (256px,    ├──────────────────────────────────────────────────────┤
│  collapses  │  Page header (title, breadcrumb, primary action)      │
│  to 72px)   │  ─────────────────────────────────────────────────── │
│  Dashboard  │  Content (max 1440px)                                 │
│  Calendar   │                                                       │
│  Live Map   │                                    ┌─────────────────┐│
│  Tasks      │                                    │ Slide-over panel ││
│  Drivers    │                                    │ (task detail /   ││
│  Sites      │                                    │ driver detail)   ││
│  Reports    │                                    └─────────────────┘│
│  Settings   │                                                       │
└─────────────┴──────────────────────────────────────────────────────┘
```
In RTL the sidebar sits on the right and slide-overs open from the left. Tauri: window title-bar is custom (`decorations: false`) with drag region on the topbar; tray icon shows unread alerts count.

### 4.2 Driver PWA (≤ 640 px)
```
┌──────────────────────────────┐
│ Topbar: Masar · lang · 🔔     │
│ ┌──────────────────────────┐ │
│ │ NEXT TASK hero card       │ │  category tint, countdown "in 42 min",
│ │ Airport · SV1234 · RUH    │ │  stops, passenger, [Open in Maps]
│ │ ┌──────────────────────┐ │ │
│ │ │   ▶ START TRIP        │ │ │  one full-width primary action (56px)
│ │ └──────────────────────┘ │ │  secondary: "Delayed" ghost button
│ └──────────────────────────┘ │
│ TODAY  ── timeline ──────────│  vertical timeline, dots coloured by status
│ ● 07:00 Daily routine ✓      │
│ ● 12:45 Airport pickup ● now │
│ ○ 16:00 Escort to bank       │
│                              │
│ [Today] [Week] [Hours] [Me]  │  bottom tab bar, 44px targets
└──────────────────────────────┘
```
Sticky banner while sharing location: "Sharing location · 12:51" with pulse dot.

## 5. Component inventory (shadcn/ui base + custom)

| Component | Notes |
|---|---|
| `AppShell`, `Sidebar`, `Topbar`, `PageHeader` | layout; sidebar items with badges (conflict count) |
| `SiteSwitcher` | combobox; "All sites" for admins |
| `LanguageToggle` | EN/AR; sets `dir`, `lang`, i18n, persists in profile |
| `ThemeToggle` | light/dark/system |
| `NotificationBell` + `NotificationPanel` | Realtime; action buttons inline (Acknowledge/Decline) |
| `CategoryBadge`, `StatusPill`, `ConflictBadge`, `PriorityDot` | tokens above |
| `TaskCard` (compact / expanded) | start-border colour, time range, driver avatar, stops preview |
| `TaskWizard` (5 steps) | `CategoryStep` → `DetailsStep` (flight card for airport) → `StopsStep` (Places autocomplete + map) → `ScheduleStep` (estimate + recurrence) → `AssignStep` (driver list with availability & conflicts) → `ReviewStep` |
| `ConflictAlert` | list of conflicts with severity; "Override with reason" for admins |
| `ShareTripHint` | banner from `fn_similar_airport_trips` with "Share" button |
| `ResourceCalendar` | day/week/month, rows = drivers, drag-drop (FullCalendar resource-timeline or custom with `@dnd-kit`) |
| `LiveMap` | Google Maps JS, clustered driver markers, status colour, pulse on active |
| `DriverPanel` | current task, ETA, last seen, call button |
| `EtaChip` | "ETA 14:32 · 18 km" |
| `HoursBar` | stacked bar driving / working / overtime |
| `DataTable` | TanStack Table, sticky header, column visibility, CSV export |
| `EmptyState` | illustration + primary action, bilingual |
| `DriverHome`, `NextTaskHero`, `TaskTimeline`, `BigActionButton`, `DelaySheet`, `CompleteSheet` | driver PWA |
| `OfflineBanner`, `SyncIndicator` | offline queue status |
| `AirportPicker` | AI suggestions list with distance/drive time, checkbox, default star |
| `MapPicker` | click / drag pin / Places search → lat,lng |

## 6. Screens (Phase 0 delivers these as static shells with mock data)
1. **Login / Invite accept** — split layout, brand panel with map illustration, language toggle.
2. **Onboarding wizard** — Company → First site (MapPicker) → Airports (AirportPicker) → Invite users.
3. **Dashboard** — 4 KPI tiles (tasks today, unacknowledged, delayed, drivers active), "Needs attention" list, mini calendar, mini map.
4. **Calendar** — resource view by driver with site filter; conflict badges; slide-over on click.
5. **Live Map** — full-bleed map, driver list panel at inline-start.
6. **Tasks list** — table with filters (category, status, site, driver, date).
7. **Task detail (slide-over)** — header with status pill and actions; tabs: Details · Stops · Timeline (events) · Delays · Attachments · Conflicts.
8. **Drivers** — cards grid → driver detail (hours chart, upcoming, availability).
9. **Sites** — list + detail with airports.
10. **Reports** — filters, charts (driving/overtime/km by driver), export.
11. **Settings** — company, reminders, overtime rules, holidays, users.
12. **Driver PWA** — Home, Task detail, Delay sheet, Complete sheet (photo/signature), Week, Hours, Profile.

## 7. Bilingual & RTL checklist
- `<html lang="ar" dir="rtl">` toggled at runtime; fonts switch through `[dir="rtl"]` token.
- All text via `t('key')`; keys namespaced: `common`, `tasks`, `drivers`, `notifications`, `errors`.
- Dates: `Intl.DateTimeFormat(locale, { timeZone: company.timezone })`; relative times via `Intl.RelativeTimeFormat`.
- Numbers: Western digits default; `eastern_arabic_digits` setting switches to `ar-SA-u-nu-arab`.
- Plurals: i18next ICU (`{{count}} task(s)` handled per language).
- Mirrored: sidebar side, slide-over side, chevrons, progress direction, calendar time axis (time still reads left→right inside the grid — keep the grid LTR with `dir="ltr"` on the time axis, RTL for labels).
- Test: Playwright runs every screen in `ar` and snapshots for clipping.

## 8. Accessibility
Focus ring `2px var(--ring)` offset 2 px; contrast ≥ 4.5:1 for text; category colours never the only indicator (icon + label); calendar keyboard: arrows move, Enter opens, `Shift+arrows` reschedule; `aria-live="polite"` for notification toasts.

## 9. Assets
- Logo: wordmark "Masar" + Arabic "مسار" stacked; icon = abstract route line forming an "M".
- PWA icons 192/512 maskable; Tauri icons via `tauri icon`.
- Empty-state illustrations: simple line style in brand-300 / surface-3.
