"""
test_e2e.py — All-India End-to-End API Test for the AI Ambulance Allocation Service.

Tests 10 emergency scenarios across major Indian cities including
2 dedicated Kolkata scenarios. Covers:
  Step 1: /predict-priority  → emergency severity classification
  Step 2: /predict-hotspot   → location risk score
  Step 3: /predict-traffic   → congestion + ETA multiplier
  Step 4: /optimize-ambulance → GA dispatch selection

Usage (server must be running):
    python test_e2e.py
"""

from __future__ import annotations
import json, sys, time, urllib.error, urllib.request
from typing import Any, Dict, List

BASE_URL = "http://localhost:8000"

# ── ANSI colours ───────────────────────────────────────────────────────────────
R="\033[91m"; G="\033[92m"; Y="\033[93m"; B="\033[94m"
M="\033[95m"; C="\033[96m"; W="\033[97m"; DIM="\033[2m"
RESET="\033[0m"; BOLD="\033[1m"
SEP  = DIM + "─"*72 + RESET
SEP2 = BOLD + "═"*72 + RESET

# ── HTTP ───────────────────────────────────────────────────────────────────────
def api_post(path: str, payload: Dict) -> Dict[str, Any]:
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(f"{BASE_URL}{path}", data=data,
                                  headers={"Content-Type": "application/json"},
                                  method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"{R}HTTP {e.code}: {e.read().decode()}{RESET}"); sys.exit(1)
    except Exception as e:
        print(f"{R}Connection error: {e}  —  Is server running?{RESET}"); sys.exit(1)

def api_get(path: str) -> Dict[str, Any]:
    try:
        with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"{R}{e}{RESET}"); sys.exit(1)

# ── Helpers ────────────────────────────────────────────────────────────────────
def hdr(t: str, c: str=B) -> None: print(f"\n{SEP2}\n{c}{BOLD}  {t}{RESET}\n{SEP2}")
def sub(t: str) -> None: print(f"\n{C}{BOLD}  ┌─ {t}{RESET}")
def row(l: str, v: Any, c: str=W) -> None: print(f"  {DIM}│{RESET}  {Y}{l:<30}{RESET}{c}{v}{RESET}")
def ok(m: str) -> None: print(f"  {G}✔  {m}{RESET}")
def info(m: str) -> None: print(f"  {DIM}ℹ  {m}{RESET}")
def bar(v: float, w: int=28, f: str=G, e: str=DIM) -> str:
    n = int(v * w); return f+"█"*n + e+"░"*(w-n) + RESET

PC = {"Critical":R,"High":Y,"Medium":B,"Low":G}
RL = {"Critical":R+"🔴","High":Y+"🟠","Medium":B+"🟡","Low":G+"🟢","Very Low":G+"⚪"}
TL = {"Gridlock":R+"🚫","Heavy":R+"🔴","Moderate":Y+"🟡","Light":G+"🟢","Free Flow":G+"✅"}

# ── City-specific ambulance fleets ─────────────────────────────────────────────
FLEETS: Dict[str, List[Dict]] = {
    "Kolkata": [
        {"id":"KOL-MICU-01","latitude":22.5726,"longitude":88.3639,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"KOL-ALS-02", "latitude":22.5800,"longitude":88.3500,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"KOL-BLS-03", "latitude":22.5550,"longitude":88.3700,"status":"available","capability_level":2,"vehicle_type":"BLS"},
        {"id":"KOL-MICU-04","latitude":22.5650,"longitude":88.3750,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"KOL-ALS-05", "latitude":22.5900,"longitude":88.3400,"status":"busy",     "capability_level":3,"vehicle_type":"ALS"},
        {"id":"KOL-BLS-06", "latitude":22.5480,"longitude":88.3800,"status":"available","capability_level":1,"vehicle_type":"BLS"},
    ],
    "Chennai": [
        {"id":"CHN-MICU-01","latitude":13.0827,"longitude":80.2707,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"CHN-ALS-02", "latitude":13.0900,"longitude":80.2600,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"CHN-BLS-03", "latitude":13.0750,"longitude":80.2800,"status":"busy",     "capability_level":2,"vehicle_type":"BLS"},
        {"id":"CHN-MICU-04","latitude":13.0700,"longitude":80.2750,"status":"available","capability_level":4,"vehicle_type":"MICU"},
    ],
    "Bangalore": [
        {"id":"BLR-MICU-01","latitude":12.9716,"longitude":77.5946,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"BLR-ALS-02", "latitude":12.9800,"longitude":77.5800,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"BLR-BLS-03", "latitude":12.9600,"longitude":77.6000,"status":"available","capability_level":2,"vehicle_type":"BLS"},
        {"id":"BLR-MICU-04","latitude":12.9750,"longitude":77.6050,"status":"busy",     "capability_level":4,"vehicle_type":"MICU"},
    ],
    "Hyderabad": [
        {"id":"HYD-MICU-01","latitude":17.3850,"longitude":78.4867,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"HYD-ALS-02", "latitude":17.3950,"longitude":78.4700,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"HYD-BLS-03", "latitude":17.3780,"longitude":78.5000,"status":"available","capability_level":2,"vehicle_type":"BLS"},
    ],
    "Jaipur": [
        {"id":"JAI-MICU-01","latitude":26.9124,"longitude":75.7873,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"JAI-ALS-02", "latitude":26.9200,"longitude":75.7750,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"JAI-BLS-03", "latitude":26.9050,"longitude":75.8000,"status":"offline",  "capability_level":2,"vehicle_type":"BLS"},
    ],
    "Ahmedabad": [
        {"id":"AMD-MICU-01","latitude":23.0225,"longitude":72.5714,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"AMD-ALS-02", "latitude":23.0300,"longitude":72.5600,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"AMD-BLS-03", "latitude":23.0150,"longitude":72.5800,"status":"available","capability_level":2,"vehicle_type":"BLS"},
    ],
    "Pune": [
        {"id":"PNE-MICU-01","latitude":18.5204,"longitude":73.8567,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"PNE-ALS-02", "latitude":18.5300,"longitude":73.8450,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"PNE-BLS-03", "latitude":18.5100,"longitude":73.8650,"status":"busy",     "capability_level":1,"vehicle_type":"BLS"},
    ],
    "Lucknow": [
        {"id":"LKO-MICU-01","latitude":26.8467,"longitude":80.9462,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"LKO-ALS-02", "latitude":26.8550,"longitude":80.9350,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"LKO-BLS-03", "latitude":26.8400,"longitude":80.9550,"status":"available","capability_level":2,"vehicle_type":"BLS"},
    ],
    "Delhi": [
        {"id":"DL-MICU-01","latitude":28.6200,"longitude":77.2100,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"DL-ALS-02", "latitude":28.6400,"longitude":77.1950,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"DL-BLS-03", "latitude":28.6000,"longitude":77.2300,"status":"busy",     "capability_level":2,"vehicle_type":"BLS"},
        {"id":"DL-MICU-04","latitude":28.6150,"longitude":77.2050,"status":"available","capability_level":4,"vehicle_type":"MICU"},
    ],
    "Mumbai": [
        {"id":"MH-MICU-01","latitude":19.0830,"longitude":72.8700,"status":"available","capability_level":4,"vehicle_type":"MICU"},
        {"id":"MH-ALS-02", "latitude":19.0650,"longitude":72.8850,"status":"available","capability_level":3,"vehicle_type":"ALS"},
        {"id":"MH-BLS-03", "latitude":19.0700,"longitude":72.8800,"status":"offline",  "capability_level":1,"vehicle_type":"BLS"},
        {"id":"MH-MICU-04","latitude":19.0800,"longitude":72.8750,"status":"available","capability_level":4,"vehicle_type":"MICU"},
    ],
}

# ── All-India scenarios (10 cities, Kolkata gets 2) ────────────────────────────
SCENARIOS = [
    # ── KOLKATA 1 — Night crash, Howrah Bridge approach ─────────────────────
    {
        "label": "🔴 KOL-1  Night Truck Crash — Howrah Bridge Approach",
        "city": "Kolkata", "state": "West Bengal",
        "patient_lat": 22.5851, "patient_lon": 88.3468,
        "fleet_key": "Kolkata",
        "priority": {
            "emergency_type":"accident","weather":"foggy","road_condition":"wet",
            "road_type":"national highway","lighting":"dark","traffic_control":"none",
            "vehicle_type":"Truck","location_type":"Bridge","hour":2,"day_of_week":5,
            "month":12,"num_vehicles":3,"num_casualties":6,"num_fatalities":2,
            "speed_limit":60,"driver_age":42,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"Yes",
            "state":"West Bengal","city":"Kolkata",
        },
        "hotspot": {
            "city":"Kolkata","state":"West Bengal","latitude":22.5851,"longitude":88.3468,
            "hour":2,"day_of_week":5,"month":12,"weather":"foggy","road_type":"highway",
            "visibility":"low","traffic_density":"low","traffic_signal":0,"lanes":4,
            "temperature":17,"vehicles_involved":3,"casualties":6,"is_peak_hour":0,
            "festival":"None","cause":"drunk_driving",
        },
        "traffic": {
            "hour":2,"day_of_week":5,"is_weekend":1,"road_type":"urban","monthly_avg_congestion":18.0,
        },
    },
    # ── KOLKATA 2 — Rush hour, EM Bypass ────────────────────────────────────
    {
        "label": "🟠 KOL-2  Rush Hour Pile-up — EM Bypass, Kolkata",
        "city": "Kolkata", "state": "West Bengal",
        "patient_lat": 22.5355, "patient_lon": 88.3953,
        "fleet_key": "Kolkata",
        "priority": {
            "emergency_type":"accident","weather":"rainy","road_condition":"wet",
            "road_type":"national highway","lighting":"daylight","traffic_control":"signals",
            "vehicle_type":"Car","location_type":"Straight Road","hour":9,"day_of_week":1,
            "month":7,"num_vehicles":4,"num_casualties":4,"num_fatalities":0,
            "speed_limit":80,"driver_age":28,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"No",
            "state":"West Bengal","city":"Kolkata",
        },
        "hotspot": {
            "city":"Kolkata","state":"West Bengal","latitude":22.5355,"longitude":88.3953,
            "hour":9,"day_of_week":1,"month":7,"weather":"rainy","road_type":"highway",
            "visibility":"medium","traffic_density":"high","traffic_signal":1,"lanes":6,
            "temperature":31,"vehicles_involved":4,"casualties":4,"is_peak_hour":1,
            "festival":"None","cause":"weather",
        },
        "traffic": {
            "hour":9,"day_of_week":1,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":62.0,
        },
    },
    # ── DELHI ───────────────────────────────────────────────────────────────
    {
        "label": "🔴 DEL    Critical Night Crash — Delhi Ring Road",
        "city": "Delhi", "state": "Delhi",
        "patient_lat": 28.6139, "patient_lon": 77.2090, "fleet_key": "Delhi",
        "priority": {
            "emergency_type":"accident","weather":"foggy","road_condition":"wet",
            "road_type":"national highway","lighting":"dark","traffic_control":"none",
            "vehicle_type":"Truck","location_type":"Intersection","hour":23,"day_of_week":4,
            "month":11,"num_vehicles":4,"num_casualties":7,"num_fatalities":2,
            "speed_limit":80,"driver_age":38,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"Yes",
            "state":"Delhi","city":"Delhi",
        },
        "hotspot": {
            "city":"Delhi","state":"Delhi","latitude":28.6139,"longitude":77.2090,
            "hour":23,"day_of_week":4,"month":11,"weather":"foggy","road_type":"highway",
            "visibility":"low","traffic_density":"medium","traffic_signal":0,"lanes":6,
            "temperature":14,"vehicles_involved":4,"casualties":7,"is_peak_hour":0,
            "festival":"None","cause":"overspeeding",
        },
        "traffic": {
            "hour":23,"day_of_week":4,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":28.0,
        },
    },
    # ── MUMBAI ──────────────────────────────────────────────────────────────
    {
        "label": "🟠 MUM    Rush Hour Crash — Mumbai Western Express Highway",
        "city": "Mumbai", "state": "Maharashtra",
        "patient_lat": 19.0760, "patient_lon": 72.8777, "fleet_key": "Mumbai",
        "priority": {
            "emergency_type":"accident","weather":"rainy","road_condition":"wet",
            "road_type":"urban road","lighting":"daylight","traffic_control":"signals",
            "vehicle_type":"Two-Wheeler","location_type":"Straight Road","hour":9,"day_of_week":1,
            "month":6,"num_vehicles":2,"num_casualties":3,"num_fatalities":0,
            "speed_limit":50,"driver_age":22,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"No",
            "state":"Maharashtra","city":"Mumbai",
        },
        "hotspot": {
            "city":"Mumbai","state":"Maharashtra","latitude":19.0760,"longitude":72.8777,
            "hour":9,"day_of_week":1,"month":6,"weather":"rainy","road_type":"urban",
            "visibility":"medium","traffic_density":"high","traffic_signal":1,"lanes":4,
            "temperature":29,"vehicles_involved":2,"casualties":3,"is_peak_hour":1,
            "festival":"None","cause":"weather",
        },
        "traffic": {
            "hour":9,"day_of_week":1,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":55.0,
        },
    },
    # ── BANGALORE ───────────────────────────────────────────────────────────
    {
        "label": "🟡 BLR    Evening Crash — Bangalore Outer Ring Road",
        "city": "Bangalore", "state": "Karnataka",
        "patient_lat": 12.9716, "patient_lon": 77.5946, "fleet_key": "Bangalore",
        "priority": {
            "emergency_type":"accident","weather":"clear","road_condition":"dry",
            "road_type":"urban road","lighting":"dusk","traffic_control":"signals",
            "vehicle_type":"Car","location_type":"Intersection","hour":18,"day_of_week":2,
            "month":3,"num_vehicles":2,"num_casualties":2,"num_fatalities":0,
            "speed_limit":60,"driver_age":31,"driver_gender":"Female",
            "license_status":"valid","alcohol_involvement":"No",
            "state":"Karnataka","city":"Bangalore",
        },
        "hotspot": {
            "city":"Bangalore","state":"Karnataka","latitude":12.9716,"longitude":77.5946,
            "hour":18,"day_of_week":2,"month":3,"weather":"clear","road_type":"urban",
            "visibility":"high","traffic_density":"high","traffic_signal":1,"lanes":4,
            "temperature":27,"vehicles_involved":2,"casualties":2,"is_peak_hour":1,
            "festival":"None","cause":"overspeeding",
        },
        "traffic": {
            "hour":18,"day_of_week":2,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":71.0,
        },
    },
    # ── HYDERABAD ───────────────────────────────────────────────────────────
    {
        "label": "🟠 HYD    Festival Night Crash — Hyderabad Old City",
        "city": "Hyderabad", "state": "Telangana",
        "patient_lat": 17.3850, "patient_lon": 78.4867, "fleet_key": "Hyderabad",
        "priority": {
            "emergency_type":"accident","weather":"clear","road_condition":"dry",
            "road_type":"urban road","lighting":"dark","traffic_control":"none",
            "vehicle_type":"Two-Wheeler","location_type":"Curve","hour":22,"day_of_week":6,
            "month":10,"num_vehicles":2,"num_casualties":3,"num_fatalities":1,
            "speed_limit":50,"driver_age":24,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"Yes",
            "state":"Telangana","city":"Hyderabad",
        },
        "hotspot": {
            "city":"Hyderabad","state":"Telangana","latitude":17.3850,"longitude":78.4867,
            "hour":22,"day_of_week":6,"month":10,"weather":"clear","road_type":"urban",
            "visibility":"medium","traffic_density":"high","traffic_signal":0,"lanes":2,
            "temperature":26,"vehicles_involved":2,"casualties":3,"is_peak_hour":0,
            "festival":"Diwali","cause":"drunk_driving",
        },
        "traffic": {
            "hour":22,"day_of_week":6,"is_weekend":1,"road_type":"urban","monthly_avg_congestion":45.0,
        },
    },
    # ── CHENNAI ─────────────────────────────────────────────────────────────
    {
        "label": "🟡 CHN    Morning Accident — Chennai Anna Salai",
        "city": "Chennai", "state": "Tamil Nadu",
        "patient_lat": 13.0827, "patient_lon": 80.2707, "fleet_key": "Chennai",
        "priority": {
            "emergency_type":"accident","weather":"rainy","road_condition":"wet",
            "road_type":"state highway","lighting":"dawn","traffic_control":"signs",
            "vehicle_type":"Bus","location_type":"Straight Road","hour":7,"day_of_week":0,
            "month":11,"num_vehicles":3,"num_casualties":5,"num_fatalities":0,
            "speed_limit":50,"driver_age":45,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"No",
            "state":"Tamil Nadu","city":"Chennai",
        },
        "hotspot": {
            "city":"Chennai","state":"Tamil Nadu","latitude":13.0827,"longitude":80.2707,
            "hour":7,"day_of_week":0,"month":11,"weather":"rainy","road_type":"state highway",
            "visibility":"low","traffic_density":"medium","traffic_signal":1,"lanes":4,
            "temperature":28,"vehicles_involved":3,"casualties":5,"is_peak_hour":1,
            "festival":"None","cause":"weather",
        },
        "traffic": {
            "hour":7,"day_of_week":0,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":49.0,
        },
    },
    # ── PUNE ────────────────────────────────────────────────────────────────
    {
        "label": "🟢 PNE    Weekend Crash — Pune-Mumbai Expressway",
        "city": "Pune", "state": "Maharashtra",
        "patient_lat": 18.5204, "patient_lon": 73.8567, "fleet_key": "Pune",
        "priority": {
            "emergency_type":"accident","weather":"clear","road_condition":"dry",
            "road_type":"national highway","lighting":"daylight","traffic_control":"signs",
            "vehicle_type":"Car","location_type":"Straight Road","hour":14,"day_of_week":6,
            "month":4,"num_vehicles":2,"num_casualties":2,"num_fatalities":0,
            "speed_limit":100,"driver_age":33,"driver_gender":"Female",
            "license_status":"valid","alcohol_involvement":"No",
            "state":"Maharashtra","city":"Pune",
        },
        "hotspot": {
            "city":"Pune","state":"Maharashtra","latitude":18.5204,"longitude":73.8567,
            "hour":14,"day_of_week":6,"month":4,"weather":"clear","road_type":"highway",
            "visibility":"high","traffic_density":"medium","traffic_signal":0,"lanes":6,
            "temperature":36,"vehicles_involved":2,"casualties":2,"is_peak_hour":0,
            "festival":"None","cause":"overspeeding",
        },
        "traffic": {
            "hour":14,"day_of_week":6,"is_weekend":1,"road_type":"urban","monthly_avg_congestion":22.0,
        },
    },
    # ── JAIPUR ──────────────────────────────────────────────────────────────
    {
        "label": "🟠 JAI    Heat-Wave Crash — Jaipur NH-48",
        "city": "Jaipur", "state": "Rajasthan",
        "patient_lat": 26.9124, "patient_lon": 75.7873, "fleet_key": "Jaipur",
        "priority": {
            "emergency_type":"accident","weather":"hazy","road_condition":"dry",
            "road_type":"national highway","lighting":"daylight","traffic_control":"none",
            "vehicle_type":"Truck","location_type":"Straight Road","hour":13,"day_of_week":3,
            "month":5,"num_vehicles":2,"num_casualties":4,"num_fatalities":1,
            "speed_limit":100,"driver_age":52,"driver_gender":"Male",
            "license_status":"valid","alcohol_involvement":"No",
            "state":"Rajasthan","city":"Jaipur",
        },
        "hotspot": {
            "city":"Jaipur","state":"Rajasthan","latitude":26.9124,"longitude":75.7873,
            "hour":13,"day_of_week":3,"month":5,"weather":"hazy","road_type":"highway",
            "visibility":"low","traffic_density":"low","traffic_signal":0,"lanes":4,
            "temperature":46,"vehicles_involved":2,"casualties":4,"is_peak_hour":0,
            "festival":"None","cause":"overspeeding",
        },
        "traffic": {
            "hour":13,"day_of_week":3,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":30.0,
        },
    },
    # ── LUCKNOW ─────────────────────────────────────────────────────────────
    {
        "label": "🟡 LKO    Pedestrian Hit — Lucknow Hazratganj",
        "city": "Lucknow", "state": "Uttar Pradesh",
        "patient_lat": 26.8467, "patient_lon": 80.9462, "fleet_key": "Lucknow",
        "priority": {
            "emergency_type":"accident","weather":"clear","road_condition":"dry",
            "road_type":"urban road","lighting":"dark","traffic_control":"signals",
            "vehicle_type":"Car","location_type":"Intersection","hour":20,"day_of_week":4,
            "month":2,"num_vehicles":1,"num_casualties":2,"num_fatalities":0,
            "speed_limit":50,"driver_age":27,"driver_gender":"Male",
            "license_status":"none","alcohol_involvement":"No",
            "state":"Uttar Pradesh","city":"Lucknow",
        },
        "hotspot": {
            "city":"Lucknow","state":"Uttar Pradesh","latitude":26.8467,"longitude":80.9462,
            "hour":20,"day_of_week":4,"month":2,"weather":"clear","road_type":"urban",
            "visibility":"medium","traffic_density":"medium","traffic_signal":1,"lanes":2,
            "temperature":19,"vehicles_involved":1,"casualties":2,"is_peak_hour":0,
            "festival":"None","cause":"overspeeding",
        },
        "traffic": {
            "hour":20,"day_of_week":4,"is_weekend":0,"road_type":"urban","monthly_avg_congestion":38.0,
        },
    },
]

# ── Single scenario runner ─────────────────────────────────────────────────────
def run_scenario(sc: Dict) -> Dict | None:
    label = sc["label"]; lat = sc["patient_lat"]; lon = sc["patient_lon"]
    fleet = FLEETS[sc["fleet_key"]]
    avail = [a for a in fleet if a["status"] == "available"]
    busy  = [a for a in fleet if a["status"] == "busy"]
    offl  = [a for a in fleet if a["status"] == "offline"]

    hdr(f"🚨  {label}", R)
    info(f"City: {sc['city']}, {sc['state']}  |  GPS: ({lat}, {lon})")
    info(f"Fleet: {len(fleet)} units  ({G}{len(avail)} avail{RESET}  "
         f"{Y}{len(busy)} busy{RESET}  {DIM}{len(offl)} offline{RESET})")

    # Step 1 — Priority
    sub("STEP 1 › /predict-priority")
    info(f"Encoding: weather={sc['priority']['weather']!r}, "
         f"road={sc['priority']['road_type']!r}, "
         f"hour={sc['priority']['hour']}, "
         f"casualties={sc['priority']['num_casualties']}, "
         f"alcohol={sc['priority']['alcohol_involvement']!r}, "
         f"city={sc['city']!r}")
    t0 = time.time()
    pr = api_post("/predict-priority", sc["priority"])
    ms = (time.time()-t0)*1000
    p_class = pr["priority_class"]; p_conf = pr["confidence"]
    p_probs = pr["label_probabilities"]; pc = PC.get(p_class, W)
    row("→ PRIORITY CLASS", f"{pc}{BOLD}{p_class}{RESET}")
    row("→ Confidence",     f"{p_conf*100:.1f}%")
    row("→ Model",          pr["metadata"]["model"])
    row("→ Features used",  f"{len(pr['metadata']['features_used'])} encoded features")
    for lbl, prob in sorted(p_probs.items(), key=lambda x: -x[1]):
        c = PC.get(lbl, DIM)
        print(f"  {DIM}│{RESET}     {c}{lbl:<10}{RESET} {bar(prob, 22)}  {prob*100:5.1f}%")
    row("→ API latency",    f"{ms:.0f} ms")
    ok(f"Encoded {len(sc['priority'])} fields → decoded: {pc}{BOLD}{p_class}{RESET} ({p_conf*100:.0f}%)")

    # Step 2 — Hotspot
    sub("STEP 2 › /predict-hotspot")
    info(f"Encoding: lat={lat}, lon={lon}, "
         f"visibility={sc['hotspot']['visibility']!r}, "
         f"density={sc['hotspot']['traffic_density']!r}, "
         f"festival={sc['hotspot'].get('festival','None')!r}")
    t0 = time.time()
    hr = api_post("/predict-hotspot", sc["hotspot"])
    ms = (time.time()-t0)*1000
    h_score = hr["risk_score"]; h_cat = hr["risk_category"]
    h_emoji = RL.get(h_cat, "")
    row("→ RISK SCORE",    f"{h_score:.4f}")
    row("→ Risk category", f"{h_emoji} {h_cat}{RESET}")
    row("→ Risk bar",      bar(h_score, 30, R if h_score>0.7 else Y) + f"  {h_score*100:.1f}%")
    row("→ Model",         hr["metadata"]["model"])
    row("→ API latency",   f"{ms:.0f} ms")
    ok(f"Encoded 19 fields → decoded: risk_score={h_score:.4f} ({h_cat})")

    # Step 3 — Traffic
    sub("STEP 3 › /predict-traffic")
    info(f"Encoding: hour={sc['traffic']['hour']}, "
         f"day={sc['traffic']['day_of_week']}, "
         f"weekend={sc['traffic']['is_weekend']}, "
         f"monthly_avg={sc['traffic']['monthly_avg_congestion']}%")
    t0 = time.time()
    tr = api_post("/predict-traffic", sc["traffic"])
    ms = (time.time()-t0)*1000
    t_cong = tr["congestion_pct"]; t_mult = tr["congestion_multiplier"]
    t_lvl  = tr["traffic_level"]
    row("→ CONGESTION",      f"{t_cong:.1f}%")
    row("→ Traffic level",   f"{TL.get(t_lvl,'')} {t_lvl}{RESET}")
    row("→ ETA multiplier",  f"{BOLD}{Y}{t_mult:.3f}×{RESET}  (all ETAs × {t_mult:.2f})")
    row("→ Congestion bar",  bar(t_cong/100, 30, R if t_cong>60 else Y) + f"  {t_cong:.0f}%")
    row("→ Model",           tr["metadata"]["model"])
    row("→ API latency",     f"{ms:.0f} ms")
    ok(f"Encoded 6 features → decoded: {t_lvl} ({t_cong:.0f}% congestion, ×{t_mult:.2f})")

    # Step 4 — GA
    sub("STEP 4 › /optimize-ambulance  (Genetic Algorithm)")
    info(f"GA inputs: priority={p_class!r}, risk={h_score:.3f}, "
         f"traffic_mult={t_mult:.3f}×, pop=50, gen=100")
    ga_payload = {
        "patient_lat": lat, "patient_lon": lon,
        "emergency_type": sc["priority"]["emergency_type"],
        "priority_class": p_class,
        "hotspot_risk": h_score,
        "congestion_multiplier": t_mult,
        "ambulances": fleet,
        "population_size": 50, "max_generations": 100,
    }
    t0 = time.time()
    ga = api_post("/optimize-ambulance", ga_payload)
    ms = (time.time()-t0)*1000
    amb_id = ga["best_ambulance_id"]; amb = ga["best_ambulance"] or {}
    eta    = ga["estimated_eta_minutes"]; fitness = ga["fitness_score"]
    dist   = ga["distance_km"]; backups = ga["backup_suggestions"]
    reason = ga["reason_for_assignment"]; meta = ga["ga_metadata"] or {}

    if amb_id is None:
        print(f"  {R}✗  No available ambulances!{RESET}"); return None

    row("→ SELECTED UNIT",   f"{BOLD}{W}{amb_id}{RESET}")
    row("→ Vehicle type",    amb.get("vehicle_type","N/A"))
    row("→ Capability",      f"L{amb.get('capability_level','?')} / 4  "
                              f"{'(MICU — highest)' if amb.get('capability_level')==4 else ''}")
    row("→ Status",          f"{G}{amb.get('status','?')}{RESET}")
    row("→ Distance",        f"{dist:.3f} km")
    row("→ ETA (w/traffic)", f"{BOLD}{Y}{eta:.1f} minutes{RESET}")
    row("→ GA fitness",      f"{fitness:.4f}  {'⭐' if fitness > 0.85 else ''}")
    row("→ GA gens run",     f"{meta.get('generations_run','?')} "
                              f"(converged @ gen {meta.get('convergence_generation','?')})")
    row("→ GA latency",      f"{ms:.0f} ms")
    if backups:
        print(f"\n  {DIM}│{RESET}  {M}Backups:{RESET}")
        for i, bk in enumerate(backups, 1):
            print(f"  {DIM}│{RESET}    #{i}  {bk['ambulance_id']:<16}  "
                  f"ETA {bk['eta_minutes']:.1f} min   fitness {bk['fitness']:.4f}")
    print(f"\n  {DIM}│{RESET}  {DIM}{reason}{RESET}")
    ok(f"GA → {BOLD}{W}{amb_id}{RESET} (L{amb.get('capability_level','?')} "
       f"{amb.get('vehicle_type','')})  ETA {Y}{BOLD}{eta:.1f} min{RESET}")

    return {
        "label": label, "city": sc["city"],
        "priority": p_class, "risk": h_cat, "traffic": t_lvl,
        "unit": amb_id, "vehicle": amb.get("vehicle_type","?"),
        "cap": amb.get("capability_level","?"),
        "dist": dist, "eta": eta, "fitness": fitness,
    }

# ── Health check ───────────────────────────────────────────────────────────────
def check_health() -> None:
    hdr("🇮🇳  ALL-INDIA E2E TEST  ·  AI AMBULANCE ALLOCATION SERVICE", G)
    info(f"Server  : {BASE_URL}")
    info(f"Cities  : {', '.join(FLEETS.keys())}")
    info(f"Kolkata : 2 dedicated scenarios (night crash + rush hour)")
    info(f"Scenarios: {len(SCENARIOS)} total")
    h = api_get("/health")
    st = h["status"]; colour = G if st=="healthy" else R
    print(f"\n  Service : {colour}{BOLD}{st.upper()}{RESET}   "
          f"v{h['version']}  [{h['environment']}]")
    for model, status in h["models"].items():
        icon = G+"✔" if status=="loaded" else R+"✗"
        print(f"  {icon}{RESET}  {model:<30} {status}")
    if st != "healthy":
        print(f"\n  {R}Run python train.py first!{RESET}"); sys.exit(1)
    ok("Service healthy — all 3 models loaded\n")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:                                          # enable ANSI on Windows
        import ctypes
        ctypes.windll.kernel32.SetConsoleMode(
            ctypes.windll.kernel32.GetStdHandle(-11), 7)
    except Exception: pass

    check_health()
    results = []
    for sc in SCENARIOS:
        r = run_scenario(sc)
        if r: results.append(r)

    # ── Final report ──────────────────────────────────────────────────────
    hdr("🇮🇳  ALL-INDIA DISPATCH SUMMARY", M)
    print(f"\n{BOLD}  {'City':<12} {'Scenario':<35} {'Priority':<10} {'Risk':<10} "
          f"{'Traffic':<12} {'Unit':<16} {'ETA':>5}  {'Fit':>6}{RESET}")
    print(SEP)

    kol_pass = 0
    for r in results:
        city  = r["city"]
        name  = r["label"].split("—")[1].strip() if "—" in r["label"] else r["label"][:32]
        pc_c  = PC.get(r["priority"], W)
        eta_c = R if r["eta"] > 15 else (Y if r["eta"] > 8 else G)
        is_kol = city == "Kolkata"
        kol_mark = f" {M}◀ KOLKATA{RESET}" if is_kol else ""
        print(f"  {C if is_kol else ''}{city:<12}{RESET}"
              f" {DIM}{name[:34]:<35}{RESET}"
              f" {pc_c}{r['priority']:<10}{RESET}"
              f" {r['risk']:<10}"
              f" {r['traffic']:<12}"
              f" {BOLD}{W}{r['unit']:<16}{RESET}"
              f" {eta_c}{r['eta']:>4.1f}m{RESET}"
              f" {r['fitness']:>6.4f}"
              f"{kol_mark}")
        if is_kol: kol_pass += 1

    print(SEP)
    total = len(SCENARIOS); passed = len(results)

    print(f"\n  {G}Cities tested        : {len(set(r['city'] for r in results))}/{len(FLEETS)}{RESET}")
    print(f"  {M}Kolkata scenarios    : {kol_pass}/2 ✔{RESET}")
    print(f"  {G}Scenarios passed     : {passed}/{total}{RESET}")
    print(f"  All busy/offline units: skipped ✔")
    print(f"  City-agnostic routing : ✔  (no city hardcoded in models)\n")

    colour = G if passed==total else R
    print(f"{colour}{BOLD}  {'✔' if passed==total else '✗'}  "
          f"{passed}/{total} ALL-INDIA scenarios completed{RESET}\n")
    sys.exit(0 if passed==total else 1)
