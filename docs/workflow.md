# Workflow.md
## AI Ambulance Allocation System

This document describes the end-to-end workflow of the system from user request to ambulance completion.

---

## 1. System Goal

The platform helps emergency response teams assign the best ambulance to a patient in minimum time using:

- a **Next.js frontend**
- a **TypeScript backend**
- a **machine learning model** for emergency priority prediction
- a **Genetic Algorithm** for ambulance allocation
- **Supabase PostgreSQL** as the database
- real-time map-based tracking for patient and driver

---

## 2. Main User Roles

### Patient
- Raises an emergency request
- Shares location and emergency details
- Tracks the ambulance in real time

### Driver / Ambulance Team
- Receives assigned emergency requests
- Views navigation route and patient location
- Updates trip status

### Admin
- Monitors all requests and ambulances
- Views priority, assignment, and ETA
- Can manually override allocation if needed

---

## 3. High-Level Workflow

1. Patient submits an emergency request.
2. Backend stores the request in Supabase.
3. ML service predicts urgency / priority.
4. Genetic Algorithm selects the best ambulance.
5. Backend stores the assignment.
6. Driver dashboard receives the task in real time.
7. Patient dashboard shows ambulance movement on the map.
8. Driver follows the route to the pickup location.
9. Trip status is updated until completion.

---

## 4. Detailed Workflow

### Step 1: Patient Creates Emergency Request
The patient enters:
- name
- phone number
- location
- emergency type
- optional notes

The frontend sends this data to the backend API.

### Step 2: Backend Validates and Stores the Request
The backend:
- validates input
- creates an emergency record in Supabase
- sets initial status as `pending`

### Step 3: AI / ML Predicts Priority
The backend sends request details to the AI service.

The ML model evaluates:
- emergency type
- time of day
- location risk
- traffic condition
- weather
- historical incident patterns

The model returns a priority score such as:
- low
- medium
- high
- critical

### Step 4: Genetic Algorithm Finds the Best Ambulance
The GA receives:
- patient location
- emergency priority
- available ambulances
- ambulance coordinates
- traffic factor
- distance to hospitals or pickup points

The GA evaluates multiple possible ambulance assignments and chooses the best one based on a fitness function.

Primary optimization goals:
- minimum response time
- nearest suitable ambulance
- priority-aware assignment
- balanced ambulance coverage

### Step 5: Backend Saves Assignment
After the best ambulance is selected, the backend:
- creates an assignment record
- updates request status to `assigned`
- updates ambulance status to `busy`

### Step 6: Driver Receives the Request
The driver dashboard receives the assignment through real-time communication.

The driver can see:
- emergency location
- patient details
- estimated arrival time
- route on the map

### Step 7: Patient Tracks Ambulance Live
The patient dashboard shows:
- assigned ambulance
- live location of ambulance
- ETA
- route progression on the map

This should work like a ride-hailing app such as Rapido or Uber.

### Step 8: Ambulance Reaches Patient
The driver starts navigation and reaches the pickup point.

The system may update:
- trip status to `en_route`
- ambulance location every few seconds

### Step 9: Patient Is Picked Up
After pickup:
- trip status becomes `picked_up`
- patient can see the journey to the hospital

### Step 10: Trip Completes
After drop-off:
- trip status becomes `completed`
- ambulance status becomes `available`
- final trip record is saved

---

## 5. Data Flow Between Modules

```text
Patient Dashboard
    -> Backend API
    -> Supabase
    -> ML Service
    -> GA Service
    -> Assignment Result
    -> Driver Dashboard
    -> Live Tracking Map
```

---

## 6. AI / ML Workflow

The AI service is responsible only for prediction, not allocation.

### Inputs
- emergency type
- time
- area
- weather
- traffic
- historical area risk

### Output
- priority class
- risk score

### Purpose
The model helps the system understand how urgent the case is before allocation happens.

---

## 7. Genetic Algorithm Workflow

The GA is responsible for optimization.

### Inputs
- patient location
- ambulance locations
- ambulance availability
- priority score
- traffic information

### Chromosome Example
Each chromosome represents one possible ambulance assignment.

Example:
- gene 1 = ambulance A assigned to request 1
- gene 2 = ambulance B assigned to request 2

### Fitness Function
The GA tries to minimize:
- distance
- traffic delay
- waiting time

And maximize:
- priority satisfaction
- response efficiency
- ambulance coverage

### Operations
- selection
- crossover
- mutation

### Output
- best ambulance for the request
- expected ETA
- optimized dispatch decision

---

## 8. Frontend Workflow

### Patient Pages
- request form
- live tracking page
- status page

### Driver Pages
- assigned task page
- navigation page
- trip status page

### Admin Pages
- request list
- ambulance list
- assignment dashboard
- analytics dashboard

---

## 9. Backend Workflow

The backend acts as the central coordinator.

Responsibilities:
- authentication
- request validation
- calling the AI service
- calling the GA service
- reading and writing Supabase records
- broadcasting updates through Socket.IO or similar real-time transport

---

## 10. Database Workflow in Supabase

### Main tables
- users
- ambulances
- emergency_requests
- assignments
- hospitals
- tracking_logs

### Typical sequence
1. Insert new request
2. Update request priority
3. Insert assignment
4. Update ambulance status
5. Store tracking updates
6. Mark trip completed

---

## 11. Real-Time Tracking Workflow

The driver sends location updates periodically.

The backend:
- stores the location in the database
- broadcasts the update to the patient dashboard
- refreshes the live map marker

This makes the app feel like a live ride-tracking system.

---

## 12. Error Handling Workflow

### No ambulance available
- request stays in queue
- admin is notified
- system shows fallback status

### ML service unavailable
- use default priority rules
- continue with GA allocation

### GA service unavailable
- fall back to nearest ambulance logic

### Network failure
- retry request
- preserve request data in Supabase

---

## 13. Final End-to-End Summary

1. Patient sends emergency request.
2. Backend stores it in Supabase.
3. ML predicts urgency.
4. GA selects the best ambulance.
5. Driver receives the assignment.
6. Patient tracks the ambulance live.
7. The ambulance reaches the patient.
8. Trip is completed and stored.

---

## 14. One-Line Summary

The system combines emergency prediction, optimization, and live tracking to assign the fastest and most suitable ambulance to a patient in real time.
