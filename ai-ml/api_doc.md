# AI Ambulance Allocation Service — API Reference

**Base URL (local):** `http://localhost:8000`  
**Base URL (Render):** `https://ai-ambulance-service.onrender.com` *(replace with your actual Render URL)*  
**Format:** All endpoints accept and return `application/json`  
**Auth:** None required (add Bearer token middleware for production hardening)

---

## Endpoints at a Glance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service liveness + model status |
| `POST` | `/predict-priority` | Classify emergency severity (Low → Critical) |
| `POST` | `/predict-hotspot` | Predict location risk score (0–1) |
| `POST` | `/predict-traffic` | Estimate traffic congestion & ETA multiplier |
| `POST` | `/optimize-ambulance` | GA-based ambulance dispatch optimisation |

---

## GET /health

Returns service liveness and status of all three loaded ML models.

### Response

```json
{
  "status": "healthy",
  "service": "AI Ambulance Allocation Service",
  "version": "1.0.0",
  "environment": "production",
  "models": {
    "priority_model": "loaded",
    "hotspot_model": "loaded",
    "traffic_model": "loaded"
  }
}
```

### curl

```bash
curl https://ai-ambulance-service.onrender.com/health
```

---

## POST /predict-priority

Classifies an emergency incident into one of four priority levels using a trained GradientBoosting classifier.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `emergency_type` | string | No | `"accident"`, `"cardiac"`, `"fire"`, etc. |
| `weather` | string | Yes | `"clear"`, `"foggy"`, `"rainy"`, `"stormy"`, `"hazy"` |
| `road_condition` | string | Yes | `"dry"`, `"wet"`, `"damaged"`, `"under construction"` |
| `road_type` | string | Yes | `"national highway"`, `"state highway"`, `"urban road"`, `"village road"` |
| `lighting` | string | No | `"daylight"`, `"dawn"`, `"dusk"`, `"dark"` |
| `traffic_control` | string | No | `"none"`, `"signs"`, `"signals"`, `"police checkpost"` |
| `vehicle_type` | string | No | `"Car"`, `"Truck"`, `"Two-Wheeler"`, `"Bus"`, `"Pedestrian"` |
| `location_type` | string | No | `"Intersection"`, `"Curve"`, `"Straight Road"`, `"Bridge"` |
| `hour` | int | Yes | 0–23 (24-hour clock) |
| `day_of_week` | int | Yes | 0=Monday … 6=Sunday |
| `month` | int | Yes | 1–12 |
| `num_vehicles` | int | Yes | Number of vehicles involved |
| `num_casualties` | int | Yes | Number of injured persons |
| `num_fatalities` | int | Yes | Number of deaths |
| `speed_limit` | int | Yes | Speed limit in km/h |
| `driver_age` | int | No | Driver age in years |
| `driver_gender` | string | No | `"Male"` / `"Female"` |
| `license_status` | string | No | `"valid"`, `"expired"`, `"none"` |
| `alcohol_involvement` | string | No | `"Yes"` / `"No"` |
| `state` | string | No | Indian state name |
| `city` | string | No | City name |

### Response

```json
{
  "priority_class": "Critical",
  "confidence": 0.608,
  "label_probabilities": {
    "Critical": 0.608,
    "High": 0.182,
    "Low": 0.210
  },
  "metadata": {
    "model": "GradientBoostingClassifier",
    "features_used": ["hour", "day_of_week", "month", "weather_code", "..."]
  }
}
```

| Field | Description |
|-------|-------------|
| `priority_class` | `Low` / `Medium` / `High` / `Critical` |
| `confidence` | Probability of the top class (0–1) |
| `label_probabilities` | Per-class probabilities |

### Test Scenarios

**Scenario A — Critical: Delhi night crash with alcohol**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-priority \
  -H "Content-Type: application/json" \
  -d '{
    "weather": "foggy",
    "road_condition": "wet",
    "road_type": "national highway",
    "lighting": "dark",
    "traffic_control": "none",
    "vehicle_type": "Truck",
    "location_type": "Intersection",
    "hour": 23,
    "day_of_week": 4,
    "month": 11,
    "num_vehicles": 4,
    "num_casualties": 7,
    "num_fatalities": 2,
    "speed_limit": 80,
    "driver_age": 38,
    "driver_gender": "Male",
    "license_status": "valid",
    "alcohol_involvement": "Yes",
    "state": "Delhi",
    "city": "Delhi"
  }'
```
**Expected:** `priority_class: "High"` or `"Critical"`

**Scenario B — Low: Clear day minor fender bender**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-priority \
  -H "Content-Type: application/json" \
  -d '{
    "weather": "clear",
    "road_condition": "dry",
    "road_type": "urban road",
    "lighting": "daylight",
    "traffic_control": "signals",
    "vehicle_type": "Car",
    "hour": 11,
    "day_of_week": 2,
    "month": 3,
    "num_vehicles": 2,
    "num_casualties": 0,
    "num_fatalities": 0,
    "speed_limit": 40,
    "alcohol_involvement": "No",
    "state": "West Bengal",
    "city": "Kolkata"
  }'
```
**Expected:** `priority_class: "Low"` or `"Medium"`

**Scenario C — Kolkata rush hour crash**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-priority \
  -H "Content-Type: application/json" \
  -d '{
    "weather": "rainy",
    "road_condition": "wet",
    "road_type": "national highway",
    "lighting": "daylight",
    "traffic_control": "signals",
    "vehicle_type": "Car",
    "location_type": "Straight Road",
    "hour": 9,
    "day_of_week": 1,
    "month": 7,
    "num_vehicles": 4,
    "num_casualties": 4,
    "num_fatalities": 0,
    "speed_limit": 80,
    "driver_age": 28,
    "alcohol_involvement": "No",
    "state": "West Bengal",
    "city": "Kolkata"
  }'
```
**Expected:** `priority_class: "Critical"` or `"High"`

---

## POST /predict-hotspot

Predicts a continuous risk score (0–1) for a given GPS location and conditions using a GradientBoosting regressor.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | string | Yes | City name |
| `state` | string | Yes | State name |
| `latitude` | float | Yes | Patient/incident latitude |
| `longitude` | float | Yes | Patient/incident longitude |
| `hour` | int | Yes | 0–23 |
| `day_of_week` | int | Yes | 0=Mon … 6=Sun |
| `month` | int | Yes | 1–12 |
| `weather` | string | Yes | `"clear"`, `"foggy"`, `"rainy"`, etc. |
| `road_type` | string | Yes | `"highway"`, `"urban"`, `"state highway"` |
| `visibility` | string | Yes | `"high"`, `"medium"`, `"low"` |
| `traffic_density` | string | Yes | `"low"`, `"medium"`, `"high"` |
| `traffic_signal` | int | No | 1=signal present, 0=absent |
| `lanes` | int | No | Number of lanes |
| `temperature` | float | No | Temperature in °C |
| `vehicles_involved` | int | No | Number of vehicles |
| `casualties` | int | No | Casualties count |
| `is_peak_hour` | int | No | 1=peak, 0=off-peak |
| `festival` | string | No | `"None"`, `"Diwali"`, `"Eid"`, etc. |
| `cause` | string | No | `"overspeeding"`, `"weather"`, `"drunk_driving"` |

### Response

```json
{
  "risk_score": 0.757,
  "risk_category": "High",
  "metadata": {
    "model": "GradientBoostingRegressor",
    "features_used": ["hour", "latitude", "longitude", "..."]
  }
}
```

| `risk_score` | `risk_category` |
|-------------|----------------|
| 0.00 – 0.30 | Very Low |
| 0.30 – 0.50 | Low |
| 0.50 – 0.70 | Medium |
| 0.70 – 0.85 | High |
| 0.85 – 1.00 | Critical |

### Test Scenarios

**Scenario A — Kolkata Howrah Bridge, foggy night**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-hotspot \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Kolkata",
    "state": "West Bengal",
    "latitude": 22.5851,
    "longitude": 88.3468,
    "hour": 2,
    "day_of_week": 5,
    "month": 12,
    "weather": "foggy",
    "road_type": "highway",
    "visibility": "low",
    "traffic_density": "low",
    "traffic_signal": 0,
    "lanes": 4,
    "temperature": 17,
    "vehicles_involved": 3,
    "casualties": 6,
    "is_peak_hour": 0,
    "festival": "None",
    "cause": "drunk_driving"
  }'
```
**Expected:** `risk_score` ≥ 0.5, `risk_category: "Medium"` or higher

**Scenario B — Mumbai rush hour, rainy, high density**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-hotspot \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Mumbai",
    "state": "Maharashtra",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "hour": 9,
    "day_of_week": 1,
    "month": 6,
    "weather": "rainy",
    "road_type": "urban",
    "visibility": "medium",
    "traffic_density": "high",
    "traffic_signal": 1,
    "lanes": 4,
    "temperature": 29,
    "vehicles_involved": 2,
    "casualties": 3,
    "is_peak_hour": 1,
    "festival": "None",
    "cause": "weather"
  }'
```
**Expected:** `risk_score` ≥ 0.65, `risk_category: "High"`

---

## POST /predict-traffic

Estimates current traffic congestion percentage and the resulting ETA multiplier using a RandomForest regressor trained on Delhi traffic patterns.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hour` | int | Yes | 0–23 |
| `day_of_week` | int | Yes | 0=Mon … 6=Sun |
| `is_weekend` | int | Yes | 1=weekend, 0=weekday |
| `road_type` | string | Yes | `"urban"`, `"highway"`, `"state highway"` |
| `monthly_avg_congestion` | float | Yes | Historical average congestion % for the area |

### Response

```json
{
  "congestion_pct": 57.9,
  "congestion_multiplier": 2.159,
  "traffic_level": "Heavy",
  "metadata": {
    "model": "RandomForestRegressor",
    "features_used": ["hour", "day_of_week", "is_weekend", "is_rush_hour", "road_type_code", "monthly_avg_congestion"]
  }
}
```

| `congestion_pct` | `traffic_level` | `congestion_multiplier` |
|-----------------|----------------|------------------------|
| 0 – 10% | Free Flow | ~1.0× |
| 10 – 25% | Light | ~1.2× |
| 25 – 40% | Moderate | ~1.5× |
| 40 – 60% | Heavy | ~2.0× |
| 60 – 100% | Gridlock | ~2.8× |

### Test Scenarios

**Scenario A — Delhi weekday morning rush**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-traffic \
  -H "Content-Type: application/json" \
  -d '{
    "hour": 9,
    "day_of_week": 1,
    "is_weekend": 0,
    "road_type": "urban",
    "monthly_avg_congestion": 55.0
  }'
```
**Expected:** `traffic_level: "Heavy"` or `"Gridlock"`, multiplier > 1.8

**Scenario B — Kolkata midnight (low traffic)**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/predict-traffic \
  -H "Content-Type: application/json" \
  -d '{
    "hour": 2,
    "day_of_week": 5,
    "is_weekend": 1,
    "road_type": "urban",
    "monthly_avg_congestion": 18.0
  }'
```
**Expected:** `traffic_level: "Free Flow"` or `"Light"`, multiplier < 1.3

---

## POST /optimize-ambulance

Runs a custom Genetic Algorithm (built from scratch) to select the optimal ambulance from a live fleet, factoring in distance, ETA, traffic, priority, location risk, and capability level.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_lat` | float | Yes | Patient GPS latitude |
| `patient_lon` | float | Yes | Patient GPS longitude |
| `emergency_type` | string | No | `"accident"`, `"cardiac"`, etc. |
| `priority_class` | string | Yes | `"Low"` / `"Medium"` / `"High"` / `"Critical"` |
| `hotspot_risk` | float | Yes | Risk score from `/predict-hotspot` (0–1) |
| `congestion_multiplier` | float | Yes | Multiplier from `/predict-traffic` |
| `ambulances` | array | Yes | Array of ambulance objects (see below) |
| `population_size` | int | No | GA population size (default: 50) |
| `max_generations` | int | No | GA generation limit (default: 100) |

**Ambulance object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ambulance identifier |
| `latitude` | float | Yes | Current ambulance latitude |
| `longitude` | float | Yes | Current ambulance longitude |
| `status` | string | Yes | `"available"` / `"busy"` / `"offline"` |
| `capability_level` | int | Yes | 1=BLS, 2=ALS basic, 3=ALS advanced, 4=MICU |

### Response

```json
{
  "best_ambulance_id": "KOL-MICU-01",
  "best_ambulance": {
    "id": "KOL-MICU-01",
    "latitude": 22.5726,
    "longitude": 88.3639,
    "status": "available",
    "capability_level": 4
  },
  "estimated_eta_minutes": 7.2,
  "fitness_score": 0.9353,
  "distance_km": 1.823,
  "backup_suggestions": [
    {
      "ambulance_id": "KOL-ALS-02",
      "fitness": 0.8821,
      "eta_minutes": 9.4
    }
  ],
  "reason_for_assignment": "Ambulance KOL-MICU-01 selected for Critical emergency. Distance: 1.82 km, ETA: 7.2 min, Capability level: 4, Fitness: 0.935.",
  "ga_metadata": {
    "generations_run": 1,
    "convergence_generation": 0,
    "population_size": 50,
    "max_generations": 100,
    "final_best_fitness": 0.9353
  }
}
```

### GA Fitness Function

The GA optimises a multi-objective fitness score:

| Objective | Weight | Optimisation |
|-----------|--------|--------------|
| Distance to patient | 25% | Minimise |
| Estimated ETA (with traffic) | 30% | Minimise |
| Capability–priority match | 20% | Maximise |
| Ambulance load balancing | 15% | Maximise |
| Fleet coverage | 10% | Maximise |

**GA Parameters:** Population=50, Max generations=100, Tournament selection k=5, Crossover rate=0.8, Mutation rate=0.05, Elitism=top 2, Early stop if no improvement for 15 generations.

### Test Scenarios

**Scenario A — Kolkata Howrah Bridge, Critical, foggy night**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/optimize-ambulance \
  -H "Content-Type: application/json" \
  -d '{
    "patient_lat": 22.5851,
    "patient_lon": 88.3468,
    "priority_class": "Critical",
    "hotspot_risk": 0.72,
    "congestion_multiplier": 1.15,
    "ambulances": [
      {"id": "KOL-MICU-01", "latitude": 22.5726, "longitude": 88.3639, "status": "available", "capability_level": 4},
      {"id": "KOL-ALS-02",  "latitude": 22.5800, "longitude": 88.3500, "status": "available", "capability_level": 3},
      {"id": "KOL-BLS-03",  "latitude": 22.5550, "longitude": 88.3700, "status": "available", "capability_level": 2},
      {"id": "KOL-MICU-04", "latitude": 22.5650, "longitude": 88.3750, "status": "available", "capability_level": 4},
      {"id": "KOL-ALS-05",  "latitude": 22.5900, "longitude": 88.3400, "status": "busy",      "capability_level": 3}
    ],
    "population_size": 50,
    "max_generations": 100
  }'
```
**Expected:** `best_ambulance_id` = one of the `KOL-MICU-*` units (capability 4), never `KOL-ALS-05` (busy)

**Scenario B — Mumbai, Critical, peak hour heavy traffic**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/optimize-ambulance \
  -H "Content-Type: application/json" \
  -d '{
    "patient_lat": 19.0760,
    "patient_lon": 72.8777,
    "priority_class": "Critical",
    "hotspot_risk": 0.85,
    "congestion_multiplier": 2.5,
    "ambulances": [
      {"id": "MH-MICU-01", "latitude": 19.083, "longitude": 72.870, "status": "available", "capability_level": 4},
      {"id": "MH-ALS-02",  "latitude": 19.065, "longitude": 72.885, "status": "available", "capability_level": 3},
      {"id": "MH-BLS-03",  "latitude": 19.070, "longitude": 72.880, "status": "offline",   "capability_level": 1},
      {"id": "MH-MICU-04", "latitude": 19.080, "longitude": 72.875, "status": "available", "capability_level": 4}
    ]
  }'
```
**Expected:** L4 MICU selected, `MH-BLS-03` never selected (offline)

**Scenario C — No available ambulances (graceful handling)**
```bash
curl -X POST https://ai-ambulance-service.onrender.com/optimize-ambulance \
  -H "Content-Type: application/json" \
  -d '{
    "patient_lat": 28.6139,
    "patient_lon": 77.2090,
    "priority_class": "High",
    "hotspot_risk": 0.5,
    "congestion_multiplier": 1.5,
    "ambulances": [
      {"id": "DL-01", "latitude": 28.62, "longitude": 77.21, "status": "busy",    "capability_level": 3},
      {"id": "DL-02", "latitude": 28.64, "longitude": 77.20, "status": "offline", "capability_level": 2}
    ]
  }'
```
**Expected:** `best_ambulance_id: null`, `reason_for_assignment: "No available ambulances in the fleet."`

---

## Full End-to-End Pipeline (Recommended Usage)

Call all four APIs in sequence for a complete dispatch decision:

```bash
# Step 1 — Classify the emergency
PRIORITY=$(curl -s -X POST .../predict-priority -H "Content-Type: application/json" \
  -d '{"weather":"rainy","road_condition":"wet","road_type":"urban road","hour":9,"day_of_week":1,"month":7,"num_vehicles":3,"num_casualties":4,"num_fatalities":0,"speed_limit":60,"alcohol_involvement":"No","state":"West Bengal","city":"Kolkata"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['priority_class'])")

# Step 2 — Estimate location risk
RISK=$(curl -s -X POST .../predict-hotspot -H "Content-Type: application/json" \
  -d '{"city":"Kolkata","state":"West Bengal","latitude":22.5355,"longitude":88.3953,"hour":9,"day_of_week":1,"month":7,"weather":"rainy","road_type":"highway","visibility":"medium","traffic_density":"high","traffic_signal":1,"lanes":6,"temperature":31,"vehicles_involved":3,"casualties":4,"is_peak_hour":1,"festival":"None","cause":"weather"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['risk_score'])")

# Step 3 — Get traffic multiplier
MULT=$(curl -s -X POST .../predict-traffic -H "Content-Type: application/json" \
  -d '{"hour":9,"day_of_week":1,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":62}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['congestion_multiplier'])")

# Step 4 — Dispatch the best ambulance
curl -X POST .../optimize-ambulance -H "Content-Type: application/json" \
  -d "{
    \"patient_lat\": 22.5355,
    \"patient_lon\": 88.3953,
    \"priority_class\": \"$PRIORITY\",
    \"hotspot_risk\": $RISK,
    \"congestion_multiplier\": $MULT,
    \"ambulances\": [
      {\"id\":\"KOL-MICU-01\",\"latitude\":22.5726,\"longitude\":88.3639,\"status\":\"available\",\"capability_level\":4},
      {\"id\":\"KOL-ALS-02\", \"latitude\":22.5800,\"longitude\":88.3500,\"status\":\"available\",\"capability_level\":3},
      {\"id\":\"KOL-MICU-04\",\"latitude\":22.5650,\"longitude\":88.3750,\"status\":\"available\",\"capability_level\":4}
    ]
  }"
```

---

## Error Responses

| Status | Meaning | Example cause |
|--------|---------|--------------|
| `422 Unprocessable Entity` | Validation error | Missing required field, wrong type |
| `500 Internal Server Error` | Model not loaded | Run `python train.py` first |
| `503 Service Unavailable` | Server starting up | Wait for health check to pass |

**422 Example:**
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "hour"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

---

## Interactive Docs

When the server is running, Swagger UI and ReDoc are available:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

On Render (replace with your URL):
- `https://ai-ambulance-service.onrender.com/docs`
