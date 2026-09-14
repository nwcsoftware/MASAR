# Masar — Driver & Trip Management (project seed)

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
