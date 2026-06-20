# implementation.md
## AI Ambulance Allocation System

This document explains how to implement the project in a practical step-by-step way using:

- **frontend/** for the Next.js app
- **backend/** for the API and business logic
- **ai-ml/** for the ML model and Genetic Algorithm
- **Supabase** for the database

---

## 1. Implementation Strategy

The project should be built in this order:

1. Set up the folder structure
2. Build the database schema in Supabase
3. Build the backend APIs
4. Build the frontend dashboards
5. Build the AI/ML model
6. Build the Genetic Algorithm engine
7. Connect frontend, backend, and AI services
8. Add live tracking and status updates
9. Test the full workflow end to end

This order reduces integration errors and keeps the project modular.

---

## 2. Folder-Level Responsibilities

### frontend/
Contains all user-facing pages and UI components.

Responsibilities:
- patient dashboard
- ambulance/driver dashboard
- admin dashboard
- request forms
- live map
- tracking UI
- authentication screens

### backend/
Contains all server-side logic.

Responsibilities:
- API routes
- authentication
- request validation
- ambulance assignment logic
- communication with AI service
- communication with GA service
- database operations
- real-time updates

### ai-ml/
Contains the ML model and GA implementation.

Responsibilities:
- training script
- model saving/loading
- emergency priority prediction
- Genetic Algorithm optimization
- service API or callable module

---

## 3. Database Setup in Supabase

Create the following tables:

### users
Stores all users.

Fields:
- id
- name
- email
- phone
- role
- created_at

### ambulances
Stores ambulance records.

Fields:
- id
- driver_id
- vehicle_number
- status
- latitude
- longitude
- updated_at

### emergency_requests
Stores patient emergency requests.

Fields:
- id
- patient_id
- emergency_type
- description
- latitude
- longitude
- priority
- status
- created_at

### assignments
Stores ambulance allocation results.

Fields:
- id
- request_id
- ambulance_id
- eta
- assigned_at
- status

### hospitals
Stores hospital information.

Fields:
- id
- name
- latitude
- longitude
- capacity

### tracking_logs
Stores live location updates.

Fields:
- id
- assignment_id
- latitude
- longitude
- timestamp

---

## 4. Frontend Implementation

Use **Next.js + TypeScript**.

### Pages to create

#### Patient pages
- `/patient/dashboard`
- `/patient/request`
- `/patient/tracking/[id]`

#### Ambulance/Driver pages
- `/ambulance/dashboard`
- `/ambulance/task/[id]`
- `/ambulance/navigation/[id]`

#### Admin pages
- `/admin/dashboard`
- `/admin/requests`
- `/admin/ambulances`
- `/admin/assignments`

### Frontend features
- forms for emergency request
- live map with markers
- assignment status cards
- ETA display
- real-time tracking updates
- responsive layout
- role-based navigation

### Recommended frontend libraries
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Leaflet or Google Maps
- Socket.IO client
- React Query or SWR for server state

---

## 5. Backend Implementation

Use **Node.js + Express + TypeScript**.

### Core backend modules

#### Auth module
Handles:
- login
- registration
- role verification
- session/token management

#### Emergency module
Handles:
- new emergency requests
- status updates
- request retrieval

#### Assignment module
Handles:
- calling AI model
- calling GA engine
- saving assignment
- updating ambulance status

#### Tracking module
Handles:
- driver location updates
- patient live tracking
- ETA refresh

#### Admin module
Handles:
- listing active emergencies
- viewing ambulance availability
- manual override if needed

### Backend responsibilities in sequence
1. Receive patient request.
2. Validate payload.
3. Store request in Supabase.
4. Send data to AI service for priority prediction.
5. Send request + ambulance data to GA service.
6. Store the selected ambulance assignment.
7. Push live updates to patient and driver dashboards.
8. Update trip states until completion.

---

## 6. AI/ML Implementation

Use **Python + Scikit-learn**.

### Objective
Predict the urgency level of an emergency request.

### Suggested model
- RandomForestClassifier

### Input features
- emergency type
- time of day
- day of week
- traffic level
- weather
- area risk score
- historical incident frequency

### Output labels
- low
- medium
- high
- critical

### ML workflow
1. Collect or generate dataset.
2. Clean and preprocess data.
3. Encode categorical fields.
4. Split into train/test sets.
5. Train the classifier.
6. Evaluate accuracy and F1 score.
7. Save the model using Joblib.
8. Load the model in runtime for predictions.

### ML role in the system
The model does **not** assign ambulances directly.  
It only provides the priority score used by the backend and GA engine.

---

## 7. Genetic Algorithm Implementation

Use **Python** and implement the GA manually.

### Objective
Choose the best ambulance for a request or best ambulance placement for a set of requests.

### Chromosome representation
A chromosome can represent one allocation plan.

Example:
- gene = ambulance id assigned to a request
- chromosome = complete assignment mapping

### Fitness function
Minimize:
- response time
- traffic delay
- travel distance

Maximize:
- priority handling
- availability match
- city coverage balance

Example fitness formula:

```text
fitness = 1 / (response_time + traffic_delay + distance_penalty)
```

### GA steps
1. Create initial population.
2. Evaluate fitness.
3. Select the best candidates.
4. Apply crossover.
5. Apply mutation.
6. Repeat for multiple generations.
7. Return the best solution.

### GA role in the system
The GA is the decision engine that chooses the ambulance assignment that best satisfies the constraints.

---

## 8. API Design

### Emergency APIs
- `POST /api/emergency/create`
- `GET /api/emergency/:id`
- `GET /api/emergency/all`

### Ambulance APIs
- `GET /api/ambulance/all`
- `GET /api/ambulance/available`
- `PATCH /api/ambulance/status/:id`

### Assignment APIs
- `POST /api/assignment/optimize`
- `GET /api/assignment/:id`
- `GET /api/assignment/all`

### Tracking APIs
- `POST /api/tracking/update`
- `GET /api/tracking/:assignmentId`

### Auth APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

---

## 9. Real-Time Tracking Implementation

Use **Socket.IO** or another WebSocket layer.

### Driver flow
- Driver sends location updates every few seconds.
- Backend receives and stores them.
- Backend broadcasts new coordinates to the patient dashboard.

### Patient flow
- Patient receives live ambulance marker.
- Map updates ETA and route visually.
- Status changes are reflected instantly.

### Status values
- pending
- assigned
- en_route
- picked_up
- completed
- cancelled

---

## 10. Map Integration

Use a map library in the frontend.

### Map should show
- patient location
- ambulance location
- hospital location
- route path
- ETA

### Use cases
- patient sees the assigned ambulance moving toward them
- driver sees the route to the patient
- admin sees all active units on one screen

---

## 11. Integration Flow Between Services

### Request lifecycle
1. Patient submits request from frontend.
2. Backend saves request to Supabase.
3. Backend sends request to AI model.
4. AI returns priority.
5. Backend sends request + ambulance data to GA.
6. GA returns best ambulance.
7. Backend stores assignment.
8. Frontend dashboards update in real time.

### Service communication
- Frontend ↔ Backend through REST APIs
- Backend ↔ AI service through internal HTTP or local Python process
- Backend ↔ Supabase through Supabase client
- Backend ↔ Frontend through Socket.IO for live updates

---

## 12. Suggested Build Order

### Phase 1
- Create repository structure
- Set up Supabase tables
- Build authentication
- Build basic dashboards

### Phase 2
- Build emergency request flow
- Build ambulance list and admin views
- Add map integration

### Phase 3
- Train ML model
- Implement GA
- Connect backend with AI services

### Phase 4
- Add live tracking
- Add real-time status updates
- Add final polishing and deployment

---

## 13. Testing Plan

### Frontend testing
- form validation
- route protection
- live map rendering
- responsive UI

### Backend testing
- API validation
- auth checks
- request assignment logic
- Supabase write/read

### AI testing
- model accuracy
- priority prediction correctness

### GA testing
- fitness evaluation
- convergence behavior
- correct assignment output

### End-to-end testing
- patient submits request
- ambulance assigned
- driver receives task
- patient tracks ambulance
- trip completes successfully

---

## 14. Deployment Plan

### Frontend
Deploy on Vercel or similar platform.

### Backend
Deploy on Render, Railway, or a VPS.

### AI/ML
Run as:
- a separate Python service
- or a local internal module inside backend deployment if feasible

### Database
Use Supabase cloud PostgreSQL.

---

## 15. Final Implementation Summary

The project should be implemented as three cleanly separated codebases:

- `frontend/` for user interfaces
- `backend/` for business logic and APIs
- `ai-ml/` for prediction and optimization

The AI model predicts emergency urgency.  
The Genetic Algorithm chooses the best ambulance.  
The frontend visualizes the system in real time.  
Supabase stores all persistent data.

This structure is modular, scalable, and suitable for a strong academic project.
