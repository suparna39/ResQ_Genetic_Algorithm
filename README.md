# ResQ — AI Ambulance Allocation System

> Full-stack emergency dispatch platform powered by Machine Learning (priority, hotspot, and traffic prediction) and a custom Genetic Algorithm (optimal ambulance dispatch), with real-time map tracking. Built with Next.js, Express, Supabase, Socket.IO, and a Python FastAPI ML service. Deployable across any Indian city.

**GitHub:** `https://github.com/MIRACULOUS65/Gen-Z`

---

## Architecture

```
Gen-Z/
├── frontend/          # Next.js 16 (App Router) + TypeScript + MapLibre GL
├── backend/           # Express + TypeScript + Socket.IO + Supabase + Better Auth
├── ai-ml/             # Python FastAPI service — 3 ML models + Genetic Algorithm
└── docs/              # Architecture, API, design, workflow docs
```

### How the pieces connect

```
Patient submits request  (frontend)
        │  POST /api/emergency/create
        ▼
Backend allocation pipeline  (backend)
        │  1. POST /predict-priority   → severity (Low…Critical)
        │  2. POST /predict-traffic    → congestion multiplier
        │  3. POST /predict-hotspot    → location risk 0–1
        │  4. POST /optimize-ambulance → GA picks best unit + ETA
        ▼  (each step falls back gracefully if the ML service is offline)
Assignment saved to Supabase, driver + patient notified via Socket.IO
        ▼
Driver accepts → shares live GPS → patient watches the ambulance move,
with the driving route drawn on the map (OSRM road routing).
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack), TypeScript, MapLibre GL JS, CartoDB dark tiles |
| Backend | Express 5, TypeScript, Socket.IO, Zod |
| Database | Supabase (PostgreSQL) |
| Auth | Better Auth (email + password, role-based) |
| Real-time | Socket.IO (driver location relay + status updates) |
| Maps / Routing | MapLibre GL JS + OSRM public routing API (straight-line fallback) |
| AI/ML | Python 3.11+ · FastAPI · scikit-learn · pandas · joblib |
| Allocation | Custom Genetic Algorithm (from scratch, 5-objective fitness) |

---

## Quick Start

Run all three services for the full experience. The backend and frontend work on their own; the AI-ML service adds the real ML predictions and GA dispatch (the backend falls back to a rule-based + nearest-ambulance heuristic if it's offline).

### 1. Database Setup (Supabase)

1. Open your **Supabase SQL Editor**
2. Run `backend/better_auth_migration.sql` first
3. Then run `backend/supabase_schema.sql`

### 2. AI-ML Service (Python)

```bash
cd ai-ml
pip install -r requirements.txt          # one time
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# → http://localhost:8000  (Swagger UI at /docs, health at /health)
```

Pre-trained models are committed in `ai-ml/artifacts/`, so no training is required to run.
To retrain locally: `python train.py`. See [ai-ml/README.md](./ai-ml/README.md).

### 3. Backend

```bash
cd backend
# Fill in .env (see Environment Variables below)
npm install
npm run dev
# → http://localhost:5000
```

### 4. Frontend

```bash
cd frontend
# Edit .env.local if needed (defaults work for local dev)
npm install
npm run dev
# → http://localhost:3000
```

---

## User Roles

| Role | Access |
|------|--------|
| **Patient** | Create emergency requests, live-track assigned ambulance with route |
| **Driver** | View assignment, accept/pickup/complete trip, broadcast GPS, see route to patient |
| **Admin** | Dashboard metrics, all requests, fleet management, assignments |

## Default Routes

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Create account (select role) |
| `/patient/dashboard` | Patient home |
| `/patient/request` | New emergency form |
| `/patient/track/[id]` | Live ambulance tracking + route |
| `/driver/dashboard` | Driver home + active task + navigation route |
| `/admin/dashboard` | Admin overview |
| `/admin/requests` | All emergency requests |
| `/admin/ambulances` | Fleet management |
| `/admin/assignments` | Assignment log |

---

## AI-ML Service Endpoints

Full reference with field tables, test scenarios and curl examples: [ai-ml/api_doc.md](./ai-ml/api_doc.md).

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/health` | Service liveness + model status |
| `POST` | `/predict-priority` | Emergency severity: Low → Critical |
| `POST` | `/predict-hotspot` | Location risk score 0–1 |
| `POST` | `/predict-traffic` | Congestion % + ETA multiplier |
| `POST` | `/optimize-ambulance` | GA dispatch — best unit + ranked backups + ETA |

**Models**

| # | Task | Algorithm | Test Metric |
|---|------|-----------|------------|
| 1 | Priority Classification | GradientBoostingClassifier | F1-macro ≈ 0.30 (3-class) |
| 2 | Hotspot Risk Regression | GradientBoostingRegressor | RMSE ≈ 0.0603 |
| 3 | Traffic Congestion | RandomForestRegressor | RMSE ≈ 2.76% |
| GA | Ambulance Dispatch | Custom Genetic Algorithm | Fitness ≥ 0.88 |

**Genetic Algorithm** — tournament selection (k=5), single-point crossover (0.8), gene mutation (0.05), elitism (top 2), population 50, early stop after 15 stagnant generations. Fitness blends distance (25%), ETA-with-traffic (30%), priority–capability match (20%), load balancing (15%), and coverage (10%).

**Verified for:** Kolkata · Delhi · Mumbai · Bangalore · Hyderabad · Chennai · Pune · Jaipur · Lucknow · Ahmedabad — and any city with coordinates.

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres.xxx:password@aws-region.pooler.supabase.com:6543/postgres

BETTER_AUTH_SECRET=your_32_char_random_secret
BETTER_AUTH_URL=http://localhost:5000

AI_ML_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## Design System

Strict black-and-white monochrome palette ("Black Monochrome Command UI"):

| Token | Value |
|-------|-------|
| `--bg-base` | `#050505` |
| `--bg-card` | `#111111` |
| `--text-primary` | `#ededed` |
| `--text-muted` | `#7a7a7a` |
| `--border` | `#2a2a2a` |

Font: **Geist** (sans) + **Geist Mono** (code). Maps use MapLibre GL with CartoDB Dark Matter tiles.

---

## Deployment

- **AI-ML:** Render (Singapore region) — `render.yaml` auto-config, models load from committed `artifacts/`. See [ai-ml/README.md → Deployment](./ai-ml/README.md#deployment-on-render).
- **Backend:** Render / Railway / any Node host.
- **Frontend:** Vercel or any Next.js host.

## Documentation

- [Design](./docs/design.md)
- [Architecture](./docs/architecture.md)
- [Tech Stack](./docs/tech_stack.md)
- [API Specification](./docs/api.md)
- [Workflow](./docs/workflow.md)
- [AI/ML API Reference](./ai-ml/api_doc.md)

---

## License

MIT — free to use, modify, and deploy.
