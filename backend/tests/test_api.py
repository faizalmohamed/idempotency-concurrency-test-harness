import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import Order, IdempotencyRecord, AuditLog
from app.core.idempotency import generate_request_fingerprint

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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


# Phase 2 Specific Tests (Tests 1 through 7)

def test_1_same_key_same_payload_creates_single_order():
    """Test 1: Submitting same key + same payload twice results in only 1 database order."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 2, "amount": 500.0}
    headers = {"Idempotency-Key": "key-test-unique-001"}

    # Request 1
    res1 = client.post("/orders/v2", json=payload, headers=headers)
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["replayed"] is False
    assert data1["decision"] == "ALLOWED"
    first_order_id = data1["order"]["id"]

    # Request 2 (Retry)
    res2 = client.post("/orders/v2", json=payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()

    # Verify only 1 order exists in database
    orders_res = client.get("/orders")
    orders = orders_res.json()
    assert len(orders) == 1
    assert orders[0]["id"] == first_order_id


def test_2_same_key_same_payload_repeated_returns_original_result():
    """Test 2: Submitting same key + same payload repeatedly returns original result with replayed=True."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 250.0}
    headers = {"Idempotency-Key": "key-test-retry-002"}

    # Initial POST
    res1 = client.post("/orders/v2", json=payload, headers=headers)
    assert res1.status_code == 201
    orig_order_ref = res1.json()["order"]["order_reference"]

    # Repeated POST 1
    res2 = client.post("/orders/v2", json=payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["replayed"] is True
    assert data2["decision"] == "RETRIED_AND_MATCHED"
    assert data2["order"]["order_reference"] == orig_order_ref

    # Repeated POST 2
    res3 = client.post("/orders/v2", json=payload, headers=headers)
    assert res3.status_code == 200
    assert res3.json()["replayed"] is True


def test_3_same_key_different_payload_returns_conflict():
    """Test 3: Reusing idempotency key with a different payload returns HTTP 409 Conflict."""
    payload1 = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
    payload2 = {"customer_id": "C001", "product_id": "P100", "quantity": 5, "amount": 500.0} # Altered quantity/amount
    headers = {"Idempotency-Key": "key-test-conflict-003"}

    # First request
    res1 = client.post("/orders/v2", json=payload1, headers=headers)
    assert res1.status_code == 201

    # Second request with altered payload
    res2 = client.post("/orders/v2", json=payload2, headers=headers)
    assert res2.status_code == 409
    data2 = res2.json()
    assert data2["error"] == "IDEMPOTENCY_KEY_CONFLICT"
    assert data2["decision"] == "BLOCKED_AS_CONFLICT"


def test_4_different_keys_same_payload_creates_two_orders():
    """Test 4: Submitting same payload with different keys creates two legitimate distinct orders."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 150.0}

    res1 = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-alpha-004"})
    res2 = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "key-beta-004"})

    assert res1.status_code == 201
    assert res2.status_code == 201

    orders_res = client.get("/orders")
    assert len(orders_res.json()) == 2


def test_5_baseline_repeated_request_creates_multiple_orders():
    """Test 5: Unprotected baseline endpoint creates duplicate orders on every request (control group)."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 99.0}

    res1 = client.post("/orders", json=payload)
    res2 = client.post("/orders", json=payload)
    res3 = client.post("/orders", json=payload)

    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res3.status_code == 201

    orders = client.get("/orders").json()
    assert len(orders) == 3


def test_6_idempotency_key_validation():
    """Test 6: Missing or invalid Idempotency-Key header returns HTTP 400 Bad Request."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 50.0}

    # Missing header
    res_missing = client.post("/orders/v2", json=payload)
    assert res_missing.status_code == 400
    assert "missing" in res_missing.json()["detail"].lower()

    # Empty string key
    res_empty = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": "   "})
    assert res_empty.status_code == 400
    assert "cannot be empty" in res_empty.json()["detail"].lower()

    # Overly long key (>128 chars)
    long_key = "k" * 129
    res_long = client.post("/orders/v2", json=payload, headers={"Idempotency-Key": long_key})
    assert res_long.status_code == 400
    assert "exceeds maximum length" in res_long.json()["detail"].lower()


def test_7_fingerprint_canonicalization_consistency():
    """Test 7: SHA-256 fingerprint remains consistent across different key orderings in JSON."""
    payload_a = {"b_item": 2, "a_item": 1, "amount": 100.0}
    payload_b = {"amount": 100.0, "a_item": 1, "b_item": 2}

    fp_a = generate_request_fingerprint(payload_a)
    fp_b = generate_request_fingerprint(payload_b)

    assert fp_a == fp_b
    assert len(fp_a) == 64  # Valid SHA-256 hex string


def test_get_order_by_id_endpoint():
    """Verify GET /orders/{id} returns details for existing order and 404 for missing."""
    payload = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 75.0}
    created_res = client.post("/orders", json=payload)
    order_id = created_res.json()["id"]

    # Fetch created order
    get_res = client.get(f"/orders/{order_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == order_id

    # Fetch non-existent order
    missing_res = client.get("/orders/99999")
    assert missing_res.status_code == 404
