# DeisBike — Architecture Guide

This document explains **why** the code is structured the way it is and gives a developer a mental map of the system before they touch any code.

---

## 1. System Overview

DeisBike is a Brandeis University bike share system. There is no login — anyone can open the app and rent a bike. One physical LINKA Leo2 Pro smart lock is attached to each bike. Rides are started and ended through this web application, which proxies commands to LINKA's cloud API; the lock then executes the command when a phone running the LINKA app comes within Bluetooth range.

**Key constraint:** The LINKA lock does not have its own internet connection. It relies on a phone (with the LINKA app) acting as a Bluetooth bridge. A command queued via the API will execute only when a phone is nearby.

---

## 2. Architecture Diagram

```
  Browser (React)
       │
       │  HTTP + cookies
       ▼
  Vite dev proxy (port 3000)           ← dev only
       │   or
  Vercel edge rewrites                 ← production
       │
       ▼
  FastAPI (api/index.py, port 3001)
       │
       ├── /api/bikes   → BikeRegistry
       ├── /api/command → RideService → LINKA cloud API
       └── /api/rides   → RideService, Store
                                          │
                              LINKA cloud API
                              (app.linkalock.com)
                                          │
                                  Physical lock
                                  (Bluetooth via phone)
```

---

## 3. Backend Module Map

| File | Responsibility | Key dependencies |
|------|---------------|-----------------|
| `api/index.py` | FastAPI app init, CORS, route registration | All `_routes/` modules |
| `api/_linka.py` | Raw LINKA API HTTP client (`call_linka`) | `httpx` |
| `api/ping.py` | Health check endpoint | — |
| `api/config/bikes.py` | `BikeRegistry`: loads `bikes.json`, exposes per-bike LINKA command body | — |
| `api/storage/base.py` | `Store` Protocol — the storage interface contract | `typing.Protocol` |
| `api/storage/memory.py` | `MemoryStore`: volatile in-memory store (for tests/local dev) | — |
| `api/storage/json_file.py` | `JsonFileStore`: persistent JSON-on-disk store (default) | — |
| `api/storage/__init__.py` | `get_store()`: factory; swaps backends via `STORAGE_BACKEND` env var | — |
| `api/services/ride_service.py` | `RideService`: ride lifecycle (start, lock, status, webhook) | `_linka`, `storage`, `config/bikes` |
| `api/_routes/bikes.py` | `/api/bikes` HTTP handlers | `config/bikes` |
| `api/_routes/command.py` | `/api/command` HTTP handlers (thin glue) | `services/ride_service` |
| `api/_routes/rides.py` | `/api/rides` HTTP handlers | `services/ride_service` |

---

## 4. Frontend Module Map

| File | Responsibility |
|------|---------------|
| `client/src/main.jsx` | React root, `BrowserRouter` |
| `client/src/App.jsx` | Route tree, `RideProvider` |
| `client/src/context/RideContext.jsx` | Global active-ride state (`useRide` hook) — wraps `useRideStatus` |
| `client/src/hooks/useRideStatus.js` | Polling hook: calls `/api/rides/active` on mount + every 10s while active |
| `client/src/services/http.js` | Base `fetchAPI` utility (credentials, error handling) |
| `client/src/services/bikes.js` | `bikeService` — bike listing API calls |
| `client/src/services/commands.js` | `commandService` — lock control API calls |
| `client/src/services/rides.js` | `rideService` — active-ride status API calls |
| `client/src/components/Layout.jsx` | Shared header/footer wrapper (`<Outlet />`) |
| `client/src/pages/MapPage.jsx` | Bike grid; navigates to `/ride` with selected bike |
| `client/src/pages/RideModePage.jsx` | Open/Lock controls; timer from `RideContext` |

---

## 5. Storage Layer

### Why it exists

The original `_state.py` used a module-level Python dict. Any server restart (including Vercel cold starts) wiped all active rides. The storage abstraction decouples data access from data location.

### How it works

`api/storage/__init__.py` exports `get_store()`, a lazy singleton factory:

```
STORAGE_BACKEND=json   → JsonFileStore  (default, persists to data/store.json)
STORAGE_BACKEND=memory → MemoryStore    (in-memory, useful for tests)
```

All routes and services call `get_store()` — never import `MemoryStore` or `JsonFileStore` directly.

### Vercel note

Vercel's filesystem is ephemeral — `data/store.json` will not persist across serverless function invocations in production. For Vercel deployments, set `STORAGE_BACKEND=memory` or migrate to an external persistent store (Vercel KV, Supabase, etc.).

---

## 6. BikeRegistry

### Why it exists

`bikes.py` previously had a single hardcoded Python list. Adding a second bike required editing source code and redeploying. `BikeRegistry` reads `bikes.json` at startup, enabling fleet management without code changes.

### Adding a new bike

1. Get the bike's MAC address from the LINKA app
2. Register it in LINKA FleetView — copy the `linka_token` (per-lock access token)
3. Add an entry to `bikes.json`:
   ```json
   {
     "id": "5001",
     "name": "My Bike Name",
     "location": "Campus Location",
     "lat": 42.3655, "lng": -71.2595,
     "available": true,
     "mac_addr": "AA:BB:CC:DD:EE:FF",
     "linka_token": "your-per-lock-token",
     "firmware_version": "2.6.15"
   }
   ```
4. Restart the server

`bikes.json` is gitignored (it contains credentials). Commit `bikes.example.json` as the template for new developers.

---

## 7. Ride Lifecycle

```
User clicks "Open"
  → POST /api/command { action: "open", bikeId }
  → RideService.start_ride()
      → call_linka("/command_unlock", per-bike body)   ← LINKA queues command
      → store.put_session(sid, {..., status: "ride_active"})
  → Returns { sessionId, startTime }

Client displays timer (seeded from server, ticks locally)
RideContext polls GET /api/rides/active every 10s
  → ride_service.get_active_ride_status()
  → Returns { active: true, sessionId, currentDuration }

User clicks "Lock Bike"
  → POST /api/command { action: "lock", sessionId }
  → RideService.lock_ride()
      → call_linka("/command_lock", per-bike body)
      → store.delete_session(sessionId)
  → Client navigates back to /map
```

---

## 8. LINKA Integration

All LINKA API calls go through `api/_linka.py → call_linka(endpoint, body)`.

- **Base URL:** `https://app.linkalock.com/api/merchant_api`
- **Auth headers:** `X-Auth-Token` and `X-User-Id` (Meteor.js session tokens from `.env` — **expire daily**)
- **Origin headers:** Must include `Origin: https://fleetview.linkalock.com` (CORS enforcement by LINKA)
- **Command body:** Per-bike, from `registry.command_body(bike_id)` — includes `access_token`, `mac_addr`, `schedule: true`

### Error codes

| Code | Meaning |
|------|---------|
| 200 success | Command queued — executes when phone is nearby |
| 620 | Another command in progress — wait 5–10s and retry |
| 504 | Expired session token — rotate credentials |

### Rotating credentials

When commands fail with 504 (or start returning 401):
1. Open `https://fleetview.linkalock.com` in your browser
2. Open DevTools → Network → find any POST request
3. Copy `x-auth-token` header value → update `LINKA_ACCESS_TOKEN` in `.env`
4. Copy `x-user-id` header value → update `LINKA_USER_ID` in `.env`
5. Restart the server

---

## 9. Local Development

```bash
# Prerequisites: Node.js 18+, Python 3.11+, pip

# Install dependencies
pip install -r requirements.txt
npm install

# Set up environment
cp .env.example .env          # fill in LINKA credentials
cp bikes.example.json bikes.json  # fill in bike credentials

# Run both servers concurrently
npm run dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:3001
```

Vite proxies `/api` requests to port 3001, so you only need to forward port 3000 in Codespaces.

---

## 10. Vercel Deployment

`vercel.json` configures:
- Build: `npm install --prefix client && npm run build --prefix client`
- Rewrites: `/api/*` → `/api/index` (FastAPI as serverless function)
- SPA fallback: `/*` → `/index.html`

Environment variables to set in Vercel dashboard:
- `LINKA_API_BASE_URL`, `LINKA_ACCESS_TOKEN`, `LINKA_USER_ID` — from FleetView
- `NODE_ENV=production`
- `STORAGE_BACKEND=memory` — until a persistent store is added (see Storage Layer section)

---

## 11. Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Vercel serverless — no background tasks | No periodic auto-lock; no scheduled jobs | Add external cron (Vercel Cron Jobs, GitHub Actions) |
| Phone required near lock for Bluetooth bridge | Commands queue but don't execute without phone | Always have the LINKA app open near the lock |
| LINKA session tokens expire daily | Commands fail with 504 | Rotate via FleetView DevTools (see section 8) |
| No webhook signature verification | Anyone can call `POST /api/command/webhook` | Add `WEBHOOK_SECRET` + HMAC verification |

---

## 12. Fleet Expansion Checklist

When adding a new physical bike to the fleet:

- [ ] Register bike in LINKA FleetView — note the lock's MAC address
- [ ] Assign a per-lock access token in FleetView
- [ ] Add entry to `bikes.json` (see section 6)
- [ ] Verify credentials by calling `GET /api/bikes` — new bike should appear
- [ ] Test unlock/lock cycle with the new bike ID
- [ ] Update `bikes.example.json` with a new placeholder entry (commit this)
