# AI Ambulance Allocation System — Architecture

## 1. Overview

This project is a **full-stack emergency response platform** that automatically assigns the best ambulance to a patient request and enables real-time tracking of both the ambulance and the patient journey on a map.

The system is divided into three independent codebases inside one main repository:

- `frontend/` — all user-facing UI and client-side logic
- `backend/` — API server, business logic, database access, and realtime communication
- `ai-ml/` — machine learning model training and genetic algorithm optimization

The main objective is to reduce ambulance response time by combining:

- **AI/ML** for emergency priority prediction
- **Genetic Algorithm (GA)** for optimal ambulance allocation
- **Maps + Realtime updates** for live tracking
- **Supabase PostgreSQL** for persistent data storage

---

## 2. Product Goal

When a patient submits an emergency request:

1. The patient enters location and emergency details.
2. The backend stores the request in Supabase.
3. The ML model predicts the urgency/priority of the request.
4. The GA engine selects the most suitable ambulance based on:
   - distance
   - traffic
   - ambulance availability
   - request priority
   - coverage balance
5. The assigned driver sees the emergency in the ambulance dashboard.
6. The patient sees live ambulance tracking on a map.
7. The admin monitors all requests and assignments from a control panel.

---

## 3. High-Level Architecture

```text
Patient Dashboard
        ↓
Frontend (Next.js + TypeScript)
        ↓
Backend API (Node.js/Express or Next.js API layer if required)
        ↓
Supabase PostgreSQL
        ↓
AI/ML Service (priority prediction)
        ↓
Genetic Algorithm Service (ambulance optimization)
        ↓
Realtime updates via Socket/WebSocket
        ↓
Driver Dashboard + Patient Tracking Map
```

---

## 4. Folder Structure

```text
main-project/
├── frontend/
├── backend/
├── ai-ml/
└── README.md
```

### 4.1 `frontend/`
Contains:
- Next.js app
- TypeScript code
- dashboard pages
- map UI
- forms
- tables
- realtime tracking components

### 4.2 `backend/`
Contains:
- REST APIs
- request validation
- authentication/authorization
- assignment logic
- Supabase queries
- realtime socket handling
- integration with AI service and GA service

### 4.3 `ai-ml/`
Contains:
- dataset processing scripts
- model training code
- saved model artifacts
- GA implementation
- inference scripts/API
- evaluation scripts

---

## 5. Technology Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI
- Leaflet.js or Google Maps
- Socket.IO client

### Backend
- Node.js
- Express.js or Next.js server-side API routes
- TypeScript
- Socket.IO
- Supabase client SDK
- Zod / Joi for validation

### Database
- Supabase PostgreSQL

### AI/ML
- Python
- Pandas
- NumPy
- Scikit-learn
- Joblib

### Optimization
- Python
- Custom Genetic Algorithm implementation

---

## 6. Functional Modules

## 6.1 Patient Module
Patient can:
- register/login
- submit emergency request
- provide location
- provide emergency type and notes
- view assigned ambulance
- track ambulance live on map
- see ETA and status updates

## 6.2 Driver / Ambulance Module
Driver can:
- login
- receive assigned emergency
- accept/reject request
- see patient location and route
- update trip status
- share live GPS location
- mark trip completed

## 6.3 Admin Module
Admin can:
- view all requests
- see ambulance availability
- see current assignments
- manage drivers and ambulances
- override or reassign if needed
- monitor system metrics

---

## 7. Core System Workflow

### Step 1: Patient Submits Emergency
The patient fills a form containing:
- name
- phone number
- location
- emergency category
- short description
- optional severity hints

### Step 2: Backend Stores Request
The backend creates an emergency request record in Supabase with status:
- `pending`

### Step 3: ML Priority Prediction
The backend sends contextual data to the AI/ML service.

The ML model predicts:
- `low`
- `medium`
- `high`
- `critical`

This score helps the allocation engine prioritize the request.

### Step 4: GA-Based Ambulance Selection
The GA engine evaluates candidate ambulances using fitness score:

- shortest distance
- lowest traffic delay
- ambulance availability
- request priority
- load balancing across city zones

The best ambulance is selected.

### Step 5: Assignment Saved
The backend writes the assignment into Supabase and updates the request status to:
- `assigned`

### Step 6: Driver Notified
The driver receives a realtime notification through Socket.IO.

### Step 7: Tracking Begins
Driver location is pushed to the backend at intervals.
The patient dashboard displays:
- ambulance location
- route path
- ETA
- trip status

### Step 8: Completion
When the ambulance reaches the hospital and trip ends:
- request status changes to `completed`
- logs are stored in Supabase

---

## 8. AI / ML Architecture

The AI component is responsible for **prediction**, not optimization.

### Purpose
Predict emergency urgency so the dispatcher system can prioritize requests properly.

### Recommended Model
- Random Forest Classifier

### Why this model
- works well on tabular data
- easy to train and explain
- fast inference
- suitable for a college project

### Input Features
Possible features include:
- emergency type
- time of day
- day of week
- location zone
- traffic level
- weather
- historical incident frequency
- age group or basic patient metadata if available

### Output
The model outputs a priority class or score:
- `low`
- `medium`
- `high`
- `critical`

### AI Service Responsibilities
- load trained model
- preprocess request data
- run inference
- return priority score to backend

### Training Flow
1. collect or generate dataset
2. clean and encode features
3. split into train/test
4. train Random Forest
5. evaluate accuracy / F1-score
6. save model using Joblib
7. expose inference function

---

## 9. Genetic Algorithm Architecture

The GA component is responsible for **optimization**.

### Purpose
Select the most suitable ambulance for a request.

### What the GA Optimizes
The fitness function should minimize:
- response time
- distance
- traffic delay

The fitness function should maximize:
- priority satisfaction
- city coverage
- fairness of ambulance distribution

### Chromosome Representation
A chromosome can represent a mapping from request to ambulance or a city-level ambulance placement configuration.

Example:
```text
[Ambulance_3, Ambulance_7, Ambulance_1, Ambulance_9]
```

### Fitness Function Example
A sample fitness function may combine:
- inverse distance
- inverse ETA
- ambulance status
- request priority weight

### GA Operations
- **Selection**: choose top-performing candidates
- **Crossover**: combine two good solutions
- **Mutation**: randomly alter one gene to explore new solutions
- **Replacement**: keep best new generation

### GA Output
- best ambulance ID
- estimated response time
- alternative backups if primary ambulance fails

### GA Service Responsibilities
- receive request data + available ambulance list
- compute fitness across candidates
- return best assignment recommendation to backend

---

## 10. Database Architecture (Supabase)

Supabase stores all persistent application data.

### Main Tables

#### `users`
- id
- name
- email
- phone
- role (`patient`, `driver`, `admin`)
- created_at

#### `ambulances`
- id
- driver_id
- vehicle_number
- status (`available`, `busy`, `offline`)
- latitude
- longitude
- last_updated

#### `hospitals`
- id
- name
- latitude
- longitude
- contact_number

#### `emergency_requests`
- id
- patient_id
- emergency_type
- description
- priority
- status
- latitude
- longitude
- created_at

#### `assignments`
- id
- request_id
- ambulance_id
- eta
- assigned_at
- accepted_at
- completed_at

#### `tracking_logs`
- id
- assignment_id
- latitude
- longitude
- timestamp

### Notes
- Supabase acts as the source of truth for user data, request data, ambulance status, and trip logs.
- Realtime updates can be powered either through Socket.IO or Supabase realtime, but Socket.IO is preferred for direct custom control.

---

## 11. Frontend Architecture

### Main Pages
- `/login`
- `/register`
- `/patient/dashboard`
- `/patient/request`
- `/patient/track/[id]`
- `/ambulance/dashboard`
- `/admin/dashboard`

### Frontend Responsibilities
- collect user input
- render dashboards
- show map and route
- display ETA and status
- subscribe to realtime updates
- provide clean mobile-friendly UI

### Key UI Components
- emergency request form
- ambulance list cards
- map view
- live status badge
- ETA panel
- assignment timeline
- admin summary cards

---

## 12. Backend Architecture

### Core Responsibilities
- authentication and role checks
- request validation
- emergency request creation
- call AI/ML service
- call GA service
- save assignments to Supabase
- update ambulance locations
- broadcast realtime events
- expose APIs for frontend

### Suggested API Endpoints

#### Auth
- `POST /auth/register`
- `POST /auth/login`

#### Emergency
- `POST /emergency/request`
- `GET /emergency/:id`
- `GET /emergency/list`

#### Ambulance
- `GET /ambulance/available`
- `POST /ambulance/location`
- `POST /ambulance/accept`
- `POST /ambulance/complete`

#### Assignment
- `POST /assignment/allocate`
- `GET /assignment/:requestId`

#### Tracking
- `POST /tracking/location`
- `GET /tracking/:assignmentId`

### Backend Flow
- receive request
- validate data
- store into Supabase
- call AI service
- call GA service
- save final assignment
- emit realtime updates

---

## 13. Realtime Tracking Design

The system should feel like a ride-hailing app.

### Driver Side
- sends live GPS coordinates every few seconds
- updates route status
- shares movement to backend

### Patient Side
- subscribes to updates for the assigned request
- sees ambulance on map
- sees ETA changes
- sees status transitions:
  - pending
  - assigned
  - accepted
  - en route
  - arrived
  - completed

### Transport Layer
- Socket.IO for realtime messages
- HTTP APIs for normal CRUD actions

---

## 14. Map and Routing

Map integration is used only for visualization and navigation.

### Map Features
- patient location marker
- ambulance location marker
- hospital marker
- route polyline
- live movement updates
- ETA display

### Recommended Library
- Leaflet.js for simpler integration
- Google Maps if advanced routing is required

---

## 15. Non-Functional Requirements

### Performance
- ambulance allocation must happen quickly
- realtime tracking should update smoothly
- backend APIs should remain responsive

### Reliability
- fallback logic if ML service fails
- fallback logic if GA service fails
- manual override by admin

### Scalability
- backend and AI service should be deployable separately
- database should support increasing request volume

### Security
- role-based access control
- input validation
- protected routes
- secure environment variables
- no direct client access to sensitive admin endpoints

---

## 16. Service Communication

### Frontend → Backend
- HTTP requests for forms and dashboards
- Socket.IO for realtime updates

### Backend → AI/ML
- internal API call or Python subprocess/service endpoint

### Backend → GA
- internal service call returning best ambulance allocation

### Backend → Supabase
- store and fetch all application data

---

## 17. Suggested Implementation Order

1. Build database schema in Supabase
2. Build frontend dashboards
3. Build backend CRUD APIs
4. Add patient emergency request flow
5. Add driver assignment flow
6. Add live location tracking
7. Integrate AI priority prediction
8. Integrate GA-based ambulance allocation
9. Add admin controls and analytics
10. Polish UI and test end-to-end

---

## 18. Final Summary

This system is a **full-stack AI-driven ambulance allocation platform**.

- **Next.js + TypeScript** handles the frontend.
- **Backend** manages business logic, APIs, and realtime communication.
- **Supabase** stores all persistent data.
- **AI/ML** predicts emergency urgency.
- **Genetic Algorithm** optimizes ambulance selection.
- **Maps + tracking** provide a ride-hailing style experience for both patients and drivers.

The result is an emergency response system that is technically strong, easy to demonstrate, and directly relevant to real-world healthcare logistics in India.
