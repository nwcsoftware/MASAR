# CLAUDE.md — Masar (Driver & Trip Management)

Read `docs/PRD.md`, `docs/DATABASE.md`, `docs/DESIGN.md` before starting any task. Reference requirement IDs (`FR-xx`, `US-xx`) in commit messages.

## Stack (do not change without asking)
- React 18 + TypeScript (strict) + Vite · Tauri 2 (desktop) · same build served as web + driver PWA
- Tailwind v3 + shadcn/ui (Radix) · tokens in `design/tokens.css` · `lucide-react` icons
- TanStack Router (file-based) · TanStack Query · TanStack Table · react-hook-form + zod
- Supabase JS v2 (Auth, Postgres, Realtime, Storage) · Edge Functions in Deno
- i18next + react-i18next (`src/i18n/{en,ar}.json`) — Arabic is RTL
- Google Maps Platform (`@vis.gl/react-google-maps`), Distance Matrix/Directions via Edge Function `route-estimate`
- Vitest + Testing Library · Playwright · pgTAP for RLS

## Repo layout
```
apps/
  web/                     # React app (web + Tauri + PWA)
    src/
      routes/              # TanStack Router: (auth)/, (admin)/, (driver)/
      components/ui/       # shadcn primitives
      components/          # domain components (TaskCard, ResourceCalendar, LiveMap …)
      features/<domain>/   # hooks, queries, forms per domain (tasks, drivers, sites, airports, notifications, reports)
      lib/supabase.ts, lib/maps.ts, lib/i18n.ts, lib/offline-queue.ts
      i18n/en.json, i18n/ar.json
    src-tauri/             # Tauri 2 config, tray, notifications, updater
supabase/
  migrations/0001_init.sql
  functions/{ai-suggest-airports,route-estimate,eta-refresh,send-push,reports-export,recurrence-generate}/
  seed.sql
  tests/                   # pgTAP
design/tokens.css, design/preview.html
docs/PRD.md, docs/DATABASE.md, docs/DESIGN.md
```

## Commands
```bash
pnpm i
pnpm dev                 # web at http://localhost:5173
pnpm tauri dev           # desktop
pnpm test                # vitest
pnpm e2e                 # playwright (runs en + ar)
pnpm lint && pnpm typecheck
pnpm i18n:check          # en/ar parity + every t('…') key exists
# Supabase CLI is a workspace devDependency (needs Docker for local): use `pnpm supabase …`
pnpm db:start && pnpm db:reset          # local DB with migration + seed (logins in supabase/seed.sql)
pnpm supabase functions serve           # edge functions locally
pnpm db:types                           # regenerate apps/web/src/lib/database.types.ts
```

## Conventions
- **Never** update `tasks.status` directly — call `rpc_task_transition`. Never write `driver_locations` directly — call `rpc_report_location`.
- All data access through `features/<domain>/queries.ts` (TanStack Query keys: `['tasks', companyId, filters]`). Realtime invalidates queries.
- Regenerate `database.types.ts` after every migration; no `any` on Supabase rows.
- Every user-facing string goes through `t()`; add the key to **both** `en.json` and `ar.json` in the same commit (CI fails on missing keys).
- Only logical Tailwind utilities (`ms-`, `pe-`, `start-`, `text-start`). Directional icons get `rtl:-scale-x-100`.
- Colours only via tokens/Tailwind theme (no hex in components). For coloured *text* use `text-warning-fg` / `text-success-fg` / `text-delayed-fg` (contrast-safe), and the `.tone-*` classes with `tone(var)` for status/category colour. Tailwind `/opacity` modifiers don't work on `var()` colours — use `color-mix` or `tint-12`.
- Wrap English free text interpolated into translated sentences with `isolate()` (lib/format.ts) so it renders correctly inside Arabic.
- Forms: zod schema in `features/<domain>/schema.ts`; contracts shared with Edge Functions live in `supabase/functions/_shared/schemas.ts` (import as `@shared/schemas`). zod messages are i18n keys (the i18n check verifies them). Any custom component passed to `register()` must `forwardRef` (see `components/form.tsx`) — otherwise react-hook-form silently reads `undefined`.
- Driver actions must work offline: enqueue `{ taskId, action, payload, eventId }` in `lib/offline-queue.ts` (IndexedDB via `idb-keyval`), replay on `online`.
- Google Maps keys: browser key restricted by referrer for Maps JS/Places; server key only in Edge Functions.
- Secrets in `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_BROWSER_KEY`); Edge Function secrets via `supabase secrets set` (`ANTHROPIC_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `SITE_URL`, `VAPID_*`; template `supabase/functions/.env.example`).
- Commits: conventional (`feat(tasks): conflict alert in assign step (FR-14)`).

## Definition of done (per feature)
1. Types regenerated, zod schema, query hooks.
2. UI in both languages, checked in RTL and dark mode.
3. Unit tests for hooks/utils; Playwright happy path for P0 stories.
4. RLS verified (pgTAP or manual as driver + dispatcher of another site).
5. Empty, loading and error states present.
6. Docs updated if a contract changed (`DATABASE.md` for RPCs, `PRD.md` for scope).

## Phase 0 checklist (start here)
- [x] Scaffold: `pnpm create vite` → add Tauri 2, Tailwind, shadcn, TanStack, i18next, Supabase client
- [x] Import `design/tokens.css`; configure `tailwind.config.ts` per `docs/DESIGN.md` §3
- [x] `AppShell` with sidebar/topbar/slide-over; RTL + dark mode toggles working
- [x] Route groups `(auth)`, `(admin)`, `(driver)`; role-based redirect after login
- [x] All 12 screens from `DESIGN.md` §6 as shells with `EmptyState` and mock data
- [ ] Supabase project linked; `supabase db reset` applies `0001_init.sql`; seed loaded
      — `supabase/config.toml` + `supabase/seed.sql` done and verified on Postgres 17 (PGlite);
        `database.types.ts` generated from the migration. Still needs Docker (local) or a hosted project.
- [x] Auth flow (email/password + magic link), `profiles` loaded into a `useSession()` hook
- [x] PWA manifest + service worker (vite-plugin-pwa), installable driver route
- [x] CI: lint, typecheck, test, `supabase db lint` (`.github/workflows/ci.yml`; no remote yet)

## Data source (live vs demo)
- `useLiveData()` (lib/data-source.ts): signed in through Supabase → every `features/<domain>/queries.ts` hook reads/writes real tables (RLS applies); demo mode → the in-memory store in `src/mocks` (same row types, `Tables<'…'>`). Writes use `useDualMutation({ live, mock, invalidate })`.
- No `VITE_SUPABASE_*` in `.env.local` → the login screen offers a role picker (owner / dispatcher / driver / viewer) with the seed's personas.
- `?mock=empty` / `?mock=error` on any URL renders that screen's empty / error state (demo mode).
- `rpc_task_transition` is mirrored by `mockTransition` so driver actions work in demo mode — keep them in sync.
- Edge Functions: `ai-suggest-airports`, `invite-user` (`supabase/functions`, Deno; `deno check` in CI). Security tests: `supabase/tests/*.test.sql` (pgTAP, `pnpm db:test`).

## Phase 1 — Setup (done, FR-01…05, FR-60/61)
- [x] Migration `0002_phase1_setup.sql`: profile/driver column guards, company-scoped `user_sites`, `rpc_create_company`, `rpc_set_site_airports`, driver live-status fix — pgTAP suite
- [x] Owner sign-up → onboarding (company → site → airports → invites), all persisted
- [x] Sites CRUD + MapPicker (paste Maps link / coordinates / device location) + AirportPicker with AI suggestions
- [x] Drivers CRUD + leave; vehicles; users (invite, role + site scope, deactivate); company profile, rules, holidays
- [ ] Interactive Google map + Places search in MapPicker → with LiveMap in Phase 4 (needs `VITE_GOOGLE_MAPS_BROWSER_KEY`)
