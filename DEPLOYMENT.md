# 🚑 ResQ — Deployment Guide

Three services, deployed independently:

| Service | Folder | Platform | Type |
|---------|--------|----------|------|
| AI/ML (FastAPI) | `ai-ml/` | **Render** | Web Service (Python) |
| Backend (Express + Socket.IO) | `backend/` | **Render** | Web Service (Node) |
| Frontend (Next.js) | `frontend/` | **Vercel** | Next.js project |

> ⚠️ **Important:** The AI/ML and Backend are **running servers**, so on Render they must be created as **Web Services**, NOT "Static Sites". A Static Site only serves pre-built files and cannot run Python/Node — it would not work for these. (Only the Next.js frontend could theoretically be static, but we deploy it on Vercel instead.)

Deploy in this order so each service knows the URL of the one before it:
**1) AI/ML → 2) Backend → 3) Frontend.** Then do one final backend env update with the real frontend URL.

---

## 0. One-time: Database setup (Supabase)

The backend uses your existing Supabase Postgres. Before the first backend deploy, create the tables once. From your local machine:

```bash
cd backend
# .env must contain the production DATABASE_URL
npm install
npm run migrate
```

This creates the Better Auth tables (`user`, `session`, `account`, `verification`) and the app tables (`ambulances`, `emergency_requests`, `assignments` with `ga_metrics`, `tracking_logs`) plus seed ambulances. Safe to re-run (idempotent).

---

## 1. AI/ML Service → Render (Web Service, Python)

### Create the service
Render Dashboard → **New +** → **Web Service** → connect your GitHub repo.

| Field | Value |
|-------|-------|
| **Name** | `resq-ai-ml` |
| **Language / Runtime** | `Python 3` |
| **Region** | `Singapore` |
| **Branch** | `main` |
| **Root Directory** | `ai-ml` |
| **Build Command** | `pip install --upgrade pip && pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` |
| **Health Check Path** | `/health` |
| **Instance Type** | `Starter` (or Free) |

### Environment Variables (Environment tab)

| Key | Value |
|-----|-------|
| `PYTHON_VERSION` | `3.12.7` |
| `ENVIRONMENT` | `production` |
| `LOG_LEVEL` | `INFO` |
| `CORS_ORIGINS` | `*` |
| `GA_POPULATION_SIZE` | `50` |
| `GA_MAX_GENERATIONS` | `100` |
| `RANDOM_SEED` | `42` |

> The trained models are committed in `ai-ml/artifacts/` and load on startup — no training happens on Render. `requirements.txt` pins the exact ML versions used to create them.

After deploy, note the URL, e.g. **`https://resq-ai-ml.onrender.com`**. Verify:
```
https://resq-ai-ml.onrender.com/health   →  {"status":"healthy", ...}
https://resq-ai-ml.onrender.com/docs      →  Swagger UI
```

> 💡 The `ai-ml/render.yaml` Blueprint sets all of the above automatically if you use Render's **Blueprint** flow instead of manual setup.

---

## 2. Backend → Render (Web Service, Node)

### Create the service
Render Dashboard → **New +** → **Web Service** → same repo.

| Field | Value |
|-------|-------|
| **Name** | `resq-backend` |
| **Language / Runtime** | `Node` |
| **Region** | `Singapore` (same as AI/ML) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm run start` |
| **Health Check Path** | `/health` |
| **Instance Type** | `Starter` |

> `--include=dev` is required so TypeScript + `@types/*` install and `tsc` can build, even with `NODE_ENV=production`.

### Environment Variables (Environment tab)

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_VERSION` | `22.20.0` | |
| `NODE_ENV` | `production` | |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | Supabase pooler self-signed cert |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | from Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | `eyJ...` | from Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **secret** — Supabase API settings |
| `DATABASE_URL` | `postgresql://postgres.xxxx:PASSWORD@aws-1-...pooler.supabase.com:5432/postgres` | Supabase → Connection Pooling |
| `BETTER_AUTH_SECRET` | 32+ char random string | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://resq-backend.onrender.com` | **this service's own URL** |
| `AI_ML_SERVICE_URL` | `https://resq-ai-ml.onrender.com` | URL from Step 1 |
| `FRONTEND_URL` | `https://your-app.vercel.app` | set/refine after Step 3 |

> `BETTER_AUTH_URL` = the backend's own Render URL (you can paste it right after the service is created — it's shown at the top of the dashboard).
> `FRONTEND_URL` accepts a **comma-separated list** for multiple domains, e.g. `https://resq.vercel.app,https://www.resq.com`. Any `*.vercel.app` preview URL is auto-allowed by the server, so you don't need to list previews.

Verify after deploy:
```
https://resq-backend.onrender.com/health   →  {"status":"ok", ...}
```

---

## 3. Frontend → Vercel (Next.js)

### Create the project
Vercel Dashboard → **Add New** → **Project** → import the repo.

| Field | Value |
|-------|-------|
| **Framework Preset** | `Next.js` (auto-detected) |
| **Root Directory** | `frontend` |
| **Build Command** | `next build` (default) |
| **Install Command** | `npm install` (default) |
| **Output** | (leave default) |

### Environment Variables (Settings → Environment Variables)

| Key | Value | Environments |
|-----|-------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://resq-backend.onrender.com` | Production, Preview, Development |
| `NEXT_PUBLIC_SOCKET_URL` | `https://resq-backend.onrender.com` | Production, Preview, Development |

> Both point at the **backend** Render URL (Socket.IO runs on the same server). No trailing slash. `NEXT_PUBLIC_` prefix is required so the browser can read them.

Deploy, then note your Vercel URL, e.g. **`https://resq.vercel.app`**.

---

## 4. Final wiring (close the loop)

Go back to the **backend** service on Render → Environment → set:

```
FRONTEND_URL = https://resq.vercel.app
```

Save (Render auto-redeploys). This authorizes CORS + Better Auth for your real frontend domain.

---

## ✅ Post-deploy checklist

- [ ] `GET /health` works on both Render services
- [ ] AI/ML `/docs` loads and `/health` shows all 3 models `loaded`
- [ ] Frontend loads, register + login work (Better Auth → backend)
- [ ] Create an emergency → ambulance is assigned (backend → AI/ML GA)
- [ ] Live tracking map + GA metrics panel render (Socket.IO connected)
- [ ] No CORS errors in the browser console

---

## Notes & gotchas

- **Free tier cold starts:** Render free Web Services sleep after ~15 min idle and take ~30–60 s to wake. The backend's AI/ML calls already have a 6 s timeout with a deterministic fallback, so dispatch still works if the AI/ML service is waking. Upgrade to a paid instance to avoid sleeping.
- **Region:** keep AI/ML and backend in the **same region** (`Singapore`) to minimise the backend↔AI latency.
- **Secrets:** never commit `.env`. `backend/.env` is gitignored; only `.env.example` files are tracked. Set real values in the dashboards.
- **Model artifacts:** committed in `ai-ml/artifacts/` (~small). If you retrain locally (`python train.py`), commit the new artifacts and keep `requirements.txt` versions in sync with your local scikit-learn.
- **Blueprints:** both `ai-ml/render.yaml` and `backend/render.yaml` exist. You can deploy each via Render's **Blueprint** flow (New + → Blueprint → pick repo → choose the folder) instead of manual setup; you'll still set the `sync: false` secrets in the dashboard.
