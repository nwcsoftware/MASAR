# Masar — Driver & Trip Management Platform
## Product Requirements Document (PRD) v1.0

> **Masar** (مسار — "route / path") is a bilingual (English / Arabic) platform for companies that operate multiple construction sites and offices and need to dispatch, track and audit the work of their drivers: daily routines, airport transfers, document deliveries and staff escorts.
>
> This PRD is written to be consumed directly by **Claude Code in VS Code**. Every section is scoped so that it can be turned into an implementation task. Companion documents: `DATABASE.md`, `supabase/migrations/0001_init.sql`, `DESIGN.md`, `CLAUDE.md`.

---

## 0. Document map

| File | Purpose |
|---|---|
| `docs/PRD.md` (this file) | Product scope, personas, functional & non-functional requirements, user stories, flows, roadmap |
| `docs/DATABASE.md` | Human-readable schema walkthrough, ERD, RLS strategy, RPC contracts |
| `supabase/migrations/0001_init.sql` | Complete, runnable Postgres/Supabase migration |
| `docs/DESIGN.md` | Design system: tokens, layout, components, RTL rules, screens |
| `design/tokens.css` | CSS custom properties used by Tailwind and the components |
| `CLAUDE.md` | Working agreement for Claude Code (stack, conventions, commands, "definition of done") |

---

## 1. Vision & goals

### 1.1 Problem
A company with several construction sites and offices employs drivers who are shared, informally, across locations. Today trips are arranged by phone and WhatsApp. Consequences: two sites book the same driver at the same time; two sites send two cars to the same airport at the same hour; nobody knows where a driver is; flights get delayed and the driver waits without anyone being told; overtime and driving hours are reconstructed at month-end from memory.

### 1.2 Goals (what "done" means for v1)
1. **One calendar of truth** for every driver task across all sites, with automatic overlap and location-conflict warnings.
2. **Live awareness**: dispatchers see driver locations and ETA; drivers see what is coming and are reminded before each task.
3. **Closed-loop execution**: every task is acknowledged, started, (possibly delayed) and completed by the driver from a phone, producing reliable actual times.
4. **Cross-site cooperation**: when a site creates an airport trip, the system hints that another site already has a trip to the same airport on the same day so cars can be shared.
5. **Auditable hours**: driving hours, working hours, overtime and distance per driver per day/week/month, exportable.
6. **Bilingual & RTL-correct** English / Arabic UI from day one.

### 1.3 Non-goals (v1)
- Payroll calculation (we produce the hours; payroll happens elsewhere).
- Vehicle maintenance / fuel management (schema leaves room, UI later).
- Turn-by-turn navigation inside the app (we deep-link to Google Maps).
- Public/customer-facing booking.

### 1.4 Success metrics
- ≥ 95 % of tasks acknowledged by driver before scheduled start.
- 0 unnoticed double-bookings (every overlap produces a warning at creation).
- Actual start/complete captured for ≥ 90 % of tasks.
- Monthly hours report generated in < 1 minute with no manual reconstruction.

---

## 2. Personas & roles

| Role (DB `app_role`) | Persona | Primary device | What they do |
|---|---|---|---|
| `owner` | Company admin | Desktop | Creates company, sites, users; sees everything; billing/settings |
| `admin` | Operations manager | Desktop | Full CRUD across all sites, reports, driver HR data |
| `dispatcher` | Site coordinator / secretary | Desktop (Tauri) + web | Creates tasks for their site(s), assigns drivers, watches map, handles conflicts |
| `driver` | Driver | Phone (PWA) | Receives assignments, acknowledges, starts/completes tasks, reports delays, shares location |
| `viewer` | Site manager / finance | Web | Read-only dashboards and reports |

A user can be a member of one company (v1) and be scoped to one or more **sites** (dispatchers) or to all sites (owner/admin/viewer). Drivers belong to a **home site** but can be assigned tasks by any site (that is the whole point).

---

## 3. Platform & architecture

### 3.1 Stack (decided)
| Layer | Choice | Notes |
|---|---|---|
| UI | **React 18 + TypeScript + Vite** | Single codebase for desktop, web and driver PWA |
| Desktop shell | **Tauri 2** | Windows / macOS / Linux installers; system tray; native notifications; auto-update |
| Driver mobile | **PWA** (same build, `/driver` route group) | Installable on Android/iOS; Web Push (Android, iOS 16.4+); Geolocation API (foreground) |
| Styling | **Tailwind CSS v3 + shadcn/ui (Radix)** | Tokens in `design/tokens.css`; full RTL via `dir="rtl"` + logical properties |
| State / data | **TanStack Query + Supabase JS v2** | Realtime channels for tasks, locations, notifications |
| Routing | **TanStack Router** (file-based) | Route groups: `(admin)`, `(driver)`, `(auth)` |
| Forms | react-hook-form + zod | Schemas shared with Edge Functions |
| i18n | **i18next + react-i18next** | `en.json`, `ar.json`; ICU plurals; `Intl` for dates (Gregorian default, Hijri optional display) |
| Maps | **Google Maps Platform**: Maps JS, Places, Distance Matrix, Directions, Geocoding | Key restricted per platform |
| Backend | **Supabase**: Postgres 15, Auth, Realtime, Storage, Edge Functions (Deno), pg_cron, pg_net | RLS on every table |
| Push | Web Push (VAPID) via Edge Function `send-push`; optional Firebase later | Stored in `push_subscriptions` |
| AI | Anthropic Claude via Edge Function `ai-suggest-airports` and `ai-assist` | Airport suggestions, natural-language task creation (v1.1) |
| Testing | Vitest + Testing Library; Playwright (web); `pgTAP` for SQL policies | |
| CI | GitHub Actions: lint, typecheck, test, `supabase db lint`, Tauri build matrix | |

### 3.2 High-level diagram

```
┌──────────────────────────────┐        ┌───────────────────────────────┐
│  Tauri desktop / Web (React) │        │  Driver PWA (same React app)  │
│  dispatcher, admin, viewer   │        │  driver role, mobile layout   │
└──────────────┬───────────────┘        └──────────────┬────────────────┘
               │ supabase-js (REST, Realtime, Auth)     │ + Geolocation, Web Push
               ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ SUPABASE                                                             │
│  Postgres (RLS, triggers, conflict fn, views) ── Realtime ── Storage │
│  Edge Functions: send-push · notify-scheduler · eta-refresh ·        │
│                  ai-suggest-airports · flight-status (opt) · reports │
│  pg_cron: every 1 min → notify-scheduler ; every 5 min → eta-refresh │
└──────────────┬──────────────────────────────┬────────────────────────┘
               ▼                              ▼
     Google Maps Platform APIs        Anthropic API (Claude)
```

### 3.3 Multi-tenancy
Every business table carries `company_id`. RLS enforces `company_id = auth.company_id()` (a `SECURITY DEFINER` helper reading `profiles`). Site-scoped dispatchers are further filtered by `user_sites`. Drivers see only tasks assigned to them.

---

## 4. Domain model (summary)

```
Company ─┬─ Sites ──── SiteAirports ──── Airports
         ├─ Profiles (users) ── UserSites
         ├─ Drivers ── Vehicles ── DriverLocations
         ├─ Tasks ─┬─ TaskAssignments (driver, vehicle)
         │         ├─ TaskStops (ordered route legs)
         │         ├─ TaskEvents (audit: assigned, acked, started, delayed, completed…)
         │         ├─ TaskDelays (flight delayed +45 min …)
         │         ├─ FlightDetails (airport tasks only)
         │         └─ TaskConflicts (materialised warnings)
         ├─ Notifications ── PushSubscriptions
         ├─ DriverShifts / DriverDaySummary (hours, overtime, distance)
         └─ Settings (working hours, overtime rules, reminder offsets)
```

Full definitions are in `DATABASE.md` and `0001_init.sql`.

### 4.1 Task categories (`task_category`)
| Value | Label EN / AR | Specific fields |
|---|---|---|
| `daily_routine` | Daily routine / مهمة يومية | Recurrence rule (RRULE), fixed route of stops |
| `airport` | Airport trip / رحلة مطار | `flight_details`: airline, flight no., direction (arrival/departure), passenger names, terminal, scheduled flight time, buffer minutes |
| `document_delivery` | Document delivery / توصيل مستندات | Recipient, document reference, proof-of-delivery photo/signature |
| `escort` | Escorting staff / مرافقة موظف | Passenger(s), destination(s), expected wait time at destination |

### 4.2 Task lifecycle (`task_status`)

```
draft → scheduled → assigned → acknowledged → en_route → in_progress → completed
                       │            │             │            │
                       └── declined └─ delayed ◄──┴────────────┘
   any non-terminal ──────────────► cancelled
   scheduled/assigned past start with no start ► no_show (auto)
```

Rules:
- `assigned → acknowledged`: driver taps **Acknowledge** (must happen before `remind_before_min`).
- `acknowledged → en_route`: driver taps **Start** (leaving base). `actual_start_at` captured, GPS snapshot stored in `task_events`.
- `en_route → in_progress`: driver taps **Arrived / Picked up** (optional per category).
- `→ delayed`: driver taps **Delayed** and optionally enters minutes and reason (`flight_delayed`, `traffic`, `passenger_late`, `other`). The task keeps its previous status in `task_delays.previous_status` and returns to it automatically or by tapping **Resume**. For `airport` tasks a delay shifts `flight_details.estimated_time` and re-plans reminders.
- `→ completed`: driver taps **Complete**; `actual_end_at`, odometer (optional), notes, photos.
- If a driver has not acknowledged by `scheduled_start − remind_before_min`, dispatcher receives `driver_not_acknowledged` alert.
- If `scheduled_start + grace_min` passes with no `en_route`, dispatcher gets `task_not_started`; after `no_show_after_min` the task becomes `no_show`.

---

## 5. Functional requirements

Each requirement has an ID (`FR-xx`) so Claude Code can reference them in commits and tests.

### 5.1 Onboarding & company setup
- **FR-01** A **platform super admin** (outside every company) creates each **Company** (name, country, timezone, default language) and invites its **owner** by e-mail. Owners cannot create companies; they complete the profile and working-day rules in onboarding. Companies are fully isolated: users never see another company's sites, people or tasks, and the super admin sees only the companies list (owner, site and user counts), not their data. (0008)
- **FR-02** Owner/admin creates **Sites**: name (EN/AR), type (`construction_site`, `office`, `warehouse`, `other`), address, lat/lng (map picker + Places autocomplete), contact person, phone, working hours, notes, active flag.
- **FR-03** Site registration ends with **Airport setup**: the app calls `ai-suggest-airports` with the site coordinates → returns the closest airports (IATA, name EN/AR, city, lat/lng, distance km, typical drive minutes). Every airport found is kept on the site with an **Active** switch (the nearest starts active and default); the user switches on the ones the site uses. They are stored in `airports` (company-wide catalogue, upserted by IATA) and linked in `site_airports` with `is_active`, `is_default` (always an active airport) and `default_buffer_min`. Only active airports are offered when planning trips. A site's location comes from the device, a pasted Maps link or typed coordinates; airports can also be added manually.
- **FR-04** Users are invited by email with a role and site scope. Drivers get a `drivers` record (licence number & expiry, phone, home site, employee no., max daily driving hours, photo).
- **FR-05** Vehicles: plate, make/model, seats, site, active, current odometer.

### 5.2 Task creation & scheduling (dispatcher)
- **FR-10** Create task wizard: category → details → stops → schedule → driver → review. Stops are ordered; each has a place (Places autocomplete or saved site/airport), planned arrival and dwell minutes.
- **FR-11** On entering stops, call Distance Matrix / Directions to fill `estimated_distance_km` and `estimated_duration_min` (traffic-aware, departure time = scheduled start). Display and let user override.
- **FR-12** Recurring **daily routines**: RRULE (e.g. `FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH`), generated into concrete task rows 14 days ahead by pg_cron; editing "this only" vs "this and following".
- **FR-13** **Airport trips**: flight number, airline, direction, scheduled flight time, airport picked from the site's `site_airports` (others allowed), passengers, buffer. The system derives `scheduled_start` = flight time − (drive minutes + buffer) for arrivals/departures and shows it before saving.
- **FR-14** **Conflict detection** (server-side, `fn_check_task_conflicts`) runs on insert/update and returns warnings the UI must display before confirmation:
  - `driver_overlap` — same driver has another task whose `[scheduled_start − travel, scheduled_end + travel]` window overlaps.
  - `driver_multi_location_same_day` — same driver, same date, tasks whose first stops are > `settings.far_location_km` apart.
  - `vehicle_overlap` — same vehicle overlapping.
  - `driver_over_hours` — projected driving hours for that day exceed `drivers.max_daily_driving_min` or company max.
  - `outside_working_hours` — task window outside the driver's shift.
  - `driver_unavailable` — leave/off-day in `driver_availability`.
  Warnings are persisted in `task_conflicts` and shown as badges on the calendar; an `admin` may **override** with a reason.
- **FR-15** **Cross-site airport hint**: when an airport task is created, `fn_similar_airport_trips(company, airport, date)` returns other sites' airport tasks within ± `settings.airport_share_window_min` (default 90). UI shows "Site B already has a car going to KKIA at 14:00 — share this trip?" with one-click **Merge as shared trip** (creates `task_links` with `relation = 'shared_ride'` and copies passengers as additional stop).
- **FR-16** Assign driver: list sorted by availability, proximity (last location), remaining hours; shows conflicts inline. Assign vehicle optionally.
- **FR-17** Bulk actions: duplicate task, move to another day, reassign driver, cancel with reason.
- **FR-18** **Ticket import**: on an airport task the dispatcher uploads the passenger's ticket (PDF, scan or photo, any agency's layout). AI (`ai-parse-ticket`) reads its flights and passengers; the dispatcher picks the flight the trip is for (arrival or departure; airports not set up in Masar are still filled in and flagged), reviews what was read (unclear fields flagged "Check"), and the flight card, the other end of the flight (airport, date, local time, terminal), the booking reference and the passengers (staff matched by name, others as one-time visitors) are filled in. The file is not stored.

### 5.3 Notifications & reminders
- **FR-20** On assignment → push + in-app notification to driver (`task_assigned`) with **Acknowledge / Decline** actions.
- **FR-21** Reminders before start at configurable offsets (default 24 h, 2 h, 30 min; per-category override), computed by `notify-scheduler` (pg_cron every minute) using `scheduled_start` or the delayed estimate.
- **FR-22** "Did you start?" prompt at `scheduled_start + 5 min` if not started; "Did you finish?" prompt at `estimated_end + 10 min` if not completed. Driver answers with one tap.
- **FR-23** Dispatcher alerts: not acknowledged, not started, delayed, completed, no-show, driver offline > N min while task active, driver deviates > X km from route (v1.1).
- **FR-24** Notification centre (bell) with read state; per-user channel preferences (push / in-app / email).
- **FR-25** All notification text is localised by recipient language (`profiles.language`).

### 5.4 Driver module (PWA)
- **FR-30** Home: today's timeline (cards by task, colour by category), next task hero card with countdown, **Acknowledge / Start / Arrived / Delayed / Complete** primary button that changes with status.
- **FR-31** Task detail: stops with **Open in Google Maps** deep-link, passenger names/phones (tap to call), flight card with live status (if flight API configured), notes, attachments.
- **FR-32** Delay flow: tap **Delayed** → choose reason → optional minutes → for airport tasks the new estimated flight time; dispatcher notified; reminders re-planned.
- **FR-33** Location sharing: while the app is open and a task is `en_route/in_progress`, send position every 30 s (or 100 m) to `driver_locations` via RPC `rpc_report_location` (also records speed, heading, accuracy, battery). Foreground only (PWA limitation) — the UI keeps a "sharing location" sticky banner and uses the Wake Lock API.
- **FR-34** Offline tolerance: queue acknowledgements/status changes in IndexedDB and replay when online (idempotent via client-generated `task_events.id`).
- **FR-35** Week view, personal hours summary (today / this week: driving, working, overtime, km).
- **FR-36** Language toggle EN/AR, large touch targets, dark mode.

### 5.5 Live monitoring (dispatcher)
- **FR-40** Map view: all drivers of the company (filter by site/status), marker colour by status (idle, en route, in progress, delayed, offline), click → panel with current task, ETA to next stop, last seen.
- **FR-41** ETA: `eta-refresh` Edge Function recomputes Distance Matrix from last location to next stop for active tasks every 5 min (or on demand), stores in `task_assignments.eta_next_stop_at`.
- **FR-42** Calendar: day/week/month, rows per driver (resource view), drag-and-drop to reschedule (re-runs conflict check), conflict badges, colour legend by category, site filter.
- **FR-43** Upcoming panel ("hints"): next 24 h tasks needing attention: unassigned, unacknowledged, possible shares, drivers close to hour limit.

### 5.6 Hours, overtime, distance
- **FR-50** `driver_day_summary` (materialised nightly + on demand): per driver per date — first start, last end, driving minutes (sum of task actuals), working minutes (shift), overtime minutes (vs `settings.standard_day_min` and weekly max), km (sum of `actual_distance_km` or GPS-derived), number of tasks by category.
- **FR-51** Overtime rules configurable per company: standard day minutes, weekly cap, weekend days, holiday calendar, multiplier labels (informational).
- **FR-52** Reports page: per driver / per site / per category, date range, charts, export CSV & XLSX (Edge Function `reports-export`), Arabic-aware PDF (v1.1).

### 5.7 Administration
- **FR-60** Users & roles, site scopes, driver profiles, vehicles, airports catalogue, settings, audit log (`task_events` + `audit_log`).
- **FR-61** Company settings: reminder offsets, grace/no-show minutes, far-location km, airport share window, overtime rules, default language, map defaults.

### 5.8 Localisation
- **FR-70** All UI strings from i18n files; no hard-coded text. Arabic uses `dir="rtl"`, logical CSS properties, mirrored icons where semantic (arrows, back). Numbers in Western Arabic digits by default (setting for Eastern digits). Dates via `Intl.DateTimeFormat` in company timezone.
- **FR-71** Bilingual data fields: `name_en`/`name_ar` on sites, airports, categories; free text stays as typed.

---

## 6. User stories (prioritised)

Format: *As a ⟨role⟩ I want ⟨capability⟩ so that ⟨value⟩.* — Acceptance criteria in bullets. Priority P0 = must for v1.

| ID | P | Story | Acceptance criteria |
|---|---|---|---|
| US-01 | P0 | As an owner I want to register my company and sites so drivers and tasks are organised by location | Site form validates lat/lng; appears on map; AI airport suggestion runs after save |
| US-02 | P0 | As a dispatcher I want to create an airport pickup by entering a flight so start time is computed for me | Start = flight − (drive + buffer); editable; conflict check shown before save |
| US-03 | P0 | As a dispatcher I want to be warned when a driver is double-booked | Overlap warning appears within 1 s of choosing driver; saved in `task_conflicts`; override needs reason |
| US-04 | P0 | As a dispatcher I want a hint when another site goes to the same airport the same day | Hint lists site, time, driver; "share" links tasks |
| US-05 | P0 | As a driver I want to be notified when a job is assigned to me and acknowledge it | Push received < 10 s; Acknowledge updates status; dispatcher sees ✓ |
| US-06 | P0 | As a driver I want reminders before my trip | 24 h / 2 h / 30 min reminders localised |
| US-07 | P0 | As a driver I want to start and complete a task with one tap so my hours are correct | Buttons change with status; actual times stored; offline queue works |
| US-08 | P0 | As a driver I want to report a flight delay | Delay reason + minutes; dispatcher alerted; reminders re-planned |
| US-09 | P0 | As a dispatcher I want to see where drivers are and their ETA | Map updates ≤ 30 s while active; ETA shown |
| US-10 | P0 | As an admin I want monthly driving hours, overtime and km per driver | Report matches sum of task actuals; CSV export |
| US-11 | P0 | As any user I want the app in Arabic | Full RTL layout, no clipped text, dates localised |
| US-12 | P1 | As a dispatcher I want recurring daily routines | RRULE editor; instances generated 14 days ahead |
| US-13 | P1 | As a driver I want proof-of-delivery for documents | Photo/signature uploaded to Storage; linked to task |
| US-14 | P1 | As a dispatcher I want to drag tasks on a calendar | Drop re-runs conflict check |
| US-15 | P2 | As a dispatcher I want live flight status | Flight API integration toggled in settings |
| US-16 | P2 | As a dispatcher I want to type "send Ahmed to the bank at 10" and get a draft task | `ai-assist` returns structured draft for confirmation |

---

## 7. Key flows

### 7.1 Site + airport registration
1. Admin → Sites → **New site** → fills name/type/address; map picker sets lat/lng.
2. Save → modal "Airports near this site" → Edge Function `ai-suggest-airports({lat,lng,country})`.
   - Function first queries Google Places (type=airport, radius 300 km, rank by distance) → for each candidate asks Claude to normalise: IATA/ICAO, official EN/AR names, city, international/domestic; falls back to Claude-only if Places fails.
   - Returns ≤ 8 airports with distance & drive time (Distance Matrix).
3. Admin ticks airports, sets one as default and buffer minutes → `airports` upsert + `site_airports` insert.

### 7.2 Airport trip creation with sharing hint
1. Dispatcher (Site A) → New task → **Airport** → direction *Arrival*, flight `SV 1234`, flight time 14:00, airport KKIA (default), passengers.
2. App calls Distance Matrix (site → airport, departure = flight − buffer) → drive 45 min; buffer 30 → suggested start 12:45, end 15:30.
3. App calls `rpc_similar_airport_trips` → Site B has arrival at KKIA 14:20 with driver Khalid → banner offers **Share**.
4. Dispatcher picks driver → `rpc_check_task_conflicts` → none → Save → status `assigned` → push to driver.

### 7.3 Driver executes with delay
1. 12:15 reminder (30 min). 12:45 driver taps **Start** → `en_route`, location sharing begins.
2. 13:30 airline announces +40 min → driver taps **Delayed → Flight delayed → +40** → `task_delays` row; `flight_details.estimated_time = 14:40`; dispatcher alerted; "Did you finish?" prompt shifted.
3. 14:55 passenger in car → **Picked up** (`in_progress`). 15:50 **Complete** → actual end stored; `driver_day_summary` refreshed.

---

## 8. Non-functional requirements
- **NFR-01 Security**: RLS on all tables; service-role key only in Edge Functions; Google keys restricted by referrer/bundle; PII (licence, phone) readable by admin/owner/self only.
- **NFR-02 Performance**: calendar week view for 50 drivers < 1 s; map marker updates via Realtime channel `driver_locations:company_id=eq.X`; Distance Matrix calls cached 10 min per (origin, dest, 15-min departure bucket).
- **NFR-03 Offline**: driver actions queued; UI shows sync state.
- **NFR-04 Accessibility**: WCAG 2.1 AA; keyboard navigable calendar; 44 px touch targets in driver PWA.
- **NFR-05 Observability**: Sentry (front + Edge), Supabase logs; `audit_log` for admin actions.
- **NFR-06 Data retention**: `driver_locations` pruned to 90 days (pg_cron), aggregated km kept.
- **NFR-07 Cost control**: Maps calls only server-side or with restricted keys; Distance Matrix batched; AI calls only on explicit user action.

---

## 9. Roadmap

| Phase | Weeks | Deliverables |
|---|---|---|
| **0 — Foundation** | 1 | Repo, Tauri+Vite+React, Tailwind+tokens, shadcn, i18n EN/AR + RTL, Supabase project, migration `0001`, auth, layout shell, design template pages (empty states) |
| **1 — Setup** | 2 | Company, sites (map picker), AI airport suggestion, users/roles, drivers, vehicles |
| **2 — Tasks core** | 3–4 | Task wizard (4 categories), stops + Distance Matrix, conflict detection, calendar/resource view, cross-site airport hints |
| **3 — Driver PWA** | 5–6 | Driver home/timeline, ack/start/delay/complete, push notifications, location reporting, offline queue |
| **4 — Monitoring & hours** | 7 | Live map, ETA refresh, alerts, day summaries, reports, CSV export |
| **5 — Polish & release** | 8 | Recurrence, proof of delivery, Tauri installers + auto-update, PWA manifest/icons, QA in Arabic, docs |

---

## 10. Open questions (decide before Phase 2)
1. Flight status provider (AviationStack / FlightAware / none in v1)?
2. Will drivers use company phones (allows Tauri Android build with background GPS later) or personal phones (PWA only)?
3. Hijri calendar display needed on reports?
4. Approval step for overtime, or informational only?

---

## 11. Glossary
- **Task** — any unit of driver work (trip, delivery, escort, routine).
- **Stop** — an ordered location in a task; the first stop is the origin.
- **Acknowledge** — driver confirms he has seen the assignment.
- **Buffer** — minutes added before flight time for check-in / waiting.
- **Shared trip** — two tasks linked so one car serves both.
- **Day summary** — computed hours/km per driver per date.
