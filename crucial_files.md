# Crucial Files — DeisBikes

A map of the core files in the DeisBikes codebase (Brandeis University bike-share
system) after the cleanup/reorganization pass. DeisBikes is a monorepo:

- **Backend** — Python **FastAPI** under `api/`, served by `uvicorn api.index:app` on port 3001.
- **Frontend** — **React + Vite (TypeScript)** under `client/`, dev server on port 3000.
- Both run together via `npm run dev` from the repo root.

Deployment is on **Vercel**: `vercel.json` builds `client/` into `client/dist` and
rewrites `/api/*`, `/auth/*`, `/health` → `api/index.py` and `/ping` → `api/ping.py`.
Those two backend filenames are wired by path and must not be renamed.

---

## Backend (`api/`)

### Entry point & wiring

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [api/index.py](api/index.py) | FastAPI app factory. Injects the project root into `sys.path` (for `api.*` imports on Vercel), loads `.env`, configures CORS from `CLIENT_URL`, includes all six routers, and defines `/health`. Exposes the ASGI `app`. | Imports every router in `api/_routes/`; consumed by `uvicorn` and Vercel. |
| [api/ping.py](api/ping.py) | Standalone Vercel diagnostic (`BaseHTTPRequestHandler`, no app imports). Reports Python version, `sys.path`, external-package availability, internal-module import health, and which env keys are set. | Routed independently via `vercel.json` (`/ping`). No dependency on the FastAPI app. |

### Routes (`api/_routes/` — thin HTTP glue)

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [api/_routes/auth.py](api/_routes/auth.py) | Magic-link auth: request/verify link, `/auth/me`, `/auth/status`, waiver signing, logout, and dev-only `dev-approve`. Validates the email via `is_brandeis_email` (format **and** `@brandeis.edu`). In dev (`NODE_ENV=development` or `MOCK_EMAIL`) it **skips the real SMTP send and returns `{success, mocked:true, devLoginUrl}`** (the `devLoginUrl` lets a dev finish `/auth/verify` without an inbox) so login works without the mail catcher; production still sends real links and never exposes the link. Issues JWT auth cookies. | `utils.validators` (email check), `email_service` (send link), `_auth` (JWT), `get_store()` (users). |
| [api/_routes/bikes.py](api/_routes/bikes.py) | Bike listing / locations / single-bike status endpoints. | `registry` (safe bike list) in `api/config/bikes.py`. |
| [api/_routes/command.py](api/_routes/command.py) | Bike command dispatcher (`open`, `unlock_chain`, `unlock_wheel`, `lock`, `status`, `active_session`) + `chain_locked` webhook. Now delegates **all** session mutations to `ride_service`. | `ride_service` (lifecycle), `call_linka` (device `status` passthrough only), `_auth` (guard). |
| [api/_routes/rides.py](api/_routes/rides.py) | Ride read endpoints: active ride, history, single ride. | `ride_service` / `get_store()`. |
| [api/_routes/reports.py](api/_routes/reports.py) | PDF/report endpoints: ride receipt PDF, history PDF, summary. | `_pdf` (generators), `get_store()`. |
| [api/_routes/admin.py](api/_routes/admin.py) | Admin: users, pending approvals, Moodle approve/revoke, grant-admin, stats. | `_auth` (admin guard), `get_store()`. |

### Services (`api/services/` — business logic)

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [api/services/ride_service.py](api/services/ride_service.py) | **Owns the ride lifecycle**: `start_ride`, `unlock_chain`, `unlock_wheel`, `lock_ride`, active-status queries, and `handle_webhook_lock`. Shared helpers de-duplicate the logic: `_finalize_ride` (lock + write history + drop session, used by both lock paths), `_duration_minutes`, `_new_session_id`. Exposes the `ride_service` singleton. | `call_linka` (device), `registry` (per-bike command body), `get_store()` (persistence). Called by `command.py` and `rides.py`. |
| [api/services/email_service.py](api/services/email_service.py) | SMTP sender for magic-link emails; gates STARTTLS on `SMTP_STARTTLS` (prod-secure by default; `false` for the local mail catcher). | `smtplib`; called by `_routes/auth.py`. |

### Storage (`api/storage/` — persistence abstraction)

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [api/storage/__init__.py](api/storage/__init__.py) | `get_store()` singleton factory. Selects backend via `STORAGE_BACKEND` (defaults to `memory` on Vercel, else `json`). | Instantiates `MemoryStore` or `JsonFileStore`. Used everywhere state is read/written. |
| [api/storage/base.py](api/storage/base.py) | `Store` typing Protocol **and** `BaseStore` — the concrete in-memory implementation of every accessor (sessions, ride history, users). Mutations call a `_save()` hook (no-op by default). | Subclassed by both stores; the shared logic lives here once. |
| [api/storage/memory.py](api/storage/memory.py) | `MemoryStore(BaseStore)` — pure in-memory, resets on restart. Used for tests and no-persistence dev. | Inherits all behavior from `BaseStore`. |
| [api/storage/json_file.py](api/storage/json_file.py) | `JsonFileStore(BaseStore)` — persists to `data/store.json` via atomic `os.replace`. Overrides `_save()`/`_load()`; keeps the `{sessions, ride_history, users}` on-disk schema. | Inherits accessors from `BaseStore`. |

### Config & shared leaf helpers

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [api/config/bikes.py](api/config/bikes.py) | `BikeRegistry`: loads `bikes.json` (or `BIKES_CONFIG` env). `all()` returns credential-free bikes; `get()` returns the full record; `command_body(bike_id)` builds the per-bike LINKA payload. Exposes the `registry` singleton. | Imported by `bikes.py`, `command.py`, `ride_service.py`. |
| [api/_auth.py](api/_auth.py) | JWT create/decode plus FastAPI dependency guards: `get_current_user`, admin, and fully-approved variants. | Used as `Depends(...)` across the routes. |
| [api/_linka.py](api/_linka.py) | LINKA lock-hardware HTTP client: `call_linka()` (returns a simulated success when `LINKA_API_KEY` is unset — enables offline dev/tests) and `_linka_headers()`. | Called by `ride_service` and `command.py`. |
| [api/_pdf.py](api/_pdf.py) | ReportLab PDF generators for the ride receipt and ride-history report. Shared `_draw_title_block` / `_draw_generated_footer` helpers de-duplicate the header/footer. | Called by `_routes/reports.py`. |
| [api/utils/validators.py](api/utils/validators.py) | Shared, dependency-free email validators: `is_valid_email` (format) and `is_brandeis_email` (format + `@brandeis.edu` domain). Mirrored on the client in `client/src/utils/validators.ts`. | Used by `_routes/auth.py`. |

---

## Frontend (`client/src/`)

### Entry, routing & shared UI

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [client/src/main.tsx](client/src/main.tsx) | React entry. Mounts `<BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter>` and imports global CSS. | `App`, `AuthProvider`. |
| [client/src/App.tsx](client/src/App.tsx) | Route table. Public `/login`; everything else nested under `/` inside `<RideProvider><Layout/></RideProvider>` and gated by `ProtectedRoute`. | `ProtectedRoute`, `RideProvider`, `Layout`, all pages. |
| [client/src/components/ProtectedRoute.tsx](client/src/components/ProtectedRoute.tsx) | Route guard (extracted from `App.tsx`): waits for auth, then enforces waiver / Moodle-approval / admin gates, redirecting as needed. | `useAuth`, `Spinner`. |
| [client/src/components/Layout.tsx](client/src/components/Layout.tsx) | App shell: header/nav/footer + `<Outlet/>`. Nav items derived from `useAuth` (admin link gated). | `useAuth`. |
| [client/src/components/BikeMap.tsx](client/src/components/BikeMap.tsx) | Leaflet map with a colored marker per bike and start-ride popups. | Consumed by `MapPage`. |
| [client/src/components/ui/Spinner.tsx](client/src/components/ui/Spinner.tsx) | Shared loading spinner (brandeis-blue ring); accepts a `className` for spacing. | Used by `ProtectedRoute` and most pages. |
| [client/src/components/ui/ErrorBanner.tsx](client/src/components/ui/ErrorBanner.tsx) | Shared red error/alert box; accepts a `className` for variants (`mb-6`, `text-sm`). | Used across the pages. |
| [client/src/types.ts](client/src/types.ts) | All shared TypeScript interfaces (domain models, context shapes, API responses). | Imported throughout. |

### State (contexts & hooks)

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [client/src/context/AuthContext.tsx](client/src/context/AuthContext.tsx) | Auth provider + `useAuth`. Loads the user (`authService.getStatus`/`getMe`); exposes `logout`, `signWaiver`, `refreshUser`. Provided app-wide in `main.tsx`. | `authService`. |
| [client/src/context/RideContext.tsx](client/src/context/RideContext.tsx) | Ride provider + `useRide`. Wraps `useRideStatus` so pages share one polling source; polls only when the user is Moodle-approved. | `useRideStatus`; provided inside the `/` route. |
| [client/src/hooks/useRideStatus.ts](client/src/hooks/useRideStatus.ts) | Polls `/api/rides/active` every 10s while a ride is active; returns status state + `refresh`. | `rideService.getActive`. |

### Service layer (`client/src/services/` — typed API clients over `fetchAPI`)

| File | Responsibility | Key interactions |
|------|----------------|------------------|
| [client/src/services/http.ts](client/src/services/http.ts) | `fetchAPI` base utility: credentialed fetch, JSON, error unwrap. | Foundation for every other service. |
| [client/src/services/auth.ts](client/src/services/auth.ts) | Auth endpoints: status/me/waiver/dev-approve/logout/request-link. | `AuthContext`, `LoginPage`, `SafetyCoursePage`. |
| [client/src/services/bikes.ts](client/src/services/bikes.ts) | `bikeService.getAll` (bike list). | `MapPage`. |
| [client/src/services/commands.ts](client/src/services/commands.ts) | `commandService.open` / `lock` (the two commands the UI actually issues). | `RideModePage`. |
| [client/src/services/rides.ts](client/src/services/rides.ts) | `rideService.getActive` / `getHistory`. | `useRideStatus`, `HistoryPage`. |
| [client/src/services/reports.ts](client/src/services/reports.ts) | Report summary + PDF download helpers. | `HistoryPage`. |
| [client/src/services/admin.ts](client/src/services/admin.ts) | Admin endpoints: users/pending/approve/revoke/stats. | `AdminPage`. |
| [client/src/utils/validators.ts](client/src/utils/validators.ts) | Shared email validators (`isValidEmail`, `isBrandeisEmail`) mirroring `api/utils/validators.py`. | `LoginPage` (rejects bad addresses client-side before the round-trip). |

### Pages (`client/src/pages/`)

| File | Responsibility |
|------|----------------|
| [client/src/pages/LoginPage.tsx](client/src/pages/LoginPage.tsx) | Magic-link email login form; redirects if already authenticated. |
| [client/src/pages/WaiverPage.tsx](client/src/pages/WaiverPage.tsx) | Liability waiver text + agree checkbox → `signWaiver`. |
| [client/src/pages/SafetyCoursePage.tsx](client/src/pages/SafetyCoursePage.tsx) | Moodle safety-course instructions + dev-only skip button. |
| [client/src/pages/MapPage.tsx](client/src/pages/MapPage.tsx) | Bike map + bike list; navigates to ride mode. |
| [client/src/pages/RideModePage.tsx](client/src/pages/RideModePage.tsx) | Unlock/lock controls; local timer seeded from the server-authoritative duration in `RideContext`. |
| [client/src/pages/HistoryPage.tsx](client/src/pages/HistoryPage.tsx) | Ride history, summary stats, PDF downloads, CO₂/calorie flair. |
| [client/src/pages/AdminPage.tsx](client/src/pages/AdminPage.tsx) | Admin dashboard: stats, pending approvals, all-users table, approve/revoke. |

---

## Config & Tests

| File | Responsibility |
|------|----------------|
| [package.json](package.json) | Root scripts: `dev`, `dev:mail`, `api`, `client`, `build`, `test`, `test:diagnose`. |
| [pytest.ini](pytest.ini) | Pytest config: `testpaths = tests/unit` (so bare `pytest` never collects the live-server diagnostics) and `pythonpath = .` (so tests can `import api.*`/`tools.*`). |
| [client/vite.config.js](client/vite.config.js) | Vite + Vitest (jsdom) config; dev proxy for `/api` and `/auth` → port 3001. |
| [vercel.json](vercel.json) | Vercel build + rewrites (couples `api/index.py` / `api/ping.py` by path). |
| [bikes.example.json](bikes.example.json) | Template for `bikes.json` (gitignored; holds per-bike LINKA credentials). |
| `tests/unit/test_{email_validation,email_service,dev_login_removed,dev_approve,approve_user}.py` | Pytest suite (in-process `TestClient` + in-memory store). Run: bare `pytest`. |
| `tests/diagnostics/test_{api,api_diagnosis,auth_email}.py` | Standalone diagnostic scripts requiring a live server on :3001 (`python tests/diagnostics/<file>.py`). **Not** collected by pytest. |
| `client/src/test/*.{test.tsx,test.ts}` | Vitest component/routing/validator tests. Run: `cd client && npm test`. |

### Running the tests

```bash
# Backend (in-process, no server needed) — bare pytest now works,
# because pytest.ini scopes collection to tests/unit/.
pytest

# Backend diagnostics (need a live server on :3001)
python tests/diagnostics/test_api.py
python tests/diagnostics/test_auth_email.py
npm run test:diagnose            # = python tests/diagnostics/test_api_diagnosis.py

# Frontend
cd client && npm test
```
