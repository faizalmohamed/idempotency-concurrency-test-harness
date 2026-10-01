# Idempotency & Concurrency Test Harness for Duplicate-Record Prevention

An enterprise-grade test harness and interactive web application prototype designed to demonstrate, analyze, and prevent duplicate order creation caused by client retries, network timeouts, double-click checkouts, multiple tabs, and concurrent request races.

---

## 📌 Problem Statement

In distributed web applications, duplicate records occur when identical operations are submitted multiple times:
1. **Network Retries**: Transient network failures cause clients to retry requests that succeeded at the database layer.
2. **Double-Click Checkout**: Users click submit repeatedly on slow connections.
3. **Multi-Tab Racing**: Multiple tabs submitting identical cart checkouts concurrently.
4. **Mobile Resubmission**: Mobile clients switching network adapters (WiFi to LTE) mid-request.

This harness provides both an **unprotected baseline endpoint** (which reproduces duplicate creation under high concurrency) and a **protected endpoint** (utilizing idempotency keys, SHA-256 payload fingerprints, unique database constraints, and atomic transactions to guarantee zero duplicate records).

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, FastAPI, SQLite (with WAL mode & SQLAlchemy ORM), Pydantic v2, Uvicorn
- **Frontend**: React 18, Vite, Modern Responsive Glassmorphism UI (CSS variables, dynamic charts & tables)
- **Testing**: pytest, FastAPI TestClient, HTTPX, multi-threaded concurrency harnesses

---

## 📁 Project Structure

```
Web Mob Customer.pro/
├── backend/
│   ├── app/
│   │   ├── api/          # API route definitions
│   │   ├── core/         # Idempotency key validator & canonical hashing
│   │   ├── services/     # Business logic, audit trail, admin controls, failure injection, comparison
│   │   ├── database.py   # SQLAlchemy engine, WAL mode, session setup
│   │   ├── main.py       # FastAPI application entry point & routing
│   │   ├── models.py     # SQLAlchemy DB models (Order, IdempotencyRecord, AuditLog)
│   │   └── schemas.py    # Pydantic v2 schemas for all request/response models
│   ├── tests/
│   │   └── test_api.py   # Full automated test suite (35 tests passing)
│   └── requirements.txt  # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # React shell, Navbar, Header, MetricCard
│   │   ├── pages/        # Views (Dashboard, Traffic Simulator, Live Orders, Audit Trail, Admin, etc.)
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
├── verify_100.py         # Real live concurrency verification script
└── README.md
```

---

## 🚀 How to Run Locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
Navigate to the `backend` directory, install requirements, and run Uvicorn:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
The FastAPI backend will run on `http://127.0.0.1:8000`.
- API Health Check: `http://127.0.0.1:8000/health`
- Orders List: `http://127.0.0.1:8000/orders`
- Audit Logs: `http://127.0.0.1:8000/audit-logs`
- Comparison Report: `http://127.0.0.1:8000/comparison/report`
- Interactive API Docs: `http://127.0.0.1:8000/docs`

To run the complete automated test suite (35 tests):
```powershell
cd backend
pytest -q
```

### 3. Frontend Setup
In a separate terminal, navigate to the `frontend` directory, install npm packages, and start Vite:

```powershell
cd frontend
npm install
npm run dev
```
The React frontend dashboard will open at `http://localhost:5173`.

To verify the production build:
```powershell
cd frontend
npm run build
```

### 4. Execute Real Live Demonstrations
To run all 4 live demonstrations against the running application:
```powershell
python verify_100.py
```

---

## 📊 Project Completion Status: 100% COMPLETE

All 8 Engineering Phases are fully implemented, integrated, and verified:

- [x] **Phase 1: Foundation & Modular Architecture**
  - SQLite WAL mode setup, ORM models (`Order`, `IdempotencyRecord`, `AuditLog`), health check & baseline retrieval.
- [x] **Phase 2: Core Idempotency Engine**
  - Unprotected endpoint (`POST /orders`) vs Protected endpoint (`POST /orders/v2`), SHA-256 payload canonicalization, unique constraint handling, duplicate/replay detection, 409 conflict detection.
- [x] **Phase 3 & 4: Multi-Threaded Concurrency Testing & Workload Harness**
  - Multi-worker concurrent race simulation (`POST /test/run`), real-time metric aggregation, dynamic duplicate comparison.
- [x] **Phase 5: Immutable Audit Trail Engine & Search UI**
  - Append-only audit logger supporting `NEW_ORDER_CREATED_BASELINE`, `NEW_ORDER_CREATED_PROTECTED`, `IDEMPOTENT_REPLAY`, `PAYLOAD_CONFLICT`, `RACE_LOCKED`, `MANUAL_OVERRIDE`.
  - Filterable, paginated audit trail UI with auto-poll toggle and inspector modal showing decision tree explanations and associated order details.
- [x] **Phase 6: Admin Controls, TTL Pruning & Lock Overrides**
  - Safe database purge, automated TTL record expiration manager, manual key release and force-completion overrides with audit tracking, artificial latency injector.
- [x] **Phase 7: Failure Injection, Network Drops & Legacy Client Coexistence**
  - Simulated 504 Gateway Timeouts, 500 Internal Server Errors, and socket Connection Drops with deterministic rates.
  - Safe legacy client fallback without false-positive blocking.
  - Interactive System Boundaries & Limitations explorer view.
- [x] **Phase 8: Comparison Analytics, Exports & Verification**
  - Measured 100% duplicate prevention rate gauge, latency p50/p95 overhead analysis, throughput comparisons, error distribution breakdown.
  - Full benchmark history table, RFC-4180 CSV export download, and printable PDF Summary report modal.
- [x] **Automated Test Suite**: 35/35 tests passing (`pytest -q`).
- [x] **Frontend Production Build**: Vite production build succeeded (`npm run build`).
