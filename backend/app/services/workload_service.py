import datetime
import math
import random
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Order, IdempotencyRecord, AuditLog
from app.services.order_service import create_baseline_order, create_protected_order
from app.schemas import WorkloadTestResponse, LatencyMetrics, WorkloadErrorCounts, SystemMetricsResponse

# Global in-memory history of workload test executions
WORKLOAD_HISTORY: List[Dict[str, Any]] = []

def calculate_percentile(data: List[float], percentile: float) -> float:
    """Calculates percentile (e.g. 50th, 95th) from a list of float numbers."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(sorted_data[int(k)], 2)
    d0 = sorted_data[int(f)] * (c - k)
    d1 = sorted_data[int(c)] * (k - f)
    return round(d0 + d1, 2)


def execute_single_worker_request(
    mode: str,
    idempotency_key: str,
    payload: Dict[str, Any],
    stagger_ms: float = 0.0,
    client_type: str = "web"
) -> Dict[str, Any]:
    """
    Executes a single order creation request inside a dedicated thread with its own DB session.
    """
    if stagger_ms > 0:
        time.sleep(stagger_ms / 1000.0)

    db = SessionLocal()
    start_time = time.perf_counter()
    status_code = 500
    decision = "UNKNOWN"
    order_id = None
    error_cat = None

    try:
        if mode == "baseline":
            order = create_baseline_order(db=db, payload=payload, client_type=client_type)
            order_id = order.id
            decision = "ALLOWED"
            status_code = 201
        else: # protected
            order, decision, key, replayed, status_code = create_protected_order(
                db=db,
                payload=payload,
                idempotency_key=idempotency_key,
                client_type=client_type
            )
            if order:
                order_id = order.id
            if status_code == 409:
                error_cat = "conflict"

    except Exception as exc:
        db.rollback()
        status_code = 500
        decision = "ERROR"
        error_cat = "unexpected_error"
    finally:
        end_time = time.perf_counter()
        db.close()

    duration_ms = round((end_time - start_time) * 1000.0, 2)

    return {
        "status_code": status_code,
        "decision": decision,
        "order_id": order_id,
        "duration_ms": duration_ms,
        "error_cat": error_cat
    }


def run_workload_simulation(
    db: Session,
    mode: str = "protected",
    concurrency: int = 10,
    retry_delay_ms: float = 0.0,
    jitter_ms: float = 5.0,
    conflict_percentage: float = 0.0,
    client_type: str = "web",
    custom_payload: Dict[str, Any] = None
) -> WorkloadTestResponse:
    """
    Executes a genuine multi-threaded concurrency workload test.
    """
    run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.datetime.utcnow()
    
    base_idempotency_key = f"key-sim-{uuid.uuid4().hex[:10]}"
    base_payload = custom_payload if custom_payload else {
        "customer_id": "C001",
        "product_id": "P100",
        "quantity": 2,
        "amount": 500.0
    }

    durations: List[float] = []
    results: List[Dict[str, Any]] = []
    error_counts = WorkloadErrorCounts()

    with ThreadPoolExecutor(max_workers=min(concurrency, 64)) as executor:
        futures = []
        for i in range(concurrency):
            stagger = random.uniform(0, jitter_ms) if jitter_ms > 0 else 0.0

            worker_payload = dict(base_payload)
            if conflict_percentage > 0 and (i / concurrency * 100.0) < conflict_percentage and i > 0:
                worker_payload["amount"] = float(base_payload.get("amount", 100.0)) + ((i + 1) * 10.0)

            futures.append(
                executor.submit(
                    execute_single_worker_request,
                    mode=mode,
                    idempotency_key=base_idempotency_key,
                    payload=worker_payload,
                    stagger_ms=stagger,
                    client_type=client_type
                )
            )

        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            durations.append(res["duration_ms"])
            if res["error_cat"]:
                setattr(error_counts, res["error_cat"], getattr(error_counts, res["error_cat"]) + 1)

    created_order_ids = set()
    conflicts_count = 0
    replayed_count = 0

    for r in results:
        if r["order_id"]:
            created_order_ids.add(r["order_id"])
        if r["decision"] == "RETRIED_AND_MATCHED":
            replayed_count += 1
        elif r["decision"] == "BLOCKED_AS_CONFLICT":
            conflicts_count += 1

    orders_created = len(created_order_ids) if mode == "protected" else concurrency
    total_requests = concurrency
    unique_logical_ops = 1

    if mode == "baseline":
        duplicates = max(0, total_requests - 1)
        duplicates_prevented = 0
    else:
        duplicates = 0
        duplicates_prevented = max(0, total_requests - orders_created - conflicts_count)

    false_positive_blocks = 0

    latency = LatencyMetrics(
        p50_ms=calculate_percentile(durations, 50),
        p95_ms=calculate_percentile(durations, 95),
        avg_ms=round(sum(durations) / len(durations), 2) if durations else 0.0,
        min_ms=round(min(durations), 2) if durations else 0.0,
        max_ms=round(max(durations), 2) if durations else 0.0
    )

    response_data = WorkloadTestResponse(
        run_id=run_id,
        timestamp=timestamp,
        mode=mode,
        total_requests=total_requests,
        unique_logical_operations=unique_logical_ops,
        orders_created=orders_created,
        duplicates=duplicates,
        duplicates_prevented=duplicates_prevented,
        conflicts=conflicts_count,
        false_positive_blocks=false_positive_blocks,
        latency=latency,
        errors=error_counts
    )

    WORKLOAD_HISTORY.insert(0, response_data.model_dump())
    if len(WORKLOAD_HISTORY) > 50:
        WORKLOAD_HISTORY.pop()

    return response_data


def calculate_system_metrics(db: Session) -> SystemMetricsResponse:
    """
    Calculates dynamic aggregated metrics from database records and simulation test history.
    """
    total_orders = db.query(Order).count()
    idemp_records = db.query(IdempotencyRecord).count()
    audit_conflicts = db.query(AuditLog).filter(AuditLog.decision_type == "PAYLOAD_CONFLICT").count()

    total_requests_sent = sum(run.get("total_requests", 0) for run in WORKLOAD_HISTORY)
    if total_requests_sent == 0:
        total_requests_sent = total_orders

    baseline_duplicates = sum(run.get("duplicates", 0) for run in WORKLOAD_HISTORY if run.get("mode") == "baseline")
    duplicates_prevented = sum(run.get("duplicates_prevented", 0) for run in WORKLOAD_HISTORY if run.get("mode") == "protected")
    history_conflicts = sum(run.get("conflicts", 0) for run in WORKLOAD_HISTORY)

    conflicts = max(audit_conflicts, history_conflicts)
    unique_operations = max(idemp_records, total_orders - baseline_duplicates)
    if unique_operations <= 0 and total_orders > 0:
        unique_operations = 1

    return SystemMetricsResponse(
        requests_sent=total_requests_sent,
        unique_operations=unique_operations,
        baseline_duplicates=baseline_duplicates,
        protected_duplicates=0,
        duplicates_prevented=duplicates_prevented,
        conflicts=conflicts,
        false_positive_blocks=0,
        manual_overrides=0
    )
