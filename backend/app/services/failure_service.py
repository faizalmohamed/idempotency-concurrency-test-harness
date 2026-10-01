import time
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Order
from app.services.audit_service import log_audit_event
from app.services.order_service import create_baseline_order

class ConnectionDropException(Exception):
    """Exception representing a simulated network connection drop before HTTP response."""
    pass

def inject_failure_if_configured(
    failure_type: Optional[str] = None,
    failure_rate_percent: float = 0.0,
    worker_index: int = 0
):
    """
    Deterministically or stochastically injects artificial failure modes during simulation testing.
    
    Modes:
    - TIMEOUT: Raises HTTPException(504 Gateway Timeout) to simulate unacknowledged client timeouts.
    - SERVER_ERROR: Raises HTTPException(500 Internal Server Error) to simulate mid-transaction errors.
    - CONNECTION_DROP: Raises ConnectionDropException to simulate socket drops.
    """
    if not failure_type or failure_type.lower() == "none" or failure_rate_percent <= 0:
        return

    # Deterministic trigger based on worker index and rate
    should_fail = ((worker_index + 1) * 17) % 100 < failure_rate_percent

    if not should_fail:
        return

    ft = failure_type.upper().strip()

    if ft == "TIMEOUT":
        time.sleep(0.1)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Simulated network timeout during order processing"
        )
    elif ft == "SERVER_ERROR":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Simulated internal server error during order processing"
        )
    elif ft == "CONNECTION_DROP":
        raise ConnectionDropException("Simulated socket connection drop mid-request")


def handle_legacy_client_fallback(
    db: Session,
    payload: Dict[str, Any],
    client_type: str = "legacy"
) -> Order:
    """
    Handles legacy clients that do not transmit `Idempotency-Key` headers.
    
    Executes baseline order creation and logs explicit `NEW_ORDER_CREATED_BASELINE` audit event
    annotated with legacy client fallback metadata.
    """
    order = create_baseline_order(db=db, payload=payload, client_type=client_type)
    
    log_audit_event(
        db=db,
        order_id=order.id,
        idempotency_key=None,
        decision_type="NEW_ORDER_CREATED_BASELINE",
        actor=client_type,
        details_dict={
            "fallback_reason": "Missing Idempotency-Key header on legacy client request",
            "order_reference": order.order_reference
        }
    )
    return order
