# 🧠 AI/ML Architecture — End-to-End Technical Deep Dive

> **Gen-Z Emergency Ambulance Allocation System**
> This document is the single source of truth for every AI/ML component in the project — what models we use, why we chose them, what math powers them, how the Genetic Algorithm optimises ambulance dispatch, and how every function fits together.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [End-to-End Data Flow](#2-end-to-end-data-flow)
3. [Model 1 — Emergency Priority Classifier](#3-model-1--emergency-priority-classifier)
4. [Model 2 — Hotspot Risk Regressor](#4-model-2--hotspot-risk-regressor)
5. [Model 3 — Traffic Congestion Regressor](#5-model-3--traffic-congestion-regressor)
6. [Genetic Algorithm (GA) — Ambulance Optimisation](#6-genetic-algorithm-ga--ambulance-optimisation)
7. [Mathematics Reference](#7-mathematics-reference)
8. [Key Functions — Code Walkthrough](#8-key-functions--code-walkthrough)
9. [Model Comparison & Selection Strategy](#9-model-comparison--selection-strategy)
10. [Accuracy & Evaluation Metrics](#10-accuracy--evaluation-metrics)
11. [What Is NOT Used and Why](#11-what-is-not-used-and-why)
12. [File Map](#12-file-map)

---

## 1. System Overview

The AI/ML service is a **FastAPI microservice** (`app/main.py`) that exposes four prediction/optimisation endpoints:

| Endpoint | Purpose | Core Technique |
|---|---|---|
| `POST /predict-priority` | Classify emergency severity | Supervised Classification (Random Forest / Gradient Boosting / XGBoost) |
| `POST /predict-hotspot` | Estimate accident risk score at a location | Supervised Regression (Random Forest / Gradient Boosting / XGBoost) |
| `POST /predict-traffic` | Estimate traffic congestion percentage | Supervised Regression (Random Forest / Gradient Boosting / XGBoost) |
| `POST /optimize-ambulance` | Pick the best ambulance from the fleet | **Genetic Algorithm** (meta-heuristic optimisation) |

The three ML models feed **into** the Genetic Algorithm. They are not independent — they form a **pipeline**:

```
Emergency Call
    │
    ├──▶ Model 1 (Priority)   → priority_class  (Low / Medium / High / Critical)
    ├──▶ Model 2 (Hotspot)    → risk_score       (0.0 – 1.0)
    ├──▶ Model 3 (Traffic)    → congestion_mult  (1.0 – 3.0)
    │
    └──▶ Genetic Algorithm
              │
              │  Inputs: priority_class + risk_score + congestion_mult + fleet GPS
              │
              └──▶ Output: best_ambulance_id, ETA, fitness_score, backups
```

---

## 2. End-to-End Data Flow

### 2.1 Training Pipeline (`train.py`)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Raw CSVs   │────▶│  data_loader.py  │────▶│ preprocessing.py│────▶│model_trainer.py│
│  (datasets/)│     │  (normalise,     │     │  (feature eng., │     │  (CV, train,  │
│             │     │   parse, merge)  │     │   encode, scale)│     │   evaluate)   │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────┬────────┘
                                                                            │
                                                                 ┌──────────▼──────────┐
                                                                 │  artifacts/         │
                                                                 │  ├─ models/*.joblib │
                                                                 │  ├─ encoders/*.joblib│
                                                                 │  ├─ scalers/*.joblib │
                                                                 │  └─ reports/*.json  │
                                                                 └─────────────────────┘
```

**Step-by-step:**

1. **Load** — `data_loader.py` reads CSV files, normalises column names to `snake_case`, fills missing values (numeric → median, categorical → `"Unknown"`).
2. **Preprocess** — `preprocessing.py` runs feature engineering: time features (hour, day_of_week, is_rush_hour), ordinal encoding (weather, road type, visibility), label encoding (city, state, vehicle type), and `StandardScaler` normalisation.
3. **Train** — `model_trainer.py` evaluates 2-3 candidate algorithms via **k-fold cross-validation**, picks the best, fits it on the full training set, evaluates on a held-out test set, and saves all artifacts with `joblib`.

### 2.2 Inference Pipeline

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────┐
│  Request  │────▶│ *_service.py │────▶│  Saved model   │────▶│ Response │
│  (JSON)   │     │ (build row,  │     │  .predict()    │     │  (JSON)  │
│           │     │  scale)      │     │  .predict_proba│     │          │
└──────────┘     └──────────────┘     └────────────────┘     └──────────┘
```

Models are loaded **once** on FastAPI startup via `model_loader.py` → held as module-level singletons → zero disk I/O per request.

---

## 3. Model 1 — Emergency Priority Classifier

### 3.1 What It Does

Classifies an incoming emergency into one of **four priority classes**:

| Class | Numeric Weight (GA) | Meaning |
|---|---|---|
| `Low` | 1 | Minor incident, non-urgent |
| `Medium` | 2 | Standard emergency |
| `High` | 3 | Serious — requires fast response |
| `Critical` | 4 | Fatal risk — highest urgency |

### 3.2 Dataset

**File:** `datasets/Emergency Priority Prediction (Model 1).csv`

| Column | Example | Usage |
|---|---|---|
| `accident_severity` | Minor / Serious / Fatal | **Target** (mapped via `SEVERITY_TO_PRIORITY`) |
| `time_of_day` | "14:30" | Extracted → `hour` |
| `weather_conditions` | "Rainy" | Ordinal encoded → 0-3 |
| `road_type` | "Urban Road" | Ordinal encoded → 0-3 |
| `road_condition` | "Wet" | Ordinal encoded → 0-3 |
| `number_of_casualties` | 3 | Numeric feature |
| `number_of_fatalities` | 0 | Numeric feature |
| `speed_limit_km_h` | 80 | Numeric feature |
| `driver_age` | 28 | Numeric feature |
| `alcohol_involvement` | "Yes" / "No" | Binary encoded → 0/1 |
| `state_name`, `city_name` | "Delhi" | Label encoded → integer |

### 3.3 Feature Vector (23 features)

```python
PRIORITY_FEATURES = [
    "hour", "day_of_week", "month", "is_weekend", "is_rush_hour", "time_period",
    "weather_code", "road_type_code", "road_condition_code", "lighting_code",
    "traffic_control_code", "vehicle_type_code", "location_type_code",
    "num_vehicles", "num_casualties", "num_fatalities",
    "speed_limit", "driver_age", "driver_gender_code",
    "license_status_code", "alcohol_involvement_code",
    "state_code", "city_code",
]
```

### 3.4 Candidate Models

| # | Algorithm | Hyperparameters | Why Considered |
|---|---|---|---|
| 1 | **RandomForestClassifier** | `n_estimators=300, max_depth=12, class_weight="balanced"` | Handles class imbalance well, robust to noise, no feature scaling required (but we scale anyway for consistency) |
| 2 | **GradientBoostingClassifier** | `n_estimators=200, max_depth=5, lr=0.1` | Sequential boosting corrects errors, typically higher accuracy on tabular data |
| 3 | **XGBClassifier** *(optional)* | `n_estimators=300, max_depth=6, lr=0.1` | State-of-art gradient boosting, regularised, parallelised — only used if `xgboost` is installed |

### 3.5 Training Strategy

```python
# Stratified K-Fold ensures each fold has the same class distribution
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# Scoring: macro-averaged F1 — treats all classes equally
scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="f1_macro")
```

- **Train/Test Split:** 80% train / 20% test (stratified by class)
- **Cross-Validation:** 5-fold stratified
- **Selection Metric:** Highest mean CV **F1-macro** wins
- **Final Fit:** Winner is re-fitted on the full 80% training set
- **Test Evaluation:** Accuracy, F1-macro, Precision-macro, Recall-macro on the held-out 20%

### 3.6 Inference Code Explained

```python
# priority_service.py → predict_priority()
def predict_priority(request_data):
    model, encoders, scaler = get_priority_artifacts()  # singleton load
    row = _build_priority_row(request_data, encoders)    # manual feature construction
    df = pd.DataFrame([row])
    X_scaled = scaler.transform(df[PRIORITY_FEATURES])   # StandardScaler applied

    proba = model.predict_proba(X_scaled)[0]             # class probabilities
    pred_idx = np.argmax(proba)                          # highest probability class
    pred_label = le.inverse_transform([pred_idx])[0]     # integer → "High"
```

**Returns:** `{ priority_class, confidence, label_probabilities, metadata }`

---

## 4. Model 2 — Hotspot Risk Regressor

### 4.1 What It Does

Predicts a **risk score (0.0 – 1.0)** for a given geographic location + time + conditions. This score is then bucketed:

| Score Range | Risk Category |
|---|---|
| 0.00 – 0.30 | Very Low |
| 0.30 – 0.50 | Low |
| 0.50 – 0.70 | Medium |
| 0.70 – 0.85 | High |
| 0.85 – 1.00 | Critical |

### 4.2 Dataset

**File:** `datasets/Emergency Hotspot Prediction (Model 2).csv` (~2.7 MB)

Key columns: `latitude`, `longitude`, `hour`, `weather`, `visibility`, `traffic_density`, `cause`, `casualties`, `risk_score` (target).

### 4.3 Feature Vector (20 features)

```python
HOTSPOT_FEATURES = [
    "hour", "day_of_week", "month", "is_weekend", "is_rush_hour", "time_period",
    "weather_code", "road_type_code", "visibility_code", "traffic_density_code",
    "traffic_signal", "lanes", "temperature", "vehicles_involved", "casualties",
    "is_peak_hour", "festival_code", "cause_code",
    "latitude", "longitude",
]
```

### 4.4 Candidate Models

| # | Algorithm | Hyperparameters |
|---|---|---|
| 1 | **RandomForestRegressor** | `n_estimators=300, max_depth=12` |
| 2 | **GradientBoostingRegressor** | `n_estimators=200, max_depth=5, lr=0.05` |
| 3 | **XGBRegressor** *(optional)* | `n_estimators=300, max_depth=6, lr=0.05` |

### 4.5 Training Strategy

```python
cv = KFold(n_splits=5, shuffle=True, random_state=42)
scores = cross_val_score(model, X_train, y_train, cv=cv,
                         scoring="neg_root_mean_squared_error")
mean_rmse = -scores.mean()  # lower RMSE wins
```

- **Selection Metric:** Lowest mean CV **RMSE**
- **Test Evaluation:** RMSE and MAE on the held-out 20%

### 4.6 Inference

```python
# hotspot_service.py → predict_hotspot()
risk_score = float(np.clip(model.predict(X_scaled)[0], 0.0, 1.0))
category = _score_to_category(risk_score)  # bins into Very Low...Critical
```

---

## 5. Model 3 — Traffic Congestion Regressor

### 5.1 What It Does

Predicts **congestion percentage (0 – 100)** for a given hour / day / road type. The output is converted to a **travel-time multiplier** for ETA estimation:

```
multiplier = 1.0 + (congestion_pct / 100.0) × 2.0
```

| Congestion % | Multiplier | Meaning |
|---|---|---|
| 0% | 1.0× | Free flow |
| 50% | 2.0× | Twice as slow |
| 100% | 3.0× | Gridlock |

### 5.2 Dataset

**Source:** `datasets/new_delhi_traffic_dataset/weekday_stats/` — six CSV files for city and urban roads:

- `2024_week_day_congestion_city.csv` / `..._urban.csv` → congestion %
- `2024_week_day_speed_city.csv` / `..._urban.csv` → speed km/h
- `2024_week_day_time_city.csv` / `..._urban.csv` → travel time

These are **pivoted** CSVs (rows = time slots, columns = days). `data_loader.py` melts them into long format and merges on `(time_slot, day_name)`.

**Data Augmentation:** The raw dataset has only ~182 rows. `train.py → augment_traffic_data()` generates **5,000 synthetic rows** by sampling from existing data + adding Gaussian noise:

```python
noise_cong = rng.normal(0, 3)      # σ=3 for congestion
noise_speed = rng.normal(0, 2)     # σ=2 for speed
```

### 5.3 Feature Vector (6 features)

```python
TRAFFIC_FEATURES = [
    "hour", "day_of_week", "is_weekend", "is_rush_hour",
    "road_type_code", "monthly_avg_congestion",
]
```

### 5.4 Candidate Models

| # | Algorithm | Hyperparameters |
|---|---|---|
| 1 | **RandomForestRegressor** | `n_estimators=200, max_depth=8` |
| 2 | **GradientBoostingRegressor** | `n_estimators=150, max_depth=4, lr=0.1` |
| 3 | **XGBRegressor** *(optional)* | `n_estimators=200, max_depth=5, lr=0.1` |

### 5.5 Small Dataset Fallback

If the dataset has < 20 rows, training bypasses cross-validation entirely and fits a single `RandomForestRegressor(n_estimators=50)` directly.

---

## 6. Genetic Algorithm (GA) — Ambulance Optimisation

### 6.1 What Is a Genetic Algorithm?

A **Genetic Algorithm (GA)** is a **meta-heuristic optimisation** technique inspired by natural selection. Instead of trying every possible solution (brute force), it:

1. Creates a **population** of random candidate solutions
2. **Evaluates** each candidate's quality (fitness)
3. **Selects** the fittest candidates to "reproduce"
4. Creates **offspring** by combining parents (crossover)
5. Introduces **random mutations** for diversity
6. Repeats for multiple **generations** until the solution converges

**Why GA here?** The ambulance assignment problem is a **constrained multi-objective optimisation** — we must simultaneously minimise distance, minimise ETA, match ambulance capability to emergency severity, avoid overloading ambulances, and maintain fleet coverage. GA handles this elegantly in a single fitness function.

### 6.2 GA Configuration (Defaults)

| Parameter | Value | Config Key |
|---|---|---|
| Population Size | 50 | `GA_POPULATION_SIZE` |
| Max Generations | 100 | `GA_MAX_GENERATIONS` |
| Mutation Rate | 0.05 (5%) | `GA_MUTATION_RATE` |
| Crossover Rate | 0.80 (80%) | `GA_CROSSOVER_RATE` |
| Tournament Size | 5 | `GA_TOURNAMENT_SIZE` |
| Elitism Count | 2 | `GA_ELITISM_COUNT` |
| Random Seed | 42 | `RANDOM_SEED` |

All configurable via **environment variables** at runtime.

### 6.3 Chromosome Representation

Each **individual** (candidate solution) is a chromosome of length 1:

```python
chromosome = [ambulance_index]   # e.g., [3] → pick ambulance #3
```

A **population** is a list of 50 such chromosomes:

```python
population = [[7], [2], [5], [3], [0], ...]  # 50 individuals
```

### 6.4 GA Lifecycle — Step by Step

```
Generation 0
┌─────────────────────────────────────────────────────┐
│ 1. INITIALISE: Create 50 random chromosomes         │
│    population = [[rand(0,N-1)] for _ in range(50)]  │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ 2. EVALUATE: Compute fitness for each individual     │
│    for each chromosome → compute_fitness(ambulance)  │
│    Fitness = weighted sum of 5 objectives            │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ 3. TRACK BEST: If gen_best > global_best, update     │
│    Early stop if no improvement for 15 generations   │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ 4. ELITISM: Copy top 2 individuals unchanged         │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│ 5. SELECTION: Tournament select 2 parents            │
│    → Pick 5 random candidates, best fitness wins     │
├──────────────────────────────────────────────────────┤
│ 6. CROSSOVER: Single-point crossover (80% chance)    │
│    → Swap tails of two parents to create 2 children  │
├──────────────────────────────────────────────────────┤
│ 7. MUTATION: Per-gene mutation (5% chance)           │
│    → Replace gene with random ambulance index        │
├──────────────────────────────────────────────────────┤
│ 8. Repeat 5-7 until new population = 50             │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
       Next Generation → Go to step 2
```

### 6.5 Fitness Function — The Heart of the GA

**File:** `app/ga/fitness.py → compute_fitness()`

The fitness function combines **5 objectives** into a single scalar score. Higher is better.

#### Objective Weights

| Weight | Symbol | Value | Objective |
|---|---|---|---|
| `W_DISTANCE` | w₁ | 0.25 | Penalise long distance to patient |
| `W_ETA` | w₂ | **0.30** | Penalise long ETA **(most important)** |
| `W_PRIORITY` | w₃ | 0.20 | Reward matching capability to severity |
| `W_AVAILABILITY` | w₄ | 0.15 | Penalise overloaded ambulances |
| `W_COVERAGE` | w₅ | 0.10 | Reward even fleet distribution |

**Sum of weights = 1.00**

#### Formula

```
Fitness(a) = w₁ · S_dist + w₂ · S_eta + w₃ · S_priority + w₄ · S_avail + w₅ · S_coverage
```

Where each sub-score is computed as:

**Distance Score:**
```
S_dist = max(0, 1 − d/30)
```
- `d` = Haversine distance in km between ambulance and patient
- Normalised against max useful distance of 30 km
- Closer ambulance → higher score (closer to 1.0)

**ETA Score:**
```
S_eta = max(0, 1 − ETA/60)
```
- `ETA` = estimated travel time in minutes (factoring in traffic)
- Normalised against max acceptable ETA of 60 minutes
- Faster response → higher score

**Priority Match Score:**
```
cap_match = max(0, 1 − |priority_weight − capability_level| / 4)
S_priority = cap_match × (1 + hotspot_risk × 0.5)
```
- `priority_weight` = 1 (Low) to 4 (Critical)
- `capability_level` = 1 (basic) to 4 (advanced life support)
- Closer capability match → higher score
- **Hotspot bonus**: High-risk locations get a 0-50% boost for better-equipped units

**Availability Score:**
```
S_avail = max(0, 1 − assignments × 0.3)
```
- `assignments` = how many jobs this ambulance is already handling
- Each existing assignment costs 30% penalty
- Prevents overloading a single ambulance

**Coverage Balance Score:**
```
avg_dist = (1/|F|) × Σ haversine(a, aᵢ)   for all aᵢ ≠ a in fleet F
S_coverage = min(1, avg_dist / 10)
```
- Rewards ambulances that are **far from the cluster** of other units
- Maintains spatial distribution across the city

**Hard Constraint:** Ambulances with status ≠ `"available"` return `fitness = -∞` (instantly disqualified).

### 6.6 Selection — Tournament Selection

**File:** `app/ga/selection.py`

```python
def tournament_select(population, fitness_scores, tournament_size=5):
    candidates = random.sample(range(len(population)), tournament_size)
    best = max(candidates, key=lambda idx: fitness_scores[idx])
    return best
```

- Randomly pick 5 individuals from the population
- Return the one with the highest fitness
- Balances **exploitation** (best candidates win) and **exploration** (random sampling gives weaker candidates a chance)

### 6.7 Crossover — Single-Point Crossover

**File:** `app/ga/crossover.py`

```python
def single_point_crossover(parent_a, parent_b, crossover_rate=0.8):
    if random.random() > crossover_rate or len(parent_a) <= 1:
        return list(parent_a), list(parent_b)  # clone parents
    point = random.randint(1, len(parent_a) - 1)
    child_a = parent_a[:point] + parent_b[point:]
    child_b = parent_b[:point] + parent_a[point:]
    return child_a, child_b
```

- 80% chance of crossover; 20% chance parents are cloned unchanged
- For current chromosome length=1, crossover effectively swaps the entire gene
- A **uniform crossover** variant (`uniform_crossover()`) is also implemented but not actively used (reserved for future multi-assignment support)

### 6.8 Mutation

**File:** `app/ga/mutation.py`

```python
def mutate(chromosome, n_ambulances, mutation_rate=0.05):
    mutated = []
    for gene in chromosome:
        if random.random() < mutation_rate:
            mutated.append(random.randint(0, n_ambulances - 1))
        else:
            mutated.append(gene)
    return mutated
```

- Each gene has a 5% chance of being replaced by a completely random ambulance index
- Prevents the GA from getting stuck in a local optimum
- Low rate preserves good solutions; high enough to maintain diversity

### 6.9 Elitism

The **top 2 individuals** from each generation are copied directly into the next generation without any modification. This guarantees the best solution found so far is **never lost**.

### 6.10 Early Stopping

```python
if generation > convergence_gen + 15:
    break  # no improvement for 15 generations
```

Saves computation when the GA has already converged.

### 6.11 Output

```python
return {
    "best_ambulance_id": "AMB-007",
    "best_ambulance": { ... },
    "estimated_eta_minutes": 8.42,
    "fitness_score": 0.8234,
    "distance_km": 3.451,
    "backup_suggestions": [ ... ],   # top-2 alternatives
    "reason_for_assignment": "Ambulance AMB-007 selected for Critical emergency. ...",
    "ga_metadata": {
        "generations_run": 23,
        "convergence_generation": 22,
        "population_size": 50,
        "max_generations": 100,
        "final_best_fitness": 0.8234,
    },
}
```

---

## 7. Mathematics Reference

### 7.1 Haversine Distance Formula

Computes the **great-circle distance** between two GPS coordinates on a sphere.

```
a = sin²(Δφ/2) + cos(φ₁) · cos(φ₂) · sin²(Δλ/2)
d = 2 · R · arcsin(√a)
```

Where:
- `φ₁, φ₂` = latitudes in radians
- `Δφ` = φ₂ − φ₁
- `Δλ` = λ₂ − λ₁ (longitude difference)
- `R` = 6371 km (Earth's radius)

**Code** (`geo_utils.py`):
```python
def haversine_km(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = sin(d_phi/2)**2 + cos(phi1) * cos(phi2) * sin(d_lambda/2)**2
    return 2 * 6371.0 * asin(sqrt(a))
```

### 7.2 ETA Estimation

```
road_distance = haversine_distance × 1.3       (urban road correction factor)
effective_speed = base_speed / congestion_mult
ETA = (road_distance / effective_speed) × 60    (minutes)
```

- **1.3× factor** accounts for roads being longer than straight-line distance in urban areas
- `base_speed` = 25 km/h (default urban speed)
- `congestion_mult` = 1.0 (no traffic) to 3.0 (gridlock)

### 7.3 StandardScaler Normalisation

Applied to all feature matrices before training/inference:

```
z = (x − μ) / σ
```

Where `μ` = feature mean, `σ` = feature standard deviation (computed from training data).

### 7.4 F1-Score (Macro-Averaged)

Used to evaluate the Priority classifier:

```
F1ₖ = 2 × (Precisionₖ × Recallₖ) / (Precisionₖ + Recallₖ)

F1_macro = (1/K) × Σ F1ₖ    for all K classes
```

Macro averaging treats all classes equally, regardless of support (important when classes are imbalanced).

### 7.5 RMSE (Root Mean Squared Error)

Used to evaluate both regressors:

```
RMSE = √[(1/n) × Σ(yᵢ − ŷᵢ)²]
```

Lower is better. Penalises large errors quadratically.

### 7.6 MAE (Mean Absolute Error)

```
MAE = (1/n) × Σ|yᵢ − ŷᵢ|
```

More robust to outliers than RMSE.

### 7.7 Congestion-to-Multiplier Conversion

```
multiplier = 1.0 + (congestion_pct / 100) × 2.0
```

Linear mapping: 0% → 1.0×, 50% → 2.0×, 100% → 3.0×.

### 7.8 GA Fitness Function (Complete)

```
F(a) = 0.25 · max(0, 1−d/30)
     + 0.30 · max(0, 1−ETA/60)
     + 0.20 · max(0, 1−|w−c|/4) · (1 + r·0.5)
     + 0.15 · max(0, 1−n·0.3)
     + 0.10 · min(1, d̄/10)
```

Where:
- `d` = haversine distance (km)
- `ETA` = estimated travel time (min)
- `w` = priority weight (1-4)
- `c` = ambulance capability level (1-4)
- `r` = hotspot risk score (0-1)
- `n` = current assignment count
- `d̄` = mean distance to rest of fleet (km)

---

## 8. Key Functions — Code Walkthrough

### 8.1 Feature Engineering Pipeline

| Function | File | What It Does |
|---|---|---|
| `normalize_column_names(df)` | `feature_engineering.py` | Lowercases columns, replaces spaces/special chars with underscores |
| `fill_missing(df)` | `feature_engineering.py` | Numeric NaN → column median; Categorical NaN → `"Unknown"` |
| `add_time_features(df)` | `feature_engineering.py` | Extracts `hour`, `day_of_week`, `month`, `is_weekend`, `is_rush_hour`, `time_period` from datetime columns |
| `encode_weather(value)` | `feature_engineering.py` | Maps strings → ordinal: `clear→0, foggy→1, rainy→2, stormy→3` |
| `encode_road_type(value)` | `feature_engineering.py` | Maps: `highway→0, state_hwy→1, urban→2, rural→3` |
| `encode_visibility(value)` | `feature_engineering.py` | Maps: `high→0, medium→1, low→2` |
| `encode_traffic_density(value)` | `feature_engineering.py` | Maps: `low→0, medium→1, high→2` |
| `label_encode_column(series)` | `feature_engineering.py` | Sorted unique values → integer mapping (stored for inference) |

### 8.2 Training Functions

| Function | File | What It Does |
|---|---|---|
| `train_priority_model(X, y, ...)` | `model_trainer.py` | Runs StratifiedKFold CV on RF/GBT/XGB, picks best F1-macro, saves `.joblib` |
| `train_hotspot_model(X, y, ...)` | `model_trainer.py` | Runs KFold CV on RF/GBT/XGB regressors, picks lowest RMSE |
| `train_traffic_model(X, y, ...)` | `model_trainer.py` | Same as hotspot; has fallback for tiny datasets (< 20 rows) |
| `augment_traffic_data(df)` | `train.py` | Generates 5,000 synthetic rows by adding Gaussian noise to existing data |

### 8.3 Inference Functions

| Function | File | Returns |
|---|---|---|
| `predict_priority(data)` | `priority_service.py` | `priority_class`, `confidence`, `label_probabilities` |
| `predict_hotspot(data)` | `hotspot_service.py` | `risk_score` (0-1), `risk_category` |
| `predict_traffic(data)` | `traffic_service.py` | `congestion_pct`, `congestion_multiplier`, `traffic_level` |
| `optimize_ambulance(...)` | `ga_service.py` | `best_ambulance_id`, `fitness_score`, `eta`, `backups` |

### 8.4 GA Functions

| Function | File | What It Does |
|---|---|---|
| `run_ga(...)` | `genetic_algorithm.py` | Complete GA loop: init → evaluate → select → crossover → mutate → elitism → extract best |
| `compute_fitness(...)` | `fitness.py` | Multi-objective fitness evaluation (5 weighted sub-scores) |
| `tournament_select(...)` | `selection.py` | Tournament selection (pick 5, return best) |
| `single_point_crossover(...)` | `crossover.py` | Swap tails of two parent chromosomes at a random point |
| `mutate(...)` | `mutation.py` | Per-gene random replacement with probability 5% |

### 8.5 Utility Functions

| Function | File | What It Does |
|---|---|---|
| `haversine_km(lat1, lon1, lat2, lon2)` | `geo_utils.py` | Great-circle distance between two GPS points |
| `eta_minutes(dist, speed, multiplier)` | `geo_utils.py` | Travel time estimation with traffic correction |
| `congestion_to_multiplier(pct)` | `geo_utils.py` | Linear mapping: congestion % → delay factor |
| `safe_float(value)` | `helpers.py` | Robust string → float parser with fallback |
| `extract_numeric(text)` | `helpers.py` | Extracts first numeric value from strings like `"25 km/h"` |
| `is_rush_hour(hour, is_weekend)` | `helpers.py` | Returns True if hour is in 7-10 or 17-21 on weekdays |

---

## 9. Model Comparison & Selection Strategy

### 9.1 Why These Algorithms?

| Algorithm | Strengths | Weaknesses | Why We Use It |
|---|---|---|---|
| **Random Forest** | Robust to noise, handles mixed feature types, parallelisable, no feature scaling needed | Can overfit on small datasets, less interpretable than a single tree | Baseline — strong default for tabular data |
| **Gradient Boosting** | Higher accuracy via sequential error correction, good bias-variance tradeoff | Slower training, sensitive to hyperparameters, no native parallelism | Accuracy boost — often beats RF on structured data |
| **XGBoost** | Regularisation (L1/L2), built-in handling of missing values, parallelised, state-of-art competition winner | External dependency, marginal gains on small datasets | Optional upgrade — best performance when available |

### 9.2 AutoML-Style Selection

We don't hardcode a single model. Instead, we **compete all candidates** on equal terms:

```python
for name, model in candidates:
    scores = cross_val_score(model, X_train, y_train, cv=cv, scoring=metric)
    if scores.mean() > best_score:
        best_model = model
```

This ensures the best model is always selected for the specific dataset at hand.

---

## 10. Accuracy & Evaluation Metrics

### 10.1 Priority Model (Classification)

| Metric | What It Measures |
|---|---|
| **Accuracy** | % of correct predictions overall |
| **F1-macro** | Harmonic mean of precision & recall, averaged across all classes equally |
| **Precision-macro** | Of all predictions for class K, how many were correct? (averaged) |
| **Recall-macro** | Of all actual class K instances, how many did we find? (averaged) |

The training report is saved to `artifacts/reports/priority_model_report.json` with full CV scores + per-class classification report.

### 10.2 Hotspot & Traffic Models (Regression)

| Metric | What It Measures |
|---|---|
| **RMSE** | Root mean squared error — penalises large errors |
| **MAE** | Mean absolute error — more robust to outliers |

Reports saved to `artifacts/reports/hotspot_model_report.json` and `traffic_model_report.json`.

### 10.3 GA Fitness Metrics

The GA doesn't have "accuracy" in the ML sense. Instead:

| Metric | Meaning |
|---|---|
| `fitness_score` | Composite 0-1 score — higher is better |
| `generations_run` | How many generations until convergence |
| `convergence_generation` | The generation where the best solution was found |

---

## 11. What Is NOT Used and Why

| Technology / Model | Why NOT Used |
|---|---|
| **Deep Learning (Neural Nets)** | Dataset is tabular + relatively small (~5K rows). Ensemble tree models consistently outperform NNs on tabular data. Transformers/CNNs are for images/text/sequences. |
| **K-Nearest Neighbours (KNN)** | Slow inference (O(n) per prediction), poor with high-dimensional features, no model persistence. |
| **Support Vector Machines (SVM)** | Doesn't scale well to 5000+ rows, doesn't output calibrated probabilities natively. |
| **Linear Regression / Logistic Regression** | Too simple — can't capture non-linear interactions between features (weather × time × road type). |
| **Naive Bayes** | Assumes feature independence — violated by our correlated features (e.g., rush_hour + congestion). |
| **Deep Reinforcement Learning** | Overkill for single-assignment dispatch; requires simulation environment; GA is faster and more interpretable. |
| **Simulated Annealing / Particle Swarm** | GA with elitism is more natural for discrete combinatorial optimisation (picking 1 of N ambulances). |
| **Linear Programming / Integer Programming** | Requires convex/linear objective; our fitness function is non-linear and non-convex. |
| **TensorFlow / PyTorch** | Unnecessary dependency for gradient-boosted tree models. scikit-learn is lighter, faster, and sufficient. |
| **Uniform Crossover (in GA)** | Implemented (`crossover.py`) but not used in production — reserved for future multi-ambulance assignment where chromosome length > 1. |

---

## 12. File Map

```
ai-ml/
├── train.py                          # Training entry point — runs all 3 models
├── app/
│   ├── main.py                       # FastAPI app — lifespan loads models
│   ├── core/
│   │   ├── config.py                 # All settings (paths, GA params, ML params)
│   │   ├── constants.py              # Domain constants (priority labels, risk bins)
│   │   └── logging.py                # Structured logging setup
│   ├── ga/                           # 🧬 Genetic Algorithm engine
│   │   ├── genetic_algorithm.py      # run_ga() — main GA loop
│   │   ├── fitness.py                # compute_fitness() — multi-objective scoring
│   │   ├── selection.py              # tournament_select()
│   │   ├── crossover.py              # single_point_crossover(), uniform_crossover()
│   │   └── mutation.py               # mutate()
│   ├── routes/                       # FastAPI endpoint definitions
│   │   ├── predict_priority.py       # POST /predict-priority
│   │   ├── predict_hotspot.py        # POST /predict-hotspot
│   │   ├── predict_traffic.py        # POST /predict-traffic
│   │   ├── optimize_ambulance.py     # POST /optimize-ambulance
│   │   └── health.py                 # GET /health
│   ├── schemas/                      # Pydantic request/response models
│   │   ├── priority_schema.py
│   │   ├── hotspot_schema.py
│   │   ├── traffic_schema.py
│   │   └── optimization_schema.py
│   ├── services/                     # Business logic layer
│   │   ├── data_loader.py            # CSV/JSON parsing for all datasets
│   │   ├── preprocessing.py          # Feature engineering for all 3 models
│   │   ├── model_trainer.py          # CV model selection + training
│   │   ├── model_loader.py           # Singleton model loading on startup
│   │   ├── priority_service.py       # Priority inference
│   │   ├── hotspot_service.py        # Hotspot inference
│   │   ├── traffic_service.py        # Traffic inference
│   │   └── ga_service.py             # GA orchestration (input validation + run_ga)
│   └── utils/                        # Shared utilities
│       ├── feature_engineering.py     # Encoding, normalisation, time features
│       ├── geo_utils.py              # Haversine, ETA, congestion conversion
│       ├── helpers.py                # safe_float, extract_numeric, is_rush_hour
│       └── metrics.py                # classification_metrics, regression_metrics
├── datasets/
│   ├── Emergency Priority Prediction (Model 1).csv
│   ├── Emergency Hotspot Prediction (Model 2).csv
│   └── new_delhi_traffic_dataset/    # Weekday stats + global metrics
├── artifacts/
│   ├── models/                       # Trained .joblib model files
│   ├── encoders/                     # Label encoder mappings
│   ├── scalers/                      # StandardScaler objects
│   └── reports/                      # Training reports (JSON)
└── tests/
    └── test_ga.py                    # GA unit tests
```

---

> **Last updated:** June 2026 • Generated from source code analysis of the `ai-ml/` codebase
