# Masar — Driver & Trip Management

## Getting started

```bash
pnpm i
pnpm dev            # http://localhost:5173
```

**Without Supabase (demo mode).** With no `apps/web/.env.local`, the login screen offers four demo roles — owner, dispatcher, driver (phone app) and viewer — over the same sample day as `supabase/seed.sql`. Append `?mock=empty` or `?mock=error` to any URL to see that screen's empty/error state.

**With Supabase.**
- *Local* (needs Docker Desktop): `pnpm db:start && pnpm db:reset`, then copy the printed API URL and anon key into `apps/web/.env.local` (see `.env.example`). Sign in with any seed login, e.g. `dispatcher@masar.dev` / `Masar!2026`.
- *Hosted*: create a project → `pnpm supabase link --project-ref <ref>` → `pnpm supabase db push` → enable `pg_cron` + `pg_net` → set the URL/anon key in `.env.local` → `pnpm supabase gen types typescript --linked > apps/web/src/lib/database.types.ts`.

Checks: `pnpm lint && pnpm typecheck && pnpm i18n:check && pnpm test && pnpm e2e`. Desktop: `pnpm tauri dev`.

## Project seed

Drop this folder into an empty repo, open it in VS Code with Claude Code, and start with:

```
Read CLAUDE.md, docs/PRD.md, docs/DATABASE.md and docs/DESIGN.md.
Then execute the Phase 0 checklist in CLAUDE.md: scaffold the Tauri 2 + React + Vite app,
wire Tailwind to design/tokens.css, build the AppShell with EN/AR RTL and dark mode,
and create all 12 screens from DESIGN.md §6 as shells with mock data, matching design/preview.html.
```

| Path | What it is |
|---|---|
| `CLAUDE.md` | Working agreement for Claude Code: stack, layout, commands, conventions, definition of done, Phase 0 checklist |
| `docs/PRD.md` | Product requirements (FR-xx / US-xx ids), personas, flows, roadmap |
| `docs/DATABASE.md` | Schema walkthrough, ERD, state machine, RPC contracts, RLS matrix, Edge Function contracts |
| `supabase/migrations/0001_init.sql` | Complete migration — tested on Postgres 16 |
| `docs/DESIGN.md` | Design system, layout shells, component inventory, screen list, RTL checklist |
| `design/tokens.css` | CSS custom properties (light/dark) that Tailwind maps to |
| `design/preview.html` | Static, bilingual, themeable mock of the dashboard + driver app — the visual target for Phase 0 |

Supabase setup: create a project → `supabase link` → `supabase db push` → enable `pg_cron` and `pg_net` in Database → Extensions → run the three `cron.schedule` lines from section 15 of the migration → `supabase gen types typescript`.
