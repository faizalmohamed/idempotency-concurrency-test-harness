import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import Order, IdempotencyRecord, AuditLog

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
    
    # Create test order
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
    assert order.order_reference == "ORD-TEST-001"

    # Create test idempotency record
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
    assert idemp_rec.idempotency_key == "key-test-uuid-1234"

    # Create test audit log
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
    assert audit_entry.decision_type == "NEW_ORDER_CREATED"

    db.close()
