# Architecture Specification: Idempotency & Concurrency Test Harness

## System Overview

The Idempotency & Concurrency Test Harness provides a lightweight, local architecture to simulate, test, and demonstrate mechanisms for preventing duplicate record creation in distributed web applications.

```
                  +-------------------------------+
                  |       React + Vite Frontend   |
                  +---------------+---------------+
                                  |
                                  v
                  +---------------+---------------+
                  |        FastAPI REST API       |
                  +-------+---------------+-------+
                          |               |
         +----------------+               +----------------+
         |                                                 |
         v                                                 v
+--------+------------------+                    +---------+-----------------+
|  Baseline Order Service   |                    | Protected Order Service   |
|  (No Idempotency Control) |                    | (Idempotent & Atomic)   |
+--------+------------------+                    +---------+-----------------+
         |                                                 |
         |  +----------------------------------------------+
         |  |
         |  +--> [1] Idempotency Key Extraction
         |  +--> [2] SHA-256 Request Fingerprint
         |  +--> [3] Database Transaction Boundary
         |  +--> [4] Unique Constraint Engine
         |  +--> [5] Stored Result Response
         |
         v
+--------+------------------------------------------------------------------+
|                              SQLite Database                              |
|  +-------------------+    +---------------------------+   +------------+  |
|  |    orders table   |    | idempotency_records table |   | audit_logs |  |
|  +-------------------+    +---------------------------+   +------------+  |
+---------------------------------------------------------------------------+
```

---

## Idempotency Core Mechanism

When a request arrives at the **Protected Order Service**, the request follows a strict sequence:

```
[ Incoming Request ]
        |
        v
Extract Idempotency-Key Header
        |
        v
Generate Request Fingerprint (SHA-256 of normalized payload)
        |
        +-----> Check Idempotency Record in DB
                     |
                     +---> Record Exists?
                     |        |
                     |        +-- YES: Compare Fingerprint
                     |        |            |
                     |        |            +-- Matching: Return Stored Response
                     |        |            +-- Mismatch: Return HTTP 409 Conflict
                     |        |
                     |        +-- NO: Begin Atomic Database Transaction
                     |                     |
                     |                     +-- Insert Idempotency Record (Status: PROCESSING)
                     |                     +-- Execute Order Business Logic
                     |                     +-- Save Created Order
                     |                     +-- Update Idempotency Record (Status: COMPLETED, Store Response)
                     |                     +-- Commit Transaction
                     |                     +-- Record Audit Log Entry
                     |
                     v
             [ Return Response ]
```

---

## Database Architecture & Data Models

### 1. `Order` Model
Represents the business domain entity created during checkout.

| Field | Type | Details |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment |
| `order_reference` | String | Public unique reference string (e.g. `ORD-8F92A1`) |
| `client_type` | String | Client classification (`web`, `mobile`, `legacy`, `retry_agent`) |
| `payload_json` | Text | JSON serialized order details (items, customer details) |
| `amount` | Float | Financial total |
| `status` | String | Status (`created`, `processing`, `cancelled`) |
| `created_at` | DateTime | Timestamp of record creation |

### 2. `IdempotencyRecord` Model
Tracks request keys, fingerprints, and cached execution results.

| Field | Type | Details |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment |
| `idempotency_key` | String | **UNIQUE Constraint Index**. Key provided by client. |
| `request_fingerprint` | String | SHA-256 hash of normalized request body + path. |
| `status` | String | State machine (`PROCESSING`, `COMPLETED`, `FAILED`). |
| `order_id` | Integer | Foreign Key -> `orders.id` (nullable). |
| `response_code` | Integer | Cached HTTP Status Code (e.g. 201, 200). |
| `response_body` | Text | Cached JSON response body for transparent replay. |
| `created_at` | DateTime | Initial request receipt timestamp. |
| `updated_at` | DateTime | Completion timestamp. |
| `expires_at` | DateTime | TTL expiration timestamp. |

### 3. `AuditLog` Model
Provides full decision audibility across baseline and protected operations.

| Field | Type | Details |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment |
| `timestamp` | DateTime | Event log timestamp |
| `order_id` | Integer | Optional reference to order |
| `idempotency_key` | String | Optional key associated with event |
| `decision_type` | String | Categorical decision outcome |
| `actor` | String | Client or system actor |
| `details` | Text | Diagnostic JSON context |

---

## Component Separation

- **`app/database.py`**: SQLite engine initialization using standard SQLAlchemy `sessionmaker`. SQLite WAL (Write-Ahead Logging) mode is activated to optimize concurrent read/write performance.
- **`app/models.py`**: ORM definitions for `Order`, `IdempotencyRecord`, and `AuditLog`.
- **`app/schemas.py`**: Data validation & serialization Pydantic models.
- **`app/main.py`**: FastAPI application entry point wiring routers, CORS middleware, and database startup events.
