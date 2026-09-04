import os
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
