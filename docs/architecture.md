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
|  POST /orders (Baseline)  |                    | POST /orders/v2 (Protected)
|  (No Idempotency Control) |                    | (Idempotent & Atomic)   |
+--------+------------------+                    +---------+-----------------+
         |                                                 |
         |  +----------------------------------------------+
         |  |
         |  +--> [1] Key Validation (`validate_idempotency_key`)
         |  +--> [2] SHA-256 Request Fingerprint (`generate_request_fingerprint`)
         |  +--> [3] Database Transaction Boundary (`Session.commit()`)
         |  +--> [4] Unique Constraint Catch (`IntegrityError`)
         |  +--> [5] Stored Result Response (`RETRIED_AND_MATCHED`)
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

## Idempotency Core Mechanism (Phase 2 Implemented)

When a request arrives at the **Protected Order Endpoint (`POST /orders/v2`)**, it follows a strict sequence:

```
[ Incoming Request ]
        |
        v
Validate Idempotency-Key Header (Non-empty, length <= 128)
        |
        v
Generate SHA-256 Request Fingerprint (Canonicalized JSON)
        |
        +-----> Check Idempotency Record in DB
                     |
                     +---> Record Exists?
                     |        |
                     |        +-- YES: Compare Fingerprint
                     |        |            |
                     |        |            +-- Matching: Return Stored Response (200 OK, replayed=True)
                     |        |            +-- Mismatch: Return HTTP 409 Conflict (BLOCKED_AS_CONFLICT)
                     |        |
                     |        +-- NO: Begin Atomic Database Transaction
                     |                     |
                     |                     +-- Insert Idempotency Record (Status: PROCESSING)
                     |                     +-- Try Flush DB (Catch IntegrityError for Concurrency Races)
                     |                     +-- Create Order Record
                     |                     +-- Update Idempotency Record (Status: COMPLETED)
                     |                     +-- Write Audit Log Entry
                     |                     +-- Commit Transaction
                     |
                     v
             [ Return Response (201 Created) ]
```

---

## Database Architecture & Data Models

### 1. `Order` Model
Represents the business domain entity created during checkout.

| Field | Type | Details |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment |
| `order_reference` | String | Public unique reference string (e.g. `ORD-PROT-8F92A1`) |
| `client_type` | String | Client classification (`web`, `mobile`, `legacy`, `retry_agent`) |
| `payload_json` | Text | Canonical JSON serialized order details |
| `amount` | Float | Financial total |
| `status` | String | Status (`created`, `completed`, `processing`) |
| `created_at` | DateTime | Timestamp of record creation |

### 2. `IdempotencyRecord` Model
Tracks request keys, fingerprints, and cached execution results.

| Field | Type | Details |
| :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto-increment |
| `idempotency_key` | String | **UNIQUE Constraint Index**. Key provided by client. |
| `request_fingerprint` | String | SHA-256 hash of normalized request body. |
| `status` | String | State machine (`PROCESSING`, `COMPLETED`, `FAILED`). |
| `order_id` | Integer | Foreign Key -> `orders.id` (nullable). |
| `response_code` | Integer | Cached HTTP Status Code (201 Created, 200 OK). |
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
| `decision_type` | String | Decision type (`NEW_ORDER_CREATED_PROTECTED`, `IDEMPOTENT_REPLAY`, `PAYLOAD_CONFLICT`, `NEW_ORDER_CREATED_BASELINE`) |
| `actor` | String | Client or system actor |
| `details` | Text | Diagnostic JSON context |
