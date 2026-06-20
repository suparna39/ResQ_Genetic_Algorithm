# Gen-Z Emergency Ambulance Dispatch — Full System Context

> **Purpose**: This document gives a complete technical picture of what has been built, how it works, every design decision made, and every bug fixed. A new AI agent reading this should be able to continue development without re-discovering anything.

---

## 1. Project Overview

**What it is**: An AI-powered emergency ambulance dispatch platform built for a hackathon (Gen-Z team). Patients request ambulances, an AI/ML service + Genetic Algorithm assigns the nearest available one, and a driver accepts and tracks the trip in real time.

**GitHub**: `https://github.com/MIRACULOUS65/Gen-Z`  
**Branch**: `main` (last commit: `6ba3cea` — "Done backend and frontend with v1 done")

**Monorepo layout**:
```
Gen-Z/
├── backend/     — Node.js + Express + TypeScript + Supabase + Socket.IO
├── frontend/    — Next.js 16 (App Router, Turbopack) + TypeScript
├── ai-ml/       — Python ML service (not modified in this session)
└── docs/        — Original documentation
```

**Running locally**:
- Backend: `npm run dev` in `backend/` → runs on `http://localhost:5000`
- Frontend: `npm run dev` in `frontend/` → runs on `http://localhost:3000`

---

## 2. Tech Stack

### Backend (`backend/`)
| Layer | Technology |
|---|---|
| Runtime | Node.js + ts-node-dev (CJS mode) |
| Framework | Express.js |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Auth | Better Auth (`better-auth` package, email/password) |
| Real-time | Socket.IO server |
| HTTP client | Axios (calls AI-ML service) |

### Frontend (`frontend/`)
| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Vanilla CSS (custom design tokens in `globals.css`) |
| Maps | **MapLibre GL JS** (migrated FROM Leaflet — do NOT use Leaflet) |
| Map tiles | CartoDB Dark Matter (dark monochrome aesthetic) |
| Real-time | Socket.IO client |
| UI notifications | Sonner (toast library) |
| Icons | Lucide React |

### Design Philosophy
- **Black Monochrome Command UI** — dark background (#0A0A0A), off-white text (#EDEDED), minimal color
- Design tokens defined in `frontend/src/app/globals.css`
- Premium, hackathon-demo-worthy aesthetic

---

## 3. Database Schema (Supabase)

### Tables

#### `users`
Managed by Better Auth. Fields: `id`, `name`, `email`, `phone`, `role` (`patient | driver | admin`), `created_at`.

#### `ambulances`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `driver_id` | uuid \| null | Foreign key to users. May be null if ambulance is unlinked. |
| `vehicle_number` | text | e.g. "KA-01-AB-1234" |
| `status` | text | `available \| busy \| offline` |
| `latitude` | float | **Updated in real-time by socket relay** when driver shares location |
| `longitude` | float | **Updated in real-time by socket relay** |
| `last_updated` | timestamptz | |

> ⚠️ **Critical**: `latitude/longitude` on ambulances is now the driver's **live current position** (updated by the socket relay). It is NOT the vehicle's home/garage location anymore after the first driver location update.

#### `emergency_requests`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `patient_id` | uuid | FK to users |
| `emergency_type` | text | See `EmergencyType` union |
| `description` | text | |
| `priority` | text \| null | `low \| medium \| high \| critical` — set by AI |
| `status` | text | `RequestStatus` — mirrors assignment status |
| `latitude` | float | Patient's location |
| `longitude` | float | Patient's location |
| `created_at` | timestamptz | |

#### `assignments`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `request_id` | uuid | FK to emergency_requests |
| `ambulance_id` | uuid | FK to ambulances |
| `eta` | int | Minutes, estimated by GA |
| `status` | text | Mirrors `RequestStatus` |
| `assigned_at` | timestamptz | |
| `accepted_at` | timestamptz \| null | Set when driver accepts |
| `completed_at` | timestamptz \| null | Set when trip ends |

#### `tracking_logs`
History of GPS positions. Fields: `id`, `assignment_id`, `latitude`, `longitude`, `timestamp`.

---

## 4. Backend Architecture

### Entry Point: `src/index.ts`
Registers all routes and starts the HTTP + Socket.IO server:
```
/api/auth      → auth.routes.ts
/api/emergency → emergency.routes.ts
/api/ambulance → ambulance.routes.ts
/api/assignment → assignment.routes.ts
/api/tracking  → tracking.routes.ts
/api/admin     → admin.routes.ts
```

### Modules

#### `auth` — Better Auth integration
Handles sign-in, sign-up, session management. The `/api/auth/*` routes are handled by Better Auth's Express handler.

#### `emergency`
- `POST /emergency/create` — patient creates request → triggers `triggerAllocationService`
- `GET /emergency/:id` — get request by ID
- `GET /emergency/my` — patient's own requests
- `GET /emergency/:id/assignment` — **get assignment (with ambulance join) for a given request ID** — used by patient track page

#### `ambulance`
- `GET /ambulance/mine` — driver gets their own ambulance (by `driver_id = user.id`)
- `POST /ambulance/location` — **NOT used by the driver dashboard** (returns 404 if driver has no ambulance linked). Location is sent via socket only.
- `PATCH /ambulance/status/:id` — admin only

#### `assignment` ← Most important module
Routes:
- `GET /assignment/mine` — driver's active assignments
- `PATCH /assignment/:id/accept` → `acceptAssignment` controller
- `PATCH /assignment/:id/pickup` → `pickupAssignment` controller
- `PATCH /assignment/:id/complete` → `completeAssignment` controller

**Key services in `assignment.service.ts`**:

1. **`triggerAllocationService(request)`**: Full AI allocation pipeline:
   - Calls Python AI-ML service at `env.AI_ML_SERVICE_URL/predict` (5s timeout, falls back to rule-based)
   - Runs inline Genetic Algorithm (`findBestAmbulanceGA`) to pick nearest ambulance
   - Creates assignment record
   - Emits `assignment:new` to `driver:${driver_id}`, `drivers` (all drivers), and `admin` rooms
   - Emits `request:status_change { status: 'assigned' }` to `patient:${patient_id}` room

2. **`acceptAssignmentService(id)`**: Updates DB, then directly emits `request:status_change { status: 'accepted' }` to `patient:${patient_id}` room

3. **`enRouteAssignmentService(id)`**: Auto-advance from `accepted → en_route`. Called via `setTimeout(10_000)` inside `acceptAssignment` controller. Uses **top-level static imports** (not dynamic imports — those crash ts-node-dev CJS). Emits to both `assignment:${id}` AND `patient:${patient_id}` rooms.

4. **`pickupAssignmentService(id)`**: Updates DB, emits `picked_up` to both rooms.

5. **`completeAssignmentService(id)`**: Updates DB, marks ambulance as `available` again.

**`acceptAssignment` controller** (`assignment.controller.ts`):
```typescript
// After acceptAssignmentService runs:
io.to(`assignment:${id}`).emit('request:status_change', { status: 'accepted', assignment_id: id });

// 10 seconds later, auto-advance to en_route:
setTimeout(() => {
  enRouteAssignmentService(id).catch(console.error);
}, 10_000);
```

**`completeAssignment` controller**: Emits `completed` to BOTH `assignment:${id}` AND `patient:${patient_id}` rooms (belt-and-suspenders in case patient dropped from assignment room).

### Socket Architecture: `src/sockets/socket.ts`

**Rooms**:
| Room name | Who joins | Events received |
|---|---|---|
| `patient:${user_id}` | Patient (on every page load) | `request:status_change`, `driver:location_update` |
| `driver:${user_id}` | Driver dashboard | `assignment:new` |
| `drivers` | All drivers | `assignment:new` (broadcast fallback) |
| `assignment:${assignment_id}` | Both patient + driver after assignment | `request:status_change`, `driver:location_update` |
| `admin` | Admin pages | All events |

**Events the server listens for (from clients)**:
- `join:patient` → joins `patient:${id}` room
- `join:driver` → joins `driver:${id}` + `drivers` rooms
- `join:assignment` → joins `assignment:${id}` room
- `join:admin` → joins `admin` room
- `driver:location_update` → **async handler**:
  1. Immediately relays to `assignment:${assignment_id}` and `admin`
  2. Then (non-blocking) looks up `ambulance_id` from the assignment and updates `ambulances.latitude/longitude` in DB — so late-joining patients see the real location in `loadData`

**Critical lesson**: Never use `await import(...)` (dynamic imports) inside socket handlers or `setTimeout` callbacks in ts-node-dev CJS. **Always use static top-level imports.** Dynamic imports crash the process silently or throw at runtime in this environment.

---

## 5. Frontend Architecture

### Pages (`src/app/`)

#### `/` — Landing page
Public marketing page. Shows what the platform does.

#### `/login` and `/register`
Auth pages using Better Auth client.

#### `/patient/` — Patient section
- **`/patient/dashboard`**: Patient creates emergency request, sees their active request status.
- **`/patient/track/[id]`** ← Most complex page. Real-time ambulance tracking.

#### `/driver/dashboard` ← Second most complex page
Driver sees assigned requests, accepts them, marks pickup and completion, sets their location.

#### `/admin/` — Admin section
Metrics, request management, overview.

### Critical Page: Patient Track (`src/app/patient/track/[id]/page.tsx`)

**Hook order (MUST be maintained — React Rules of Hooks)**:
All hooks are declared BEFORE any early returns. The order is:
1. `useParams`, `useRouter`
2. `useAuth` (multiple hooks inside)
3. `useSocket` (multiple hooks inside)
4. Multiple `useState` calls
5. `useRef` calls (`hasLivePosRef`, `pollRef`)
6. `useEffect` (auth guard)
7. `useCallback` (loadData)
8. `useEffect` (loadData trigger)
9. `useEffect` (join patient room)
10. `useEffect` (join assignment room, triggered by `assignmentRoomId` state)
11. `useEffect` (driver location listener)
12. `useEffect` (status change listener)
13. `useEffect` (10s poll fallback)
14. `useMemo` (mapMarkers)
15. `useMemo` (mapCenter)
16. **Early returns ONLY HERE** (loading spinner, not found)
17. JSX return

**State management**:
```typescript
const [request, setRequest]           — EmergencyRequest
const [assignment, setAssignment]     — AssignmentData (with ambulances join)
const [ambulancePos, setAmbulancePos] — { lat, lng } | null — ONLY set by socket
const [isLoading, setIsLoading]
const [assignmentRoomId, setAssignmentRoomId] — drives room joining effect

const hasLivePosRef = useRef(false)   — once true, loadData never overwrites ambulancePos
const pollRef = useRef(...)           — interval ID for 10s poll
```

**`ambulancePos` lifecycle**:
1. `null` on load
2. `loadData` → fetches `asn.ambulances.latitude/longitude` → seeds `ambulancePos` IF `!hasLivePosRef.current` AND coords exist (the socket relay now updates this to real driver location)
3. `driver:location_update` socket event → sets `hasLivePosRef.current = true`, updates `ambulancePos`
4. Subsequent `loadData` polls never overwrite (hasLivePosRef is locked)

**Assignment room joining pattern** (avoids hook size error):
```typescript
// Set state from socket event or loadData
if (data.assignment_id) setAssignmentRoomId(data.assignment_id);

// Dedicated effect — always exactly [assignmentRoomId, joinRoom] deps
useEffect(() => {
  if (assignmentRoomId) joinRoom('join:assignment', assignmentRoomId);
}, [assignmentRoomId, joinRoom]);
```
Do NOT call `joinRoom` directly inside a socket listener callback.

### Critical Page: Driver Dashboard (`src/app/driver/dashboard/page.tsx`)

**Hook order**: Same rule — ALL hooks (including `useMemo`) must be ABOVE early returns.

**State**:
```typescript
const [activeAssignment, setActiveAssignment] — Assignment | null
const [driverPos, setDriverPos]               — { lat, lng } | null
const [manualLat, manualLng]                  — string inputs
const [showManualInput, setShowManualInput]
const [isAccepting, isPickingUp, isCompleting] — loading states
// ... other UI states

const locationWatchRef = useRef<number | null>(null) — GPS watcher ID
const manualOverrideRef = useRef(false) — when true, GPS watcher is disabled
```

**Driver location flow**:
1. On assignment: `navigator.geolocation.watchPosition` starts
2. GPS callback: checks `manualOverrideRef.current` — if true, skips
3. `handleManualLocation`: sets `manualOverrideRef.current = true`, clears GPS watcher, calls `setDriverPos`, emits `driver:location_update` via socket ONLY (no REST)
4. Why no REST? `POST /ambulance/location` returns 404 if driver has no ambulance row linked by `driver_id` in DB. Socket is sufficient.

**Socket listeners**:
- `assignment:new` → sets `activeAssignment`
- `request:status_change` → updates `activeAssignment.status` if `assignment_id` matches

**Sequential trip flow (driver)**:
```
[Accept] → status: accepted
[Patient Picked Up] → status: picked_up (shown after en_route)
[Mark Trip Completed] → status: completed
```

### Component: `LiveMap` (`src/components/maps/LiveMap.tsx`)

**MapLibre GL JS** — NOT Leaflet, NOT React-Leaflet. MapLibre was chosen because it works with dark tile providers.

**Tile provider**: CartoDB Dark Matter
```
https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png
```

**Marker system — KEYED BY TYPE ONLY**:
```typescript
const markerKey = (m: Marker) => m.type; // 'patient' | 'ambulance' | 'hospital'
```
This means position updates on an existing marker call `setLngLat()` (smooth movement, no DOM teardown). Only new marker TYPES cause DOM creation.

**Markers effect** — smart diff:
```typescript
// For each incoming marker:
if (markerMapRef.current.has(key)) {
  markerMapRef.current.get(key).setLngLat([lng, lat]); // smooth reposition
} else {
  // Create new MapLibre Marker, add to markerMapRef
}
// Remove stale keys
```

**No auto-re-center**: The `easeTo` re-center effect was intentionally removed. It was snapping the user's zoom back to 14 on every location update. The map is centered at creation time only.

**One-time fitBounds**: When BOTH patient + ambulance markers first appear together:
```typescript
if (!hasFittedBothRef.current && incomingKeys.size >= 2) {
  hasFittedBothRef.current = true;
  map.fitBounds([...], { padding: 100, duration: 700, maxZoom: 15 });
}
```
After this fires once, user has full zoom/pan control.

**Props**:
```typescript
interface LiveMapProps {
  center: [number, number]; // [lat, lng] — only used at creation
  zoom?: number;            // only used at creation
  markers?: Marker[];       // reactive — smart diff applied
  route?: Route;            // optional route polyline
  height?: string;
}
```

### Component: `StatusStepper` (`src/components/dashboard/StatusStepper.tsx`)

Renders the 6-step status timeline for the patient track page.

**Status order**:
```
pending(0) → assigned(1) → accepted(2) → en_route(3) → picked_up(4) → completed(5)
```

**FIXED bug**: Was using `isDone = currentOrder > stepOrder` (strict `>`), making the current step always look hollow/incomplete (always 1 step behind visually). Fixed to `>=`:
```typescript
const isDone   = currentOrder >= stepOrder; // current step IS filled
const isActive = currentOrder === stepOrder; // + outer ring highlight
```
Current step: filled circle + `box-shadow: 0 0 0 3px var(--bg-base), 0 0 0 5px var(--text-primary)` ring.

### Hook: `useSocket` (`src/hooks/useSocket.ts`)

Singleton socket pattern — one `Socket` instance shared across the app:
```typescript
let socket: Socket | null = null; // module-level singleton

export function useSocket() {
  // returns: { isConnected, joinRoom, on, emit }
}
```

`on(event, cb)` returns an unsubscribe function — always call it in `useEffect` cleanup.

### Hook: `useAuth` (`src/hooks/useAuth.ts`)

Returns `{ user, isLoading, logout }`. Uses Better Auth client under the hood.

---

## 6. Real-Time Event Flow (Full Lifecycle)

```
PATIENT creates request
  → POST /emergency/create
  → triggerAllocationService():
      1. AI predicts priority
      2. GA picks best ambulance
      3. Creates assignment in DB
      4. emit('assignment:new') → driver:${id}, drivers, admin rooms
      5. emit('request:status_change', { status: 'assigned' }) → patient:${id}

PATIENT track page opens
  → joinRoom('join:patient', user.id)
  → loadData() → fetches request + assignment → sets assignmentRoomId
  → joinRoom('join:assignment', assignmentRoomId)

DRIVER sees assignment (via socket or /assignment/mine poll)
  → PATCH /assignment/:id/accept
  → acceptAssignmentService():
      - DB: assignment.status = 'accepted', emergency_request.status = 'accepted'
      - emit('request:status_change', { status: 'accepted' }) → patient:${id} (direct!)
      - emit('request:status_change') → assignment:${id}
  → setTimeout(10_000):
      - enRouteAssignmentService():
          - DB: assignment.status = 'en_route', emergency_request.status = 'en_route'
          - emit → assignment:${id} + patient:${id}

DRIVER sets location (manual or GPS)
  → emit('driver:location_update', { assignment_id, latitude, longitude })
  → socket relay:
      - emit('driver:location_update') → assignment:${id} (patient receives)
      - Async DB update: ambulances.latitude/longitude → current driver position

PATIENT receives driver:location_update
  → hasLivePosRef.current = true
  → setAmbulancePos({ lat, lng }) → map marker appears/moves

DRIVER clicks "Patient Picked Up"
  → PATCH /assignment/:id/pickup
  → pickupAssignmentService():
      - DB update
      - emit('picked_up') → assignment:${id} + patient:${id}

DRIVER clicks "Mark Trip Completed"
  → PATCH /assignment/:id/complete
  → completeAssignment controller:
      - completeAssignmentService() → DB, marks ambulance 'available'
      - emit('completed') → assignment:${id}
      - emit('completed') → patient:${id} (fetches patient_id from DB)
```

---

## 7. Known Working State (as of last commit)

- ✅ Patient registration, login, emergency request creation
- ✅ Driver registration, login, sees assigned requests
- ✅ Admin dashboard with metrics
- ✅ Real-time: `assigned` status reaches patient immediately
- ✅ Real-time: `accepted` status reaches patient immediately (direct patient room emit)
- ✅ Auto `en_route` after 10s (server-side setTimeout, static imports, no crash)
- ✅ Driver GPS watcher disabled when manual location is set (`manualOverrideRef`)
- ✅ Driver location appears on patient map (socket relay + DB persistence)
- ✅ Ambulance map marker uses `setLngLat()` for smooth movement (no flicker)
- ✅ No zoom snap-back on location updates (easeTo effect removed)
- ✅ One-time fitBounds to show both markers on first appearance
- ✅ Status stepper correctly fills current step (fixed `>=` bug)
- ✅ `completed` reaches patient (emit to both rooms in controller)
- ✅ No React hook size errors (all hooks above early returns, stable dep arrays)

---

## 8. Known Gaps / Next Steps (NOT yet built)

- ❌ **Shortest route display on map** — the user explicitly said "don't show route now, it will be made by a friend's model later". The `LiveMap` has a `route` prop ready for it (`Route { coordinates: [number, number][] }` in `[lng, lat]` format).
- ❌ **Ambulance ↔ Driver DB linking** — `ambulances.driver_id` is often `null`. The REST location update endpoint fails (404) because of this. The workaround is socket-only location updates. Properly linking ambulances to drivers in admin UI would fix the REST route too.
- ❌ **Real AI/ML route optimization** — currently using inline Haversine + GA fallback. The Python service at `env.AI_ML_SERVICE_URL` is the intended destination.

---

## 9. Critical Rules for the Next Developer

1. **No dynamic imports** in `setTimeout`, socket handlers, or anywhere in ts-node-dev CJS:
   ```typescript
   // ❌ BREAKS in ts-node-dev CJS
   setTimeout(async () => { const x = await import('./module'); });
   
   // ✅ Always use static top-level imports
   import { myService } from './module';
   setTimeout(() => { myService(id); });
   ```

2. **All React hooks before any early return**. No `useState`, `useEffect`, `useMemo`, `useCallback` AFTER an `if (...) return (...)` block.

3. **Never call `joinRoom` inside a socket listener callback** — use the `setAssignmentRoomId` state + dedicated `useEffect` pattern.

4. **`ambulancePos` on patient page is exclusively set by socket** (after `hasLivePosRef` check). Do not add loading logic that resets it from DB without checking `hasLivePosRef.current`.

5. **MapLibre only** — do not add Leaflet or React-Leaflet dependencies. The map uses `dynamic(() => import('@/components/maps/LiveMap'), { ssr: false })`.

6. **`markerKey` is type-only** (`patient`, `ambulance`, `hospital`) — changing it to include coordinates will re-introduce the flickering/destroy-recreate bug.

7. **Status emit pattern**: Every status change must emit to BOTH `assignment:${id}` room AND `patient:${patient_id}` room directly. The patient is not reliably in the assignment room at all times.

---

## 10. Environment Variables

### Backend (`.env`)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
AI_ML_SERVICE_URL=http://localhost:8000
PORT=5000
NODE_ENV=development
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## 11. File Map — Most Important Files

```
backend/src/
├── index.ts                              — Express app, route registration, server start
├── sockets/socket.ts                     — Socket.IO server, all room logic, location persistence
├── modules/
│   ├── assignment/
│   │   ├── assignment.service.ts         — All business logic: allocation, accept, en_route, pickup, complete
│   │   ├── assignment.controller.ts      — HTTP handlers + setTimeout for en_route
│   │   └── assignment.routes.ts          — Route definitions
│   ├── emergency/
│   │   └── emergency.service.ts          — updateEmergencyStatusService used everywhere
│   └── ambulance/
│       └── ambulance.service.ts          — updateAmbulanceLocationService, getAmbulanceByDriverId
└── config/
    ├── supabase.ts                       — supabaseAdmin client (use for server-side)
    └── env.ts                            — Validated env vars

frontend/src/
├── app/
│   ├── globals.css                       — Design tokens, all CSS variables, animations
│   ├── patient/track/[id]/page.tsx       — Patient real-time tracking (most complex)
│   └── driver/dashboard/page.tsx         — Driver trip management
├── components/
│   ├── maps/LiveMap.tsx                  — MapLibre GL JS wrapper (smart marker diff)
│   └── dashboard/StatusStepper.tsx       — 6-step status timeline
├── hooks/
│   ├── useSocket.ts                      — Socket.IO singleton + React wrapper
│   └── useAuth.ts                        — Better Auth session
└── lib/api.ts                            — Axios client + all API methods
```
