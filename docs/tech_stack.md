# Tech Stack

This document defines the approved technology stack for the **AI Ambulance Allocation System**.
The repository is split into three independent folders:

- `frontend/` → all UI code
- `backend/` → all API and server code
- `ai-ml/` → machine learning and genetic algorithm logic
for auth use better auth
---

## 1. Frontend

### Core Stack
- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **Shadcn UI**

### Purpose
The frontend is responsible for all user-facing dashboards and views:
- Patient dashboard
- Ambulance driver dashboard
- Admin dashboard
- Emergency request form
- Live ambulance tracking screen
- Map-based route visualization

### Why this stack
- **Next.js** gives a production-ready React framework with routing and server capabilities.
- **TypeScript** improves code safety and maintainability.
- **Tailwind CSS** speeds up UI development.
- **Shadcn UI** provides reusable, polished components.

### Frontend responsibilities
- Authentication screens
- Role-based dashboards
- Request submission UI
- Map and tracking UI
- Realtime status updates
- Display of ETA, ambulance status, and assignment details

---

## 2. Backend

### Core Stack
- **Node.js**
- **Express.js**
- **TypeScript**
- **Socket.IO**

### Purpose
The backend manages application logic, API endpoints, and realtime communication.

### Backend responsibilities
- Authentication and authorization
- Emergency request creation and updates
- Ambulance assignment orchestration
- Communication with the AI/ML service
- Communication with the Genetic Algorithm service
- Realtime location updates using sockets
- Writing and reading data from Supabase

### Why this stack
- **Node.js + Express.js** is fast for API development.
- **TypeScript** keeps backend contracts consistent with the frontend.
- **Socket.IO** supports live updates for tracking and dispatch.

---

## 3. AI/ML

### Core Stack
- **Python**
- **Pandas**
- **NumPy**
- **Scikit-learn**
- **Joblib**

### Model Choice
- **Random Forest Classifier** for emergency priority prediction

### Optimization Layer
- **Custom Genetic Algorithm** written manually in Python

### AI/ML responsibilities
- Predict emergency priority
- Predict high-risk areas / hotspots
- Provide risk scores to the backend
- Use the Genetic Algorithm to optimize ambulance allocation

### Why this stack
- **Scikit-learn** is simple and reliable for tabular data.
- **Random Forest** is easy to train and explain.
- **Custom GA implementation** keeps the project aligned with the subject and avoids dependency on a black-box optimizer.

---

## 4. Database

### Core Stack
- **Supabase PostgreSQL**

### Purpose
Supabase will be the main persistent database for the system.

### Stored data
- Users
- Patients
- Drivers
- Ambulances
- Hospitals
- Emergency requests
- Ambulance assignments
- Live tracking logs
- Notification/status history

### Why Supabase
- Managed PostgreSQL database
- Easy integration with modern web apps
- Good dashboard and authentication support if needed
- Reliable for structured relational data

---

## 5. Realtime Communication

### Stack
- **Socket.IO**

### Purpose
Used for live updates between patient, driver, and admin dashboards.

### Realtime events
- New emergency request created
- Ambulance assigned
- Driver accepted request
- Driver location updated
- ETA updated
- Trip started / completed

---

## 6. Maps and Tracking

### Recommended Tools
- **Leaflet.js** for map rendering
- **OpenStreetMap** or a suitable map provider for tiles and routes

### Purpose
- Show patient location
- Show ambulance live location
- Show route to pickup point
- Show route to hospital
- Display ETA visually

---

## 7. Folder Separation

### `frontend/`
Contains:
- Next.js app
- Pages and routes
- Components
- Dashboard layouts
- Map UI
- API client helpers

### `backend/`
Contains:
- Express server
- API routes
- Controllers
- Middleware
- Socket handlers
- Database service layer
- AI/GA service connectors

### `ai-ml/`
Contains:
- Dataset files
- Training scripts
- Trained model artifacts
- Genetic Algorithm implementation
- Prediction APIs or helper scripts

---

## 8. Suggested Runtime Flow

1. Patient submits emergency request from the frontend.
2. Backend stores the request in Supabase.
3. Backend sends request data to the AI/ML service.
4. AI predicts priority and risk score.
5. Genetic Algorithm selects the best ambulance.
6. Backend stores the assignment in Supabase.
7. Socket.IO pushes updates to patient and driver dashboards.
8. Driver follows the route on the map.
9. Patient tracks the ambulance in real time.

---

## 9. Final Approved Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI
- Leaflet.js

### Backend
- Node.js
- Express.js
- TypeScript
- Socket.IO

### AI/ML
- Python
- Pandas
- NumPy
- Scikit-learn
- Joblib
- Custom Genetic Algorithm

### Database
- Supabase PostgreSQL

---

## 10. Design Principle

Keep responsibilities separated:
- **Frontend** = user interface
- **Backend** = business logic and orchestration
- **AI/ML** = prediction and optimization
- **Database** = persistent storage

This separation makes the project easier to build, test, and explain.
