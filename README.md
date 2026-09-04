# Idempotency & Concurrency Test Harness for Duplicate-Record Prevention

An enterprise-grade test harness and interactive web application prototype designed to demonstrate, analyze, and prevent duplicate order creation caused by client retries, network timeouts, double-click checkouts, multiple tabs, and concurrent request races.

---

## 📌 Problem Statement

In distributed web applications, duplicate records occur when identical operations are submitted multiple times:
1. **Network Retries**: Transient network failures cause clients to retry requests that succeeded at the database layer.
2. **Double-Click Checkout**: Users click submit repeatedly on slow connections.
3. **Multi-Tab Racing**: Multiple tabs submitting identical cart checkouts concurrently.
4. **Mobile Resubmission**: Mobile clients switching network adapters (WiFi to LTE) mid-request.

This harness provides both an **unprotected baseline endpoint** (which reproduces duplicate creation) and a **protected endpoint** (utilizing idempotency keys, SHA-256 payload fingerprints, unique database constraints, and atomic transactions to guarantee zero duplicate records).

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, FastAPI, SQLite (with SQLAlchemy ORM), Pydantic v2
- **Frontend**: React 18, Vite, Modern Responsive Vanilla CSS (Glassmorphism UI, CSS variables)
- **Testing**: pytest, FastAPI TestClient, HTTPX

---

## 📁 Project Structure

```
Web Mob Customer.pro/
├── backend/
│   ├── app/
│   │   ├── api/          # API route definitions
│   │   ├── core/         # Configuration & security
│   │   ├── services/     # Business logic & idempotency engine
│   │   ├── utils/        # Fingerprinting & hashing utilities
│   │   ├── database.py   # SQLAlchemy engine & session setup
│   │   ├── main.py       # FastAPI application entry point
│   │   ├── models.py     # SQLAlchemy DB models (Order, IdempotencyRecord, AuditLog)
│   │   └── schemas.py    # Pydantic schemas
│   ├── tests/
│   │   └── test_api.py   # Pytest suite for /health and /orders
│   └── requirements.txt  # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # React shell, Navbar, Header, MetricCard
│   │   ├── pages/        # Views (Dashboard, Traffic Simulator, Live Orders, etc.)
│   │   ├── services/     # API fetch layer
│   │   ├── App.jsx       # Main layout & router framework
│   │   ├── index.css     # Design system & dark glassmorphism theme
│   │   └── main.jsx      # React DOM entry point
│   ├── index.html        # HTML shell
│   ├── package.json      # Frontend npm package dependencies
│   └── vite.config.js    # Vite configuration & backend proxy
├── docs/
│   ├── requirements.md   # Functional & non-functional requirements
│   └── architecture.md   # Architectural design & data model specs
└── README.md
```

---

## 🚀 How to Run locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
Navigate to the `backend` directory, install requirements, and run Uvicorn:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
The FastAPI backend will run on `http://localhost:8000`.
- API Health Check: `http://localhost:8000/health`
- Orders List: `http://localhost:8000/orders`
- Interactive API Docs: `http://localhost:8000/docs`

To run backend automated tests:
```powershell
cd backend
python -m pytest
```

### 3. Frontend Setup
In a separate terminal, navigate to the `frontend` directory, install npm packages, and start Vite:

```powershell
cd frontend
npm install
npm run dev
```
The React frontend dashboard will open at `http://localhost:5173`.

---

## 📊 Current Status: Phase 1 Completed (100% Phase 1 Scope)

- [x] Backend architecture & SQLite database initialization setup
- [x] SQLAlchemy domain models (`Order`, `IdempotencyRecord`, `AuditLog`)
- [x] API endpoints (`GET /health` and `GET /orders`)
- [x] Automated test suite verifying health check and order retrieval
- [x] System requirements and architectural documentation
- [x] Modern React + Vite frontend dashboard shell with all 8 working view navigations
- [x] Metric card layout & live backend connectivity status check

### Coming in Phase 2
- Baseline Order Service (`POST /api/v1/orders/baseline`)
- Protected Order Service with Idempotency Key Lock Engine (`POST /api/v1/orders/protected`)
- Payload conflict detection & SHA-256 fingerprinting
- Traffic simulation engine with configurable concurrency & client retries
