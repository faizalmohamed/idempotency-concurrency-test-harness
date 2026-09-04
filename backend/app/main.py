from typing import List, Optional
from fastapi import FastAPI, Depends, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models import Order, IdempotencyRecord, AuditLog
from app.schemas import (
    HealthResponse,
    OrderResponse,
    EnhancedOrderResponse,
    OrderCreate,
    ProtectedOrderResponse,
    ConflictErrorResponse,
    WorkloadTestRequest,
    WorkloadTestResponse,
    SystemMetricsResponse
)
from app.core.idempotency import validate_idempotency_key
from app.services.order_service import create_baseline_order, create_protected_order
from app.services.workload_service import run_workload_simulation, calculate_system_metrics, WORKLOAD_HISTORY

# Initialize database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Idempotency & Concurrency Test Harness",
    description="Engine for baseline vs protected idempotent order operations and workload simulation",
    version="1.0.0"
)

# Enable CORS for React frontend cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse, tags=["System"])
def health_check():
    """Health check endpoint required by system specification."""
    return {
        "status": "ok",
        "service": "idempotency-test-harness"
    }

@app.get("/metrics", response_model=SystemMetricsResponse, tags=["Metrics"])
def get_system_metrics(db: Session = Depends(get_db)):
    """Fetch dynamically aggregated system statistics across database orders and simulation runs."""
    return calculate_system_metrics(db)

@app.get("/orders", response_model=List[EnhancedOrderResponse], tags=["Orders"])
def get_orders(db: Session = Depends(get_db)):
    """Fetch list of all stored orders with idempotency metadata and duplicate tags."""
    orders = db.query(Order).order_by(Order.id.desc()).all()
    enhanced_orders = []

    for ord_obj in orders:
        # Check associated idempotency record or audit log
        idemp_rec = db.query(IdempotencyRecord).filter(IdempotencyRecord.order_id == ord_obj.id).first()
        audit_rec = db.query(AuditLog).filter(AuditLog.order_id == ord_obj.id).first()

        idemp_key = idemp_rec.idempotency_key if idemp_rec else (audit_rec.idempotency_key if audit_rec else None)
        decision = audit_rec.decision_type if audit_rec else ("ALLOWED" if idemp_rec else "BASELINE_UNPROTECTED")
        
        # Mark as duplicate if baseline unprotected or audit log indicates baseline creation
        is_dup = ord_obj.order_reference.startswith("ORD-BASE-") and ord_obj.id > 1

        enhanced_orders.append({
            "id": ord_obj.id,
            "order_reference": ord_obj.order_reference,
            "client_type": ord_obj.client_type,
            "amount": ord_obj.amount,
            "status": ord_obj.status,
            "payload_json": ord_obj.payload_json,
            "created_at": ord_obj.created_at,
            "idempotency_key": idemp_key,
            "decision": decision,
            "is_duplicate": is_dup
        })

    return enhanced_orders

@app.get("/orders/{order_id}", response_model=EnhancedOrderResponse, tags=["Orders"])
def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    """Fetch enriched order details by ID."""
    ord_obj = db.query(Order).filter(Order.id == order_id).first()
    if not ord_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found"
        )
    
    idemp_rec = db.query(IdempotencyRecord).filter(IdempotencyRecord.order_id == ord_obj.id).first()
    audit_rec = db.query(AuditLog).filter(AuditLog.order_id == ord_obj.id).first()

    idemp_key = idemp_rec.idempotency_key if idemp_rec else (audit_rec.idempotency_key if audit_rec else None)
    decision = audit_rec.decision_type if audit_rec else ("ALLOWED" if idemp_rec else "BASELINE_UNPROTECTED")
    is_dup = ord_obj.order_reference.startswith("ORD-BASE-") and ord_obj.id > 1

    return {
        "id": ord_obj.id,
        "order_reference": ord_obj.order_reference,
        "client_type": ord_obj.client_type,
        "amount": ord_obj.amount,
        "status": ord_obj.status,
        "payload_json": ord_obj.payload_json,
        "created_at": ord_obj.created_at,
        "idempotency_key": idemp_key,
        "decision": decision,
        "is_duplicate": is_dup
    }

@app.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, tags=["Orders"])
def post_baseline_order(
    payload: OrderCreate,
    db: Session = Depends(get_db)
):
    """
    Baseline Endpoint (Unprotected Control Group).
    
    Creates a new order on every request without idempotency protection.
    """
    order = create_baseline_order(
        db=db,
        payload=payload.model_dump(),
        client_type=payload.client_type or "web"
    )
    return order

@app.post(
    "/orders/v2",
    response_model=ProtectedOrderResponse,
    responses={
        400: {"description": "Missing or invalid Idempotency-Key header"},
        409: {"model": ConflictErrorResponse, "description": "Idempotency key reuse conflict"}
    },
    tags=["Orders"]
)
def post_protected_order(
    payload: OrderCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db)
):
    """
    Protected Endpoint (Idempotent Implementation).
    
    Requires an `Idempotency-Key` header. Protects against duplicate creation using
    SHA-256 fingerprinting, atomic transactions, and transactional unique key constraints.
    """
    # 1. Validate Idempotency-Key header requirement
    is_valid, err_msg = validate_idempotency_key(idempotency_key)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )

    # 2. Execute protected order creation logic
    order, decision, key, replayed, status_code = create_protected_order(
        db=db,
        payload=payload.model_dump(),
        idempotency_key=idempotency_key,
        client_type=payload.client_type or "web"
    )

    # 3. Handle conflict scenario (409 Conflict)
    if status_code == 409:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": "IDEMPOTENCY_KEY_CONFLICT",
                "decision": "BLOCKED_AS_CONFLICT",
                "message": f"Idempotency-Key '{idempotency_key}' reuse detected with non-matching payload fingerprint"
            }
        )

    # 4. Return successful order response
    return JSONResponse(
        status_code=status_code,
        content={
            "order": {
                "id": order.id,
                "order_reference": order.order_reference,
                "client_type": order.client_type,
                "amount": order.amount,
                "status": order.status,
                "payload_json": order.payload_json,
                "created_at": order.created_at.isoformat()
            } if order else None,
            "decision": decision,
            "idempotency_key": key,
            "replayed": replayed
        }
    )

# Phase 3 & 4 Workload & Concurrency Test Runner APIs

@app.post("/test/run", response_model=WorkloadTestResponse, tags=["Concurrency Simulator"])
def run_concurrency_test(
    config: WorkloadTestRequest,
    db: Session = Depends(get_db)
):
    """
    Triggers a multi-threaded concurrency workload simulation.
    
    Fires `concurrency` parallel worker threads simultaneously against baseline or protected endpoints.
    Calculates actual measured latency metrics (p50, p95) and duplicate prevention counts.
    """
    result = run_workload_simulation(
        db=db,
        mode=config.mode.lower(),
        concurrency=config.concurrency,
        retry_delay_ms=config.retry_delay_ms,
        jitter_ms=config.jitter_ms,
        conflict_percentage=config.conflict_percentage
    )
    return result

@app.get("/test/results", response_model=List[WorkloadTestResponse], tags=["Concurrency Simulator"])
def get_concurrency_test_results():
    """Retrieve historical concurrency workload test run results."""
    return WORKLOAD_HISTORY
