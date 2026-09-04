# System Requirements Specification: Idempotency & Concurrency Test Harness

## 1. Problem Statement
In modern distributed architectures, e-commerce applications, and financial transaction systems, duplicate order processing is a major operational risk. Duplicate orders occur when identical logical operations are submitted repeatedly or concurrently due to:
- Client network timeouts & automated retries
- Rapid double-clicking on checkout buttons
- Checkout pages opened across multiple browser tabs
- Mobile connection switches (e.g. WiFi to Cellular mid-request)
- Legacy clients lacking modern retry headers
- High-concurrency race conditions at the backend database boundary

Without robust idempotency mechanisms and concurrency controls, duplicate records contaminate database state, trigger duplicate payments or inventory deductions, and degrade customer trust.

---

## 2. Actors & Stakeholders

| Actor | Description & Role |
| :--- | :--- |
| **Web Client** | Modern SPA checkout client emitting standard HTTP requests with generated idempotency keys. |
| **Mobile Client** | Mobile client prone to intermittent connection drops, backgrounding, and automatic retry attempts. |
| **Retry Agent** | Automated background proxy or middleware retrying unacknowledged requests. |
| **Legacy Client** | Older client version that does not send idempotency headers or request fingerprints. |
| **Admin / Operator** | System administrator evaluating harness metrics, clearing records, and inspecting audit logs. |

---

## 3. Functional Requirements

1. **Order Creation**:
   - Provide a **Baseline Endpoint** that executes standard insert operations without idempotency checks (to demonstrate duplicate creation under race conditions).
   - Provide a **Protected Endpoint** that guarantees atomic, idempotent order processing.

2. **Duplicate Order Prevention**:
   - Recognize duplicate requests bearing an identical `Idempotency-Key`.
   - Safely return the cached/stored result of the original successful request without re-executing order creation logic.

3. **Payload Conflict Detection**:
   - Calculate request fingerprints (e.g. SHA-256 hash of normalized request payload).
   - If a request reuses an `Idempotency-Key` with a different payload fingerprint, reject the request with an HTTP 409 Conflict.

4. **Concurrency & Race Condition Handling**:
   - Use atomic database transaction boundaries and unique constraint enforcement on `idempotency_key`.
   - Prevent simultaneous concurrent requests with the same idempotency key from creating multiple database records.

5. **Decision Auditing & Visibility**:
   - Maintain an append-only `AuditLog` recording every request decision (e.g. `NEW_ORDER_CREATED`, `IDEMPOTENT_REPLAY`, `PAYLOAD_CONFLICT`, `RACE_LOCKED`).

6. **Workload Traffic Simulation**:
   - Configurable traffic generator capable of simulating client retries, double-click bursts, and concurrent tab submissions.

7. **System Metrics & Monitoring**:
   - Track total requests, unique operations, duplicates detected, duplicates prevented, conflicts, and baseline vs protected p50 latency metrics.

---

## 4. Non-Functional Requirements

- **Correctness**: Zero duplicate order insertions allowed through the protected service under any concurrency scenario.
- **Concurrency Safety**: Robust transaction isolation preventing race condition window exploits.
- **Low Latency Impact**: Idempotency check overhead must maintain low sub-millisecond lookup latency.
- **Auditability**: Complete traceability for every processed request.
- **Testability**: Fully automated unit and integration test coverage via `pytest`.
- **Maintainability**: Clean separation between FastAPI API controllers, services, database models, and React UI.

---

## 5. Success Criteria

- [x] **Baseline Validation**: Unprotected endpoints demonstrably allow duplicate order creation during retries or concurrent calls.
- [x] **Idempotent Protection**: Protected endpoint guarantees single-record execution per logical operation.
- [x] **Identical Replay**: Retrying with the same key returns the exact original HTTP status code and response body.
- [x] **Conflict Rejection**: Reusing a key with altered payload fields returns a 409 Conflict response.
- [x] **Legitimate Operations**: Distinct operations with unique keys are processed without interference.
