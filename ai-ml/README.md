# 🚑 AI Ambulance Allocation System — AI/ML Service

> **City-agnostic, production-ready FastAPI microservice** powering intelligent emergency dispatch across India using trained ML models + a custom Genetic Algorithm.

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4-orange)](https://scikit-learn.org)
[![Render](https://img.shields.io/badge/Deploy-Render-purple)](https://render.com)
[![Tests](https://img.shields.io/badge/Tests-51%20passing-brightgreen)](#testing)

---

## What this service does

Given a live emergency call, it orchestrates **four AI models** in sequence to produce a final dispatch decision:

```
Emergency call received
        │
        ▼
┌─────────────────────────────────┐
│  Model 1: Priority Classifier   │  → Low / Medium / High / Critical
│  (GradientBoosting, 23 features)│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Model 2: Hotspot Risk Score    │  → Risk 0.0–1.0 (Very Low → Critical)
│  (GradientBoosting, 20 features)│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Model 3: Traffic Congestion    │  → Congestion % + ETA multiplier
│  (RandomForest, 6 features)     │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  GA Engine: Ambulance Dispatch  │  → Best unit + ranked backups + ETA
│  (Custom GA, 5-objective fitness│
└─────────────────────────────────┘
```

---

## Project Structure

```
ai-ml/
├── app/
│   ├── main.py                    FastAPI app entry point + startup loader
│   ├── core/
│   │   ├── config.py              All settings (env vars + paths)
│   │   ├── constants.py           Domain constants (priority weights, etc.)
│   │   └── logging.py             Structured logging setup
│   ├── routes/
│   │   ├── health.py              GET /health
│   │   ├── predict_priority.py    POST /predict-priority
│   │   ├── predict_hotspot.py     POST /predict-hotspot
│   │   ├── predict_traffic.py     POST /predict-traffic
│   │   └── optimize_ambulance.py  POST /optimize-ambulance
│   ├── schemas/                   Pydantic request/response models
│   ├── services/
│   │   ├── model_loader.py        Loads artifacts on startup (singleton)
│   │   ├── model_trainer.py       Training logic (RF, GB, XGB comparison)
│   │   ├── preprocessing.py       Feature encoding pipelines
│   │   ├── data_loader.py         Dataset ingestion
│   │   ├── priority_service.py    Priority inference
│   │   ├── hotspot_service.py     Hotspot inference
│   │   ├── traffic_service.py     Traffic inference
│   │   └── ga_service.py          GA dispatch service
│   ├── ga/
│   │   ├── genetic_algorithm.py   Main GA engine (from scratch)
│   │   ├── fitness.py             5-objective fitness function
│   │   ├── selection.py           Tournament selection
│   │   ├── crossover.py           Single-point + uniform crossover
│   │   └── mutation.py            Gene-level mutation
│   └── utils/
│       ├── geo_utils.py           Haversine distance + ETA calculation
│       ├── feature_engineering.py Feature transforms (city-agnostic)
│       ├── helpers.py             Safe casting + parsing utilities
│       └── metrics.py             Evaluation helpers
├── artifacts/                     Pre-trained model artifacts (committed!)
│   ├── models/                    .joblib model files
│   ├── encoders/                  Label encoder mappings
│   ├── scalers/                   StandardScaler objects
│   └── reports/                   Training metrics JSON
├── datasets/                      Raw training data (not in git for size)
├── tests/
│   ├── test_ga.py                 29 GA unit + integration tests
│   └── test_utils.py              22 utility tests
├── train.py                       Local training entrypoint
├── test_inference.py              Model + GA smoke test (no server needed)
├── test_e2e.py                    Live API E2E test (10 Indian cities)
├── requirements.txt
├── Dockerfile
├── render.yaml                    One-click Render deployment config
└── api_doc.md                     Full API reference + curl examples
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- `pip` (packages install to user site on Windows)

### 1. Install dependencies

```bash
cd C:\Gen-Z\ai-ml        # Windows
# or
cd /path/to/Gen-Z/ai-ml  # Linux/Mac

pip install -r requirements.txt
```

### 2. Train all models (one-time, ~60 seconds)

```bash
python train.py
```

This:
- Loads 3 datasets (priority: 3,000 rows, hotspot: 20,000 rows, traffic: aggregated + 5,000 synthetic)
- Compares RandomForest vs GradientBoosting (vs XGBoost if installed)
- Saves the best model per task to `artifacts/`

### 3. Start the API server

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> ⚠️ **Windows tip:** Use `python -m uvicorn` not `uvicorn` — the bare command may not be on PATH.

### 4. Open interactive docs

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health check:** http://localhost:8000/health

---

## APIs

Full documentation with all fields, types, test scenarios and curl examples is in **[api_doc.md](./api_doc.md)**.

### Summary

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/health` | Service liveness + model status |
| `POST` | `/predict-priority` | Classify emergency: Low/Medium/High/Critical |
| `POST` | `/predict-hotspot` | Location risk score 0–1 |
| `POST` | `/predict-traffic` | Congestion % + ETA multiplier |
| `POST` | `/optimize-ambulance` | GA dispatch — best unit + backups + ETA |

### Quick example — full Kolkata dispatch

```bash
# 1. Priority
curl -X POST http://localhost:8000/predict-priority \
  -H "Content-Type: application/json" \
  -d '{"weather":"rainy","road_condition":"wet","road_type":"national highway",
       "hour":9,"day_of_week":1,"month":7,"num_vehicles":4,"num_casualties":4,
       "num_fatalities":0,"speed_limit":80,"alcohol_involvement":"No",
       "state":"West Bengal","city":"Kolkata"}'

# 2. Hotspot risk
curl -X POST http://localhost:8000/predict-hotspot \
  -H "Content-Type: application/json" \
  -d '{"city":"Kolkata","state":"West Bengal","latitude":22.5355,"longitude":88.3953,
       "hour":9,"day_of_week":1,"month":7,"weather":"rainy","road_type":"highway",
       "visibility":"medium","traffic_density":"high","traffic_signal":1,
       "lanes":6,"temperature":31,"vehicles_involved":4,"casualties":4,
       "is_peak_hour":1,"festival":"None","cause":"weather"}'

# 3. Traffic
curl -X POST http://localhost:8000/predict-traffic \
  -H "Content-Type: application/json" \
  -d '{"hour":9,"day_of_week":1,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":62}'

# 4. GA Dispatch
curl -X POST http://localhost:8000/optimize-ambulance \
  -H "Content-Type: application/json" \
  -d '{
    "patient_lat":22.5355,"patient_lon":88.3953,
    "priority_class":"Critical","hotspot_risk":0.85,"congestion_multiplier":2.1,
    "ambulances":[
      {"id":"KOL-MICU-01","latitude":22.5726,"longitude":88.3639,"status":"available","capability_level":4},
      {"id":"KOL-ALS-02","latitude":22.5800,"longitude":88.3500,"status":"available","capability_level":3},
      {"id":"KOL-MICU-04","latitude":22.5650,"longitude":88.3750,"status":"available","capability_level":4},
      {"id":"KOL-BLS-05","latitude":22.5900,"longitude":88.3400,"status":"busy","capability_level":2}
    ]}'
```

---

## Testing

### Unit tests (51 tests, no server needed)

```bash
python -m pytest tests/ -v
```

Covers:
- GA fitness, selection, crossover, mutation (29 tests)
- Geo math, helpers, feature engineering (22 tests)

### Inference smoke test (no server needed)

```bash
python test_inference.py
```

Loads models from disk and runs a full priority + hotspot + traffic + GA test.

### End-to-end live API test (server must be running)

```bash
python test_e2e.py
```

Runs **10 scenarios across India** — Kolkata (×2), Delhi, Mumbai, Bangalore, Hyderabad, Chennai, Pune, Jaipur, Lucknow — testing full encode → inference → decode → GA dispatch chain.

---

## Models

| # | Task | Algorithm | Dataset | Test Metric |
|---|------|-----------|---------|------------|
| 1 | Priority Classification | GradientBoostingClassifier | 3,000 accidents | F1-macro: 0.30 (3-class) |
| 2 | Hotspot Risk Regression | GradientBoostingRegressor | 20,000 incidents | RMSE: 0.0603 |
| 3 | Traffic Congestion | RandomForestRegressor | Delhi traffic + 5k synthetic | RMSE: 2.76% |
| GA | Ambulance Dispatch | Custom Genetic Algorithm | Runtime fleet data | Fitness ≥ 0.88 |

---

## Genetic Algorithm

Implemented **from scratch** — no GA library used.

| Component | Implementation |
|-----------|---------------|
| **Selection** | Tournament (k=5) |
| **Crossover** | Single-point (rate=0.8) |
| **Mutation** | Gene-level random (rate=0.05) |
| **Elitism** | Top 2 preserved each generation |
| **Stopping** | Early stop if no improvement for 15 gens |
| **Population** | 50 individuals |
| **Max generations** | 100 |

**Fitness function (5 objectives):**

| Objective | Weight |
|-----------|--------|
| Distance to patient | 25% |
| ETA with traffic | 30% |
| Priority–capability match | 20% |
| Fleet load balancing | 15% |
| Coverage efficiency | 10% |

---

## Deployment on Render

### Option A — One-click with render.yaml (recommended)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo
3. Render auto-detects `render.yaml` and configures everything
4. First deploy builds ~2 minutes — models load from committed `artifacts/`

### Option B — Manual Render setup

| Setting | Value |
|---------|-------|
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2` |
| **Region** | Singapore (closest to India) |
| **Plan** | Starter (free) or Standard for production |
| **Health Check Path** | `/health` |

### Environment variables (optional overrides)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `development` | Set `production` on Render |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `GA_POPULATION_SIZE` | `50` | GA population |
| `GA_MAX_GENERATIONS` | `100` | Max GA generations |
| `RANDOM_SEED` | `42` | Reproducibility seed |

### Docker deployment

```bash
# Models must be trained first
python train.py

# Build
docker build -t ai-ambulance .

# Run
docker run -p 8000:8000 -e ENVIRONMENT=production ai-ambulance
```

### ⚠️ Important: Never retrain on Render

Models are pre-trained locally and committed to `artifacts/`. The Render deploy **only loads them** — no training on the server. This keeps cold start time under 10 seconds.

---

## City Agnostic Design

The service works for **any Indian city** — nothing is hardcoded to a specific location.

| What varies | How it's handled |
|-------------|-----------------|
| City name | Runtime `city` + `state` string field |
| GPS location | Runtime `latitude` + `longitude` |
| Local traffic | `monthly_avg_congestion` field (caller provides their city's avg) |
| Fleet | Caller sends their ambulance list with real-time GPS |
| Language/encoding | Model trained on pan-India data covering all states |

**Verified cities:** Kolkata, Delhi, Mumbai, Bangalore, Hyderabad, Chennai, Pune, Jaipur, Ahmedabad, Lucknow, and any city with coordinates.

---

## CORS / Frontend Integration

CORS is pre-configured for all origins in production. To restrict:

```bash
# Render env var
CORS_ORIGINS=https://yourapp.vercel.app,https://yourdomain.com
```

The service is compatible with any frontend (React, Next.js, Vue, etc.) making `fetch`/`axios` calls from the browser.

---

## Datasets

| Dataset | Source | Rows | Used for |
|---------|--------|------|---------|
| `Emergency Priority Prediction (Model 1).csv` | Provided | 3,000 | Priority classifier |
| `Emergency Hotspot Prediction (Model 2).csv` | Provided | 20,000 | Hotspot regressor |
| `new_delhi_traffic_dataset/` | Provided | ~168 + 5k synthetic | Traffic regressor |

Datasets are **not committed** (large files). Only trained artifacts are committed.

---

## License

MIT — free to use, modify, and deploy.
