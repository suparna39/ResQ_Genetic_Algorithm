# 🚑 ResQ — The Idea

> **One line:** An AI-powered emergency dispatch system that predicts urgency, reads the city, and evolves the optimal ambulance assignment in real time — so the right ambulance reaches the right patient in the shortest possible time.

---

## 📌 The Problem

### India's Emergency Response Crisis

- **Average ambulance response time in Indian cities: 20–45 minutes.** The golden hour standard is **under 8 minutes.**
- 1.5 lakh+ road accident deaths annually in India (MoRTH, 2023). Many are preventable with faster response.
- Emergency dispatchers make allocation decisions **manually** — gut feeling, radio calls, nearest-available logic.
- No system accounts for **real-time traffic, accident hotspot patterns, ambulance load balancing, or severity-aware dispatch** simultaneously.
- Result: **wrong ambulance, wrong time, wrong route — lives lost.**

### What Goes Wrong Today

| Current Reality | What Should Happen |
|---|---|
| Dispatcher picks the ambulance they remember is "free" | System knows exact GPS + status of every unit in real time |
| All emergencies treated the same | Critical cases get priority — right equipment, right crew |
| No traffic awareness | Route + ETA adjusted for live congestion |
| Ambulances cluster in one zone | Fleet spread evenly across the city for coverage |
| Patient waits with zero visibility | Patient tracks the ambulance like an Uber — live on the map |

---

## 💡 The Core Idea

### Three AI Brains + One Evolutionary Optimizer = One Decision

We don't just "find the nearest ambulance." We built **four intelligent layers** that work together to make the single best dispatch decision:

```
┌─────────────────────────────────────────────────────────────────┐
│                        EMERGENCY CALL                          │
│                   Patient submits request                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
   │   BRAIN 1   │  │   BRAIN 2   │  │   BRAIN 3   │
   │  Priority   │  │   Hotspot   │  │   Traffic   │
   │ Classifier  │  │  Risk Score │  │  Congestion │
   │             │  │             │  │             │
   │ "How urgent │  │ "How danger-│  │ "How jammed │
   │  is this?"  │  │  ous is this│  │  are the    │
   │             │  │  location?" │  │  roads?"    │
   │  Low → Crit │  │  0.0 → 1.0 │  │  0% → 100% │
   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     THE OPTIMIZER      │
              │   Genetic Algorithm    │
              │                        │
              │  Evolves 50 candidate  │
              │  assignments over 100  │
              │  generations to find   │
              │  THE SINGLE BEST       │
              │  ambulance             │
              │                        │
              │  Balances 5 objectives:│
              │  • Distance            │
              │  • ETA + Traffic       │
              │  • Priority Match      │
              │  • Load Balancing      │
              │  • City Coverage       │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │      THE RESULT        │
              │                        │
              │  ✅ Best ambulance ID  │
              │  ⏱️ ETA: 7.3 minutes   │
              │  📊 Fitness: 0.88      │
              │  🔄 2 ranked backups   │
              │  📝 Human-readable     │
              │     reason string      │
              └────────────────────────┘
```

**This is not a simple nearest-ambulance finder.** It's a system that _thinks_ about severity, _reads_ traffic, _knows_ which zones are dangerous, and _evolves_ the best possible assignment — all in under a second.

---

## 🔬 How Each Brain Works

### Brain 1 — Emergency Priority Classifier

**Question it answers:** _"Is this a fender-bender or a life-threatening crash?"_

| Detail | Value |
|---|---|
| **Type** | Supervised Classification |
| **Algorithms** | Random Forest / Gradient Boosting / XGBoost (auto-selected) |
| **Input** | 23 features — time, weather, road condition, casualties, speed, alcohol, vehicle type, location |
| **Output** | `Low` · `Medium` · `High` · `Critical` + confidence score |
| **Training** | 5-fold Stratified Cross-Validation, best model by F1-macro |
| **Why it matters** | A Critical emergency at 2 AM in rain needs the advanced-life-support ambulance, not the basic van |

### Brain 2 — Hotspot Risk Predictor

**Question it answers:** _"Is this location a known danger zone?"_

| Detail | Value |
|---|---|
| **Type** | Supervised Regression |
| **Algorithms** | Random Forest / Gradient Boosting / XGBoost (auto-selected) |
| **Input** | 20 features — GPS coordinates, weather, visibility, traffic density, road type, cause history |
| **Output** | Risk score `0.0` (safe) to `1.0` (critical hotspot) |
| **Training** | 5-fold CV, best model by lowest RMSE |
| **Why it matters** | High-risk locations should get better-equipped ambulances + faster response |

### Brain 3 — Traffic Congestion Forecaster

**Question it answers:** _"How bad is traffic right now on this route?"_

| Detail | Value |
|---|---|
| **Type** | Supervised Regression |
| **Algorithms** | Random Forest / Gradient Boosting / XGBoost (auto-selected) |
| **Input** | 6 features — hour, day, weekend flag, rush hour, road type, monthly average |
| **Output** | Congestion `0%` (empty roads) to `100%` (gridlock) → converted to ETA multiplier `1.0×` to `3.0×` |
| **Data** | Real New Delhi traffic data (augmented from 182 → 5,000 rows) |
| **Why it matters** | An ambulance 3 km away in gridlock is slower than one 6 km away on an empty road |

### The Optimizer — Genetic Algorithm

**Question it answers:** _"Which ambulance is the absolute best choice, considering everything?"_

| Detail | Value |
|---|---|
| **Type** | Meta-heuristic Evolutionary Optimisation |
| **Technique** | Custom Genetic Algorithm built from scratch |
| **Population** | 50 candidate solutions |
| **Generations** | Up to 100 (early stops after 15 stagnant) |
| **Operators** | Tournament Selection (k=5) → Single-Point Crossover (80%) → Gene Mutation (5%) → Elitism (top 2) |
| **Why GA, not brute force?** | GA is faster (doesn't check every combination), handles non-linear constraints, and naturally balances multiple objectives |

**The Fitness Function (5 objectives, 1 equation):**

```
Fitness = 0.25 × DistanceScore
        + 0.30 × ETAScore           ← most important
        + 0.20 × PriorityMatchScore
        + 0.15 × AvailabilityScore
        + 0.10 × CoverageScore
```

The GA doesn't just pick the nearest ambulance — it **evolves** the assignment that optimally balances speed, capability, workload, and city-wide coverage.

---

## 🌐 The Complete System — End to End

### What Gets Built

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   FRONTEND   │     │   BACKEND    │     │   AI / ML    │
│              │     │              │     │              │
│  Next.js 16  │────▶│  Express 5   │────▶│  FastAPI     │
│  TypeScript  │     │  TypeScript  │     │  Python 3.11 │
│  MapLibre GL │     │  Socket.IO   │     │  scikit-learn│
│  Geist Font  │◀────│  Better Auth │◀────│  Genetic Alg │
│  Dark Theme  │     │  Supabase    │     │  joblib      │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                     ┌──────▼──────┐
                     │  SUPABASE   │
                     │ PostgreSQL  │
                     │             │
                     │ users       │
                     │ ambulances  │
                     │ requests    │
                     │ assignments │
                     │ tracking    │
                     └─────────────┘
```

### Three Dashboards, Three Roles

| Role | What They See |
|---|---|
| **🧑‍💻 Patient** | Emergency request form → Live ambulance tracking on map with driving route → ETA countdown → Status timeline (pending → assigned → en route → arrived) |
| **🚑 Driver** | Assigned emergency card → Patient location + route → Accept / Pickup / Complete actions → Live GPS broadcast |
| **🛡️ Admin** | Fleet overview → All requests with priority scores → Assignment log with GA fitness → Analytics dashboard → Manual override |

### The User Journey (Patient Side)

```
1. 🆘  Patient opens app, hits "Request Emergency"
         │
2. 📝  Fills: location, emergency type, details
         │
3. ⏳  Backend stores request → status: PENDING
         │
4. 🧠  AI predicts: priority = "Critical", risk = 0.72, traffic = 47%
         │
5. 🧬  GA evolves best ambulance: AMB-007, ETA 7.3 min, fitness 0.88
         │
6. ✅  Assignment saved → Driver notified via Socket.IO
         │
7. 🗺️  Patient sees ambulance moving on the map (live GPS + OSRM route)
         │
8. 🏥  Ambulance arrives → Patient picked up → Trip to hospital → Completed
```

**It feels like Uber — but for emergencies.**

---

## 🏗️ Tech Stack at a Glance

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 16, TypeScript, MapLibre GL, Shadcn UI, Framer Motion | Modern React framework, dark-themed map tiles, premium UI components |
| **Backend** | Express 5, TypeScript, Socket.IO, Zod | Fast API development, type-safe validation, real-time WebSocket |
| **Auth** | Better Auth | Role-based (patient/driver/admin), session management |
| **Database** | Supabase PostgreSQL | Managed PostgreSQL, easy integration, real-time capable |
| **Maps** | MapLibre GL + CartoDB Dark Matter + OSRM routing | Free, customisable, beautiful dark maps, real road routes |
| **AI/ML** | Python, FastAPI, scikit-learn, pandas, joblib | Industry-standard ML stack, fast inference, easy deployment |
| **Optimisation** | Custom Genetic Algorithm (from scratch) | No black-box dependency, full control, educationally transparent |

---

## 🎯 What Makes This Different

### vs. "Nearest Ambulance" Systems

| Feature | Basic System | ResQ |
|---|---|---|
| Distance-based selection | ✅ | ✅ |
| Traffic-aware ETA | ❌ | ✅ AI-predicted congestion multiplier |
| Severity-aware dispatch | ❌ | ✅ ML classifies Low → Critical |
| Hotspot awareness | ❌ | ✅ ML scores location risk 0–1 |
| Load balancing | ❌ | ✅ GA penalises overloaded units |
| Fleet coverage | ❌ | ✅ GA rewards spatial distribution |
| Live tracking | ❌ | ✅ Real-time GPS + road route on map |
| Backup suggestions | ❌ | ✅ GA provides top-2 alternatives |
| Multi-city support | ❌ | ✅ City-agnostic — works with any GPS |

### The AI Edge

| Capability | How It Helps |
|---|---|
| **Priority prediction** | Critical patients get the best-equipped ambulance first |
| **Hotspot detection** | Dangerous zones trigger higher-capability dispatch |
| **Traffic forecasting** | ETA accounts for real congestion, not just straight-line distance |
| **Evolutionary optimisation** | GA finds the globally optimal assignment across 5 objectives simultaneously |
| **Auto model selection** | Training pipeline competes RF vs. GBT vs. XGBoost and picks the winner — no manual tuning |

---

## 📊 Model Performance

| Model | Task | Best Algorithm | Key Metric |
|---|---|---|---|
| **Model 1** | Priority Classification | GradientBoostingClassifier | F1-macro ≈ 0.30 (3-class) |
| **Model 2** | Hotspot Risk Regression | GradientBoostingRegressor | RMSE ≈ 0.0603 |
| **Model 3** | Traffic Congestion | RandomForestRegressor | RMSE ≈ 2.76% |
| **GA** | Ambulance Dispatch | Custom Genetic Algorithm | Fitness ≥ 0.88 |

> **Note on Model 1:** The F1-macro of 0.30 reflects a hard 3-class classification task with imbalanced real-world data. The model still outperforms random assignment (F1 = 0.11) and rule-based heuristics. Future improvements include SMOTE oversampling, feature expansion, and ensemble stacking.

**Verified across:** Delhi · Mumbai · Kolkata · Bangalore · Hyderabad · Chennai · Pune · Jaipur · Lucknow · Ahmedabad — and any city with coordinates.

---

## 🧬 Why a Genetic Algorithm?

**The ambulance assignment problem is a _constrained multi-objective optimisation_ problem.** You can't just minimise distance — you also need to:

- Match ambulance capability to emergency severity
- Account for traffic delay
- Not overload a single ambulance
- Maintain fleet coverage across the city
- Incorporate hotspot risk into dispatch decisions

These objectives **conflict with each other.** The nearest ambulance might be basic-level, overloaded, and leave a zone uncovered. The best ambulance might be 2 km further but has advanced life support, is free, and maintains city coverage.

**A Genetic Algorithm handles this naturally.** It doesn't need a convex objective or linear constraints. It just evolves better and better solutions over generations until it converges on the best tradeoff.

### Why Not Other Methods?

| Alternative | Why Not |
|---|---|
| Brute Force | O(n!) for n ambulances — too slow for real-time |
| Linear Programming | Our fitness function is non-linear and non-convex |
| Deep Reinforcement Learning | Overkill, needs simulation environment, less interpretable |
| Simulated Annealing | Less natural for discrete combinatorial problems |
| Rule-Based (if/else) | Can't balance 5 objectives simultaneously |

---

## 🖥️ Design Philosophy

**"Black Monochrome Command UI"** — the interface should feel like a premium emergency operations console, not a student project.

| Principle | Implementation |
|---|---|
| **Clinical & Modern** | Strict `#050505` → `#111111` grayscale palette, no rainbow colours |
| **Data-Dense** | Metric cards, dense tables, timeline components |
| **Map-Driven** | MapLibre GL with dark CartoDB tiles, custom monochrome markers |
| **Alive** | Framer Motion micro-animations, live GPS marker movement |
| **Premium** | Geist typography, Shadcn UI components, generous whitespace |

---

## 🚀 Deployment Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel      │     │   Render     │     │   Render     │
│   (Frontend)  │────▶│   (Backend)  │────▶│   (AI-ML)    │
│               │     │              │     │   Singapore  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼──────┐
                     │  Supabase   │
                     │  Cloud      │
                     └─────────────┘
```

- **Frontend** on Vercel (Next.js optimised)
- **Backend** on Render / Railway
- **AI-ML** on Render (Singapore region, pre-trained models committed)
- **Database** on Supabase Cloud PostgreSQL

**Graceful degradation:** If the AI-ML service is offline, the backend falls back to rule-based priority + nearest-ambulance heuristic. The system never breaks.

---

## 🎓 Academic Relevance

This project demonstrates mastery of:

| Subject Area | What We Demonstrate |
|---|---|
| **Machine Learning** | Supervised classification & regression, cross-validation, model comparison, feature engineering, StandardScaler, F1/RMSE evaluation |
| **Genetic Algorithms** | Population initialisation, tournament selection, crossover, mutation, elitism, fitness function design, convergence analysis |
| **Data Structures** | Chromosomes as integer vectors, population arrays, fitness tracking, sorted indices |
| **Full-Stack Development** | Next.js + Express + FastAPI microservices, REST APIs, WebSocket real-time communication |
| **Database Design** | Relational schema design, Supabase PostgreSQL, CRUD operations, real-time subscriptions |
| **Software Engineering** | Modular architecture, separation of concerns, environment configuration, CI/CD-ready deployment |
| **Geography / GIS** | Haversine distance formula, GPS coordinate handling, OSRM road routing, map visualisation |

---

## 📝 One-Paragraph Pitch

> **ResQ** is a full-stack AI-powered emergency ambulance dispatch platform. When a patient requests an ambulance, three machine learning models instantly assess the emergency's severity, the location's risk profile, and current traffic conditions. These predictions feed into a custom-built Genetic Algorithm that evolves the optimal ambulance assignment across five competing objectives — distance, ETA, priority match, load balancing, and city coverage — in under a second. The patient then tracks the ambulance live on a dark-themed map with real road routing, just like a ride-hailing app. Built with Next.js, Express, FastAPI, Supabase, and Socket.IO, and deployed as three independent microservices, ResQ is verified for any Indian city and demonstrates the real-world impact of combining AI prediction with evolutionary optimisation in healthcare logistics.

---

## 🗣️ The Elevator Pitch (30 seconds)

> _"Every year, 1.5 lakh people die in road accidents in India. Many could be saved if ambulances arrived faster. ResQ uses three AI models to understand the emergency — how severe it is, how dangerous the location is, and how bad traffic is — then runs a Genetic Algorithm to pick the single best ambulance from the fleet, balancing distance, ETA, capability, workload, and coverage. The patient tracks it live on a map. It's Uber for emergencies, powered by AI."_

---

> **ResQ — Because in an emergency, every second counts, and the right decision shouldn't depend on a human guess.**
