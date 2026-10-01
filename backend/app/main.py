from typing import List, Optional
from fastapi import FastAPI, Depends, Header, HTTPException, status, Query, Response
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
    SystemMetricsResponse,
    AuditLogSchema,
    AuditLogListResponse,
    AdminPurgeRequest,
    AdminPurgeResponse,
    AdminKeyOverrideRequest,
    AdminKeyOverrideResponse,
    AdminConfigRequest
)
from app.core.idempotency import validate_idempotency_key
from app.services.order_service import create_baseline_order, create_protected_order
from app.services.workload_service import run_workload_simulation, calculate_system_metrics, WORKLOAD_HISTORY
from app.services.audit_service import get_audit_logs, log_audit_event
from app.services.admin_service import (
    purge_all_test_data,
    manual_key_override,
    get_admin_config,
    set_admin_config
)
from app.services.comparison_service import generate_comparison_report, generate_csv_export

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

# Phase 5 Audit Trail & History APIs

@app.get("/audit-logs", response_model=AuditLogListResponse, tags=["Audit Trail"])
def get_audit_trail_logs(
    decision_type: Optional[str] = Query(None, description="Filter by decision type"),
    idempotency_key: Optional[str] = Query(None, description="Filter by idempotency key"),
    order_id: Optional[int] = Query(None, description="Filter by order ID"),
    actor: Optional[str] = Query(None, description="Filter by actor/client type"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Retrieve filtered, paginated audit logs for state changes, conflict detections, and overrides."""
    items, total = get_audit_logs(
        db=db,
        decision_type=decision_type,
        idempotency_key=idempotency_key,
        order_id=order_id,
        actor=actor,
        limit=limit,
        offset=offset
    )
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@app.get("/audit-logs/{log_id}", response_model=AuditLogSchema, tags=["Audit Trail"])
def get_audit_log_by_id(log_id: int, db: Session = Depends(get_db)):
    """Retrieve details for a specific audit log record by ID."""
    log_entry = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log entry with ID {log_id} not found"
        )
    return log_entry

# Phase 6 Admin Controls & Purge APIs

@app.post("/admin/purge", response_model=AdminPurgeResponse, tags=["Admin Controls"])
def purge_test_data(
    req: AdminPurgeRequest,
    db: Session = Depends(get_db)
):
    """Safely purge test data (all records, orders, idempotency keys, or expired keys)."""
    res = purge_all_test_data(db=db, target=req.target, ttl_hours=req.ttl_hours or 24)
    return res

@app.post("/admin/key-override", response_model=AdminKeyOverrideResponse, tags=["Admin Controls"])
def override_idempotency_key(
    req: AdminKeyOverrideRequest,
    db: Session = Depends(get_db)
):
    """Manually release or completion-override a locked idempotency key."""
    res = manual_key_override(
        db=db,
        idempotency_key=req.idempotency_key,
        action=req.action,
        reason=req.reason or "Manual administrative override"
    )
    if res.get("status") == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res["message"])
    return res

@app.get("/admin/config", tags=["Admin Controls"])
def fetch_admin_configuration():
    """Retrieve current global system configuration settings (latency, default TTL)."""
    return get_admin_config()

@app.post("/admin/config", tags=["Admin Controls"])
def update_admin_configuration(req: AdminConfigRequest):
    """Update global system configuration settings."""
    return set_admin_config(
        artificial_latency_enabled=req.artificial_latency_enabled,
        artificial_latency_ms=req.artificial_latency_ms,
        default_ttl_hours=req.default_ttl_hours
    )

# Phase 3 & 4 & 7 Workload & Concurrency Test Runner APIs

@app.post("/test/run", response_model=WorkloadTestResponse, tags=["Concurrency Simulator"])
def run_concurrency_test(
    config: WorkloadTestRequest,
    db: Session = Depends(get_db)
):
    """
    Triggers a multi-threaded concurrency workload simulation.
    
    Fires `concurrency` parallel worker threads simultaneously against baseline or protected endpoints.
    Supports failure injection, legacy client simulation, and conflict injection.
    """
    result = run_workload_simulation(
        db=db,
        mode=config.mode.lower(),
        concurrency=config.concurrency,
        retry_delay_ms=config.retry_delay_ms,
        jitter_ms=config.jitter_ms,
        conflict_percentage=config.conflict_percentage,
        client_type=config.client_type or "web",
        custom_payload=config.custom_payload,
        failure_rate_percent=config.failure_rate_percent or 0.0,
        failure_type=config.failure_type or "none",
        legacy_client_percentage=config.legacy_client_percentage or 0.0
    )
    return result

@app.get("/test/results", response_model=List[WorkloadTestResponse], tags=["Concurrency Simulator"])
def get_concurrency_test_results():
    """Retrieve historical concurrency workload test run results."""
    return WORKLOAD_HISTORY

# Phase 8 Comparison & Reporting APIs

@app.get("/comparison/report", tags=["Reporting & Comparison"])
def get_comparison_analytics(db: Session = Depends(get_db)):
    """Generate comprehensive comparison analytics between Baseline and Protected test runs."""
    return generate_comparison_report(db)

@app.get("/comparison/export", tags=["Reporting & Comparison"])
def export_comparison_csv(
    format: str = Query("csv", description="Export format: 'csv'"),
    db: Session = Depends(get_db)
):
    """Export benchmark test results as downloadable CSV data."""
    if format.lower() != "csv":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format '{format}'. Supported formats: 'csv'"
        )
    csv_content = generate_csv_export(db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=idempotency_benchmark_results.csv"
        }
    )

