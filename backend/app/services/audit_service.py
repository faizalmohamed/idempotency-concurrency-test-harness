import json
import datetime
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import AuditLog, Order

VALID_DECISION_TYPES = {
    "NEW_ORDER_CREATED_BASELINE",
    "NEW_ORDER_CREATED_PROTECTED",
    "IDEMPOTENT_REPLAY",
    "PAYLOAD_CONFLICT",
    "RACE_LOCKED",
    "MANUAL_OVERRIDE"
}

def log_audit_event(
    db: Session,
    order_id: Optional[int],
    idempotency_key: Optional[str],
    decision_type: str,
    actor: str = "web_client",
    details_dict: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Appends an immutable AuditLog entry to the database.
    """
    details_json = json.dumps(details_dict, sort_keys=True) if details_dict else None

    audit_entry = AuditLog(
        timestamp=datetime.datetime.utcnow(),
        order_id=order_id,
        idempotency_key=idempotency_key,
        decision_type=decision_type,
        actor=actor,
        details=details_json
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry


def get_audit_logs(
    db: Session,
    limit: int = 50,
    offset: int = 0,
    order_id: Optional[int] = None,
    idempotency_key: Optional[str] = None,
    decision_type: Optional[str] = None,
    actor: Optional[str] = None
) -> Tuple[List[AuditLog], int]:
    """
    Queries audit logs with filtering, pagination, total count, and newest-first ordering.
    """
    query = db.query(AuditLog)

    if order_id is not None:
        query = query.filter(AuditLog.order_id == order_id)
    if idempotency_key is not None and idempotency_key.strip():
        query = query.filter(AuditLog.idempotency_key.ilike(f"%{idempotency_key.strip()}%"))
    if decision_type is not None and decision_type.strip() and decision_type.upper() != "ALL":
        dt_upper = decision_type.strip().upper()
        # Map friendly filter values if needed
        if dt_upper == "NEW ORDER":
            query = query.filter(AuditLog.decision_type.in_(["NEW_ORDER_CREATED_BASELINE", "NEW_ORDER_CREATED_PROTECTED"]))
        elif dt_upper == "REPLAY":
            query = query.filter(AuditLog.decision_type == "IDEMPOTENT_REPLAY")
        elif dt_upper == "CONFLICT":
            query = query.filter(AuditLog.decision_type == "PAYLOAD_CONFLICT")
        elif dt_upper == "RACE LOCK":
            query = query.filter(AuditLog.decision_type == "RACE_LOCKED")
        elif dt_upper == "MANUAL OVERRIDE":
            query = query.filter(AuditLog.decision_type == "MANUAL_OVERRIDE")
        else:
            query = query.filter(AuditLog.decision_type == dt_upper)

    if actor is not None and actor.strip() and actor.lower() != "all":
        query = query.filter(AuditLog.actor.ilike(f"%{actor.strip()}%"))

    total = query.count()
    items = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()

    return items, total
