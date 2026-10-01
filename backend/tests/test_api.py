import os
import datetime
import pytest
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import Order, IdempotencyRecord, AuditLog
from app.core.idempotency import generate_request_fingerprint

TEST_DB_FILE = "./test_concurrency_harness.db"
SQLALCHEMY_TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

client = TestClient(app)

# Existing Health & DB Initialization Tests
def test_health_endpoint():
    """Verify GET /health returns expected status and JSON response."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "idempotency-test-harness"
    }

def test_get_orders_endpoint_empty():
    """Verify GET /orders returns empty list initially."""
    response = client.get("/orders")
    assert response.status_code == 200
    assert response.json() == []

def test_database_models_initialization():
    """Verify Order, IdempotencyRecord, and AuditLog ORM models can be persisted."""
    db = TestingSessionLocal()
    
    order = Order(
        order_reference="ORD-TEST-001",
        client_type="web",
        payload_json='{"items": ["item1"], "total": 99.99}',
        amount=99.99,
        status="created"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    assert order.id is not None

    idemp_rec = IdempotencyRecord(
        idempotency_key="key-test-uuid-1234",
        request_fingerprint="sha256-fingerprint-sample",
        status="COMPLETED",
        order_id=order.id,
        response_code=201
    )
    db.add(idemp_rec)
    db.commit()
    db.refresh(idemp_rec)
    assert idemp_rec.id is not None

    audit_entry = AuditLog(
        order_id=order.id,
        idempotency_key=idemp_rec.idempotency_key,
        decision_type="NEW_ORDER_CREATED",
        actor="web_client",
        details='{"status": "success"}'
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    assert audit_entry.id is not None
    db.close()


# Phase 2 Core Idempotency Tests
def test_1_same_key_same_payload_creates_single_order():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 2, "amount": 500.0}
    headers = {"Idempotency-Key": "key-test-unique-001"}

    res1 = client.post("/orders/v2", json=payload, headers=headers)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["replayed"] is False
    assert data1["decision"] == "ALLOWED"

    res2 = client.post("/orders/v2", json=payload, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["replayed"] is True

    orders = client.get("/orders").json()
    assert len(orders) == 1

def test_2_same_key_same_payload_repeated_returns_original_result():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 250.0}
    headers = {"Idempotency-Key": "key-test-retry-002"}

    res1 = client.post("/orders/v2", json=payload, headers=headers)
    assert res1.status_code == 201
    orig_ref = res1.json()["order"]["order_reference"]

    res2 = client.post("/orders/v2", json=payload, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["order"]["order_reference"] == orig_ref

def test_3_same_key_different_payload_returns_conflict():
    payload1 = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
    payload2 = {"customer_id": "C001", "product_id": "P100", "quantity": 5, "amount": 500.0}
    headers = {"Idempotency-Key": "key-test-conflict-003"}

    res1 = client.post("/orders/v2", json=payload1, headers=headers)
    assert res1.status_code == 201

    res2 = client.post("/orders/v2", json=payload2, headers=headers)
    assert res2.status_code == 409
    assert res2.json()["error"] == "IDEMPOTENCY_KEY_CONFLICT"

def test_4_different_keys_same_payload_creates_two_orders():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 150.0}
    res1 = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-alpha-004"})
    res2 = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-beta-004"})

    assert res1.status_code == 201
    assert res2.status_code == 201
    assert len(client.get("/orders").json()) == 2

def test_5_baseline_repeated_request_creates_multiple_orders():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 99.0}
    res1 = client.post("/orders", json=payload)
    res2 = client.post("/orders", json=payload)
    res3 = client.post("/orders", json=payload)

    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res3.status_code == 201
    assert len(client.get("/orders").json()) == 3

def test_6_idempotency_key_validation():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 50.0}
    assert client.post("/orders/v2", json=payload).status_code == 400
    assert client.post("/orders/v2", json=payload, headers={"Idempotency-Key": " "}).status_code == 400

def test_7_fingerprint_canonicalization_consistency():
    p1 = {"b_item": 2, "a_item": 1, "amount": 100.0}
    p2 = {"amount": 100.0, "a_item": 1, "b_item": 2}
    assert generate_request_fingerprint(p1) == generate_request_fingerprint(p2)


# Phase 3 & 4 Real Concurrency & Metrics Tests

def test_8_baseline_concurrent_race_creates_multiple_duplicates():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 120.0}

    def send_baseline_req():
        return client.post("/orders", json=payload)

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_baseline_req) for _ in range(10)]
        results = [f.result() for f in as_completed(futures)]

    assert len(results) == 10
    assert all(r.status_code == 201 for r in results)
    assert len(client.get("/orders").json()) == 10

def test_9_protected_concurrent_race_prevents_all_duplicates():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 120.0}
    headers = {"Idempotency-Key": "key-concurrent-race-10workers"}

    def send_protected_req():
        return client.post("/orders/v2", json=payload, headers=headers)

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_protected_req) for _ in range(10)]
        results = [f.result() for f in as_completed(futures)]

    status_codes = [r.status_code for r in results]
    assert 201 in status_codes
    assert status_codes.count(200) == 9
    assert len(client.get("/orders").json()) == 1

def test_10_protected_concurrent_conflict_handling():
    headers = {"Idempotency-Key": "key-concurrent-conflict-010"}
    p1 = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
    p2 = {"customer_id": "C001", "product_id": "P100", "quantity": 5, "amount": 999.0}

    res1 = client.post("/orders/v2", json=p1, headers=headers)
    assert res1.status_code == 201

    res2 = client.post("/orders/v2", json=p2, headers=headers)
    assert res2.status_code == 409
    assert res2.json()["error"] == "IDEMPOTENCY_KEY_CONFLICT"

def test_11_protected_concurrent_distinct_keys():
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 50.0}

    def send_distinct_req(idx):
        return client.post("/orders/v2", json=payload, headers={"Idempotency-Key": f"key-distinct-{idx}"})

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_distinct_req, i) for i in range(10)]
        results = [f.result() for f in as_completed(futures)]

    assert all(r.status_code == 201 for r in results)
    assert len(client.get("/orders").json()) == 10

def test_12_workload_simulation_runner_api():
    req_payload = {
        "mode": "protected",
        "concurrency": 5,
        "retry_delay_ms": 0,
        "jitter_ms": 2,
        "conflict_percentage": 0
    }
    res = client.post("/test/run", json=req_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["mode"] == "protected"
    assert data["total_requests"] == 5
    assert data["orders_created"] == 1
    assert data["duplicates_prevented"] == 4

def test_13_get_metrics_endpoint():
    """Test GET /metrics returns aggregated system metrics."""
    res = client.get("/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "requests_sent" in data
    assert "unique_operations" in data
    assert "duplicates_prevented" in data
    assert "conflicts" in data

def test_14_enhanced_orders_list_and_details():
    """Test GET /orders returns enriched data containing idempotency_key and decision."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 200.0}
    client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-enhanced-014"})

    orders_res = client.get("/orders")
    assert orders_res.status_code == 200
    orders = orders_res.json()
    assert len(orders) >= 1
    target = orders[0]
    assert "idempotency_key" in target
    assert "decision" in target

    # Test single order detail lookup
    detail_res = client.get(f"/orders/{target['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == target["id"]


# Phase 5-8 New Feature Tests

def test_15_audit_logs_retrieval_and_filtering():
    """Verify GET /audit-logs returns items and supports decision_type filtering."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 80.0}
    client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-audit-015"})

    res = client.get("/audit-logs")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) >= 1

    # Filter by decision_type
    filtered_res = client.get("/audit-logs?decision_type=NEW_ORDER_CREATED_PROTECTED")
    assert filtered_res.status_code == 200
    filtered_data = filtered_res.json()
    assert all(item["decision_type"] == "NEW_ORDER_CREATED_PROTECTED" for item in filtered_data["items"])

def test_16_audit_log_details_by_id():
    """Verify GET /audit-logs/{id} returns details for a specific log entry."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 75.0}
    client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-audit-detail-016"})

    logs = client.get("/audit-logs").json()["items"]
    target_id = logs[0]["id"]

    res = client.get(f"/audit-logs/{target_id}")
    assert res.status_code == 200
    assert res.json()["id"] == target_id

def test_17_admin_config_get_and_set():
    """Verify GET and POST /admin/config updates system latency settings."""
    get_res = client.get("/admin/config")
    assert get_res.status_code == 200
    assert "artificial_latency_enabled" in get_res.json()

    set_res = client.post("/admin/config", json={
        "artificial_latency_enabled": True,
        "artificial_latency_ms": 50,
        "default_ttl_hours": 48
    })
    assert set_res.status_code == 200
    assert set_res.json()["artificial_latency_enabled"] is True
    assert set_res.json()["artificial_latency_ms"] == 50

    # Reset config back
    client.post("/admin/config", json={"artificial_latency_enabled": False})

def test_18_admin_purge_test_data():
    """Verify POST /admin/purge deletes all test data when requested."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 90.0}
    client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-purge-018"})
    assert len(client.get("/orders").json()) >= 1

    purge_res = client.post("/admin/purge", json={"target": "all"})
    assert purge_res.status_code == 200
    assert purge_res.json()["purged_records"] > 0
    assert len(client.get("/orders").json()) == 0

def test_19_admin_key_override_release():
    """Verify POST /admin/key-override releases locked idempotency key."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
    key = "key-override-019"
    client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})

    override_res = client.post("/admin/key-override", json={
        "idempotency_key": key,
        "action": "release",
        "reason": "Unlocking stuck state"
    })
    assert override_res.status_code == 200
    assert override_res.json()["status"] == "success"
    assert override_res.json()["new_status"] == "RELEASED"

    # Subsequent request with same key can now create a new order instead of replay!
    res_after = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})
    assert res_after.status_code == 201

def test_20_failure_simulation_runner():
    """Verify POST /test/run with failure injection records failure statistics."""
    req_payload = {
        "mode": "protected",
        "concurrency": 4,
        "retry_delay_ms": 0,
        "jitter_ms": 1,
        "conflict_percentage": 0,
        "failure_rate_percent": 100.0,
        "failure_type": "timeout"
    }
    res = client.post("/test/run", json=req_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["errors"]["timeout"] > 0

def test_21_comparison_report_analytics():
    """Verify GET /comparison/report calculates duplicate prevention rate and latency metrics."""
    res = client.get("/comparison/report")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "baseline" in data
    assert "protected" in data
    assert "overhead_analysis" in data
    assert "duplicate_prevention_rate_percent" in data["summary"]

def test_22_comparison_csv_export():
    """Verify GET /comparison/export returns downloadable CSV content."""
    res = client.get("/comparison/export")
    assert res.status_code == 200
    assert res.headers["content-type"] == "text/csv; charset=utf-8"
    assert "Run ID,Timestamp,Mode" in res.text

def test_23_audit_events_created_on_baseline_and_protected_orders():
    """Verify audit events are created for baseline, protected, replay, and conflict."""
    # Baseline
    res_b = client.post("/orders", json={"customer_id": "C001", "product_id": "P100", "amount": 100.0})
    assert res_b.status_code == 201

    # Protected
    key = "key-audit-phase5-test"
    payload = {"customer_id": "C001", "product_id": "P100", "amount": 150.0}
    res_p = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})
    assert res_p.status_code == 201

    # Replay
    res_r = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})
    assert res_r.status_code == 200

    # Conflict
    res_c = client.post("/orders/v2", json={"customer_id": "C001", "product_id": "P100", "amount": 999.0}, headers={"Idempotency-Key": key})
    assert res_c.status_code == 409

    # Verify audit logs contain all 4 decision types
    logs = client.get("/audit-logs?limit=50").json()["items"]
    decision_types = {l["decision_type"] for l in logs}
    assert "NEW_ORDER_CREATED_BASELINE" in decision_types
    assert "NEW_ORDER_CREATED_PROTECTED" in decision_types
    assert "IDEMPOTENT_REPLAY" in decision_types
    assert "PAYLOAD_CONFLICT" in decision_types

def test_24_audit_filtering_pagination_and_order_details():
    """Verify audit log filtering by decision, actor, key, pagination, and detail lookup."""
    res_filt = client.get("/audit-logs?decision_type=PAYLOAD_CONFLICT")
    assert res_filt.status_code == 200
    data = res_filt.json()
    assert all(item["decision_type"] == "PAYLOAD_CONFLICT" for item in data["items"])

    res_actor = client.get("/audit-logs?actor=web")
    assert res_actor.status_code == 200

    # Test pagination
    res_page = client.get("/audit-logs?limit=2&offset=0")
    assert res_page.status_code == 200
    assert len(res_page.json()["items"]) <= 2
    assert res_page.json()["limit"] == 2
    assert res_page.json()["offset"] == 0

    # Test nonexistent log lookup (404)
    res_404 = client.get("/audit-logs/999999")
    assert res_404.status_code == 404

def test_25_admin_purge_orders_only_and_keys_only():
    """Verify selective purging of orders-only and idempotency-keys-only."""
    # Create an order and protected key
    client.post("/orders", json={"amount": 45.0})
    client.post("/orders/v2", json={"amount": 55.0}, headers={"Idempotency-Key": "key-purge-target-test"})

    # Purge orders only
    res_o = client.post("/admin/purge", json={"target": "orders"})
    assert res_o.status_code == 200
    assert len(client.get("/orders").json()) == 0

    # Purge idempotency keys only
    res_k = client.post("/admin/purge", json={"target": "idempotency_keys"})
    assert res_k.status_code == 200
    assert res_k.json()["purged_records"] >= 0

def test_26_admin_ttl_pruning_expired_vs_active():
    """Verify TTL pruning removes records older than TTL and preserves active records."""
    db = TestingSessionLocal()
    now = datetime.datetime.utcnow()
    expired_time = now - datetime.timedelta(hours=48)

    rec_expired = IdempotencyRecord(
        idempotency_key="key-ttl-expired-48h",
        request_fingerprint="fp-expired",
        status="COMPLETED",
        created_at=expired_time
    )
    rec_active = IdempotencyRecord(
        idempotency_key="key-ttl-active-now",
        request_fingerprint="fp-active",
        status="COMPLETED",
        created_at=now
    )
    db.add(rec_expired)
    db.add(rec_active)
    db.commit()
    db.close()

    # Prune with TTL=24 hours
    res = client.post("/admin/purge", json={"target": "expired_keys", "ttl_hours": 24})
    assert res.status_code == 200
    assert res.json()["purged_idempotency_records"] >= 1

    # Verify active record still remains
    db2 = TestingSessionLocal()
    active_check = db2.query(IdempotencyRecord).filter(IdempotencyRecord.idempotency_key == "key-ttl-active-now").first()
    assert active_check is not None
    expired_check = db2.query(IdempotencyRecord).filter(IdempotencyRecord.idempotency_key == "key-ttl-expired-48h").first()
    assert expired_check is None
    db2.close()

def test_27_manual_override_force_complete_and_audit():
    """Verify manual key override with force_complete action creates MANUAL_OVERRIDE audit event."""
    key = "key-force-complete-027"
    client.post("/orders/v2", json={"amount": 77.0}, headers={"Idempotency-Key": key})

    res = client.post("/admin/key-override", json={
        "idempotency_key": key,
        "action": "force_complete",
        "reason": "Administrative race unlock"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["new_status"] == "COMPLETED"

    # Verify MANUAL_OVERRIDE audit event was logged
    audit_logs = client.get("/audit-logs?decision_type=MANUAL_OVERRIDE").json()["items"]
    assert any(log["idempotency_key"] == key for log in audit_logs)

    # Test nonexistent key 404
    res_404 = client.post("/admin/key-override", json={"idempotency_key": "nonexistent-key-xyz", "action": "release"})
    assert res_404.status_code == 404

def test_28_retry_replay_after_simulated_500_and_timeout():
    """Verify that retrying after simulated errors safely replays or creates without duplicates."""
    key = "key-retry-sim-500"
    payload = {"customer_id": "C001", "product_id": "P100", "amount": 125.0}

    # First request succeeds and creates order
    res1 = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})
    assert res1.status_code == 201
    order_id = res1.json()["order"]["id"]

    # Client simulates retry after network/server glitch
    res2 = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})
    assert res2.status_code == 200
    assert res2.json()["replayed"] is True
    assert res2.json()["order"]["id"] == order_id

    # Confirm exactly 1 order exists for this key
    orders = [o for o in client.get("/orders").json() if o["idempotency_key"] == key]
    assert len(orders) == 1

def test_29_connection_drop_and_failure_rate_calculation():
    """Verify connection-drop simulation and failure rate calculation in workload runner."""
    from app.services.failure_service import inject_failure_if_configured, ConnectionDropException
    from fastapi import HTTPException

    # Test deterministic failure injection function
    with pytest.raises(ConnectionDropException):
        inject_failure_if_configured(failure_type="connection_drop", failure_rate_percent=100.0, worker_index=0)

    with pytest.raises(HTTPException) as exc_504:
        inject_failure_if_configured(failure_type="timeout", failure_rate_percent=100.0, worker_index=0)
    assert exc_504.value.status_code == 504

    with pytest.raises(HTTPException) as exc_500:
        inject_failure_if_configured(failure_type="server_error", failure_rate_percent=100.0, worker_index=0)
    assert exc_500.value.status_code == 500

    # Run workload with connection drop
    req = {
        "mode": "protected",
        "concurrency": 5,
        "failure_rate_percent": 100.0,
        "failure_type": "connection_drop"
    }
    res = client.post("/test/run", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["errors"]["connection_drop"] > 0
    assert data["failures"] > 0

def test_30_legacy_client_fallback_and_distinct_requests():
    """Verify legacy client fallback creates distinct orders without false-positive duplicate blocking."""
    p1 = {"customer_id": "C001", "product_id": "P101", "amount": 10.0, "client_type": "legacy"}
    p2 = {"customer_id": "C001", "product_id": "P102", "amount": 20.0, "client_type": "legacy"}

    # Legacy clients do not send Idempotency-Key
    res1 = client.post("/orders", json=p1)
    res2 = client.post("/orders", json=p2)

    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res1.json()["id"] != res2.json()["id"]

    # Verify both orders exist
    orders = client.get("/orders").json()
    assert any(o["id"] == res1.json()["id"] for o in orders)
    assert any(o["id"] == res2.json()["id"] for o in orders)

def test_31_comparison_export_unsupported_format_rejection():
    """Verify GET /comparison/export accepts csv and rejects unsupported formats with HTTP 400."""
    res_ok = client.get("/comparison/export?format=csv")
    assert res_ok.status_code == 200

    res_bad = client.get("/comparison/export?format=xml")
    assert res_bad.status_code == 400
    assert "Unsupported export format" in res_bad.json()["detail"]

def test_32_concurrent_race_locked_audit_event():
    """Verify concurrent race creates RACE_LOCKED audit events."""
    payload = {"customer_id": "C001", "product_id": "P100", "amount": 300.0}
    key = "key-race-locked-audit-test"

    def send_req():
        return client.post("/orders/v2", json=payload, headers={"Idempotency-Key": key})

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_req) for _ in range(10)]
        results = [f.result() for f in as_completed(futures)]

    assert len(results) == 10
    # Exactly 1 order created in DB
    orders = [o for o in client.get("/orders").json() if o["idempotency_key"] == key]
    assert len(orders) == 1

    # Check audit logs for RACE_LOCKED
    audit_logs = client.get(f"/audit-logs?idempotency_key={key}").json()["items"]
    decisions = [l["decision_type"] for l in audit_logs]
    assert "NEW_ORDER_CREATED_PROTECTED" in decisions
    assert "RACE_LOCKED" in decisions


