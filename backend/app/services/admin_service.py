import datetime
import json
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models import Order, IdempotencyRecord, AuditLog
from app.services.audit_service import log_audit_event

# Global in-memory admin configuration settings
ADMIN_CONFIG: Dict[str, Any] = {
    "artificial_latency_enabled": False,
    "artificial_latency_ms": 100,
    "default_ttl_hours": 24
}

def get_admin_config() -> Dict[str, Any]:
    """Returns current admin configuration settings."""
    return dict(ADMIN_CONFIG)

def set_admin_config(
    artificial_latency_enabled: Optional[bool] = None,
    artificial_latency_ms: Optional[int] = None,
    default_ttl_hours: Optional[int] = None
) -> Dict[str, Any]:
    """Updates admin configuration settings with validation."""
    if artificial_latency_enabled is not None:
        ADMIN_CONFIG["artificial_latency_enabled"] = bool(artificial_latency_enabled)
    if artificial_latency_ms is not None:
        ADMIN_CONFIG["artificial_latency_ms"] = max(0, min(5000, int(artificial_latency_ms)))
    if default_ttl_hours is not None:
        ADMIN_CONFIG["default_ttl_hours"] = max(1, min(720, int(default_ttl_hours)))
    return dict(ADMIN_CONFIG)


def purge_expired_idempotency_records(db: Session, ttl_hours: int = 24) -> int:
    """
    Deletes idempotency records older than the specified TTL hours.
    """
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=ttl_hours)
    expired_query = db.query(IdempotencyRecord).filter(
        IdempotencyRecord.created_at < cutoff
    )
    count = expired_query.count()
    expired_query.delete(synchronize_session=False)
    db.commit()
    return count


def purge_all_test_data(db: Session, target: str = "all", ttl_hours: int = 24) -> Dict[str, Any]:
    """
    Safely purges test data respecting database foreign key constraints.
    """
    target = target.lower().strip()
    purged_orders = 0
    purged_idemp = 0
    purged_audit = 0

    if target in ("all", "idempotency_keys", "expired_keys"):
        if target == "expired_keys":
            purged_idemp = purge_expired_idempotency_records(db, ttl_hours=ttl_hours)
        else:
            purged_idemp = db.query(IdempotencyRecord).delete(synchronize_session=False)
            db.commit()

    if target in ("all", "orders"):
        # Set foreign keys to NULL first to prevent foreign key errors
        db.execute(text("UPDATE idempotency_records SET order_id = NULL"))
        db.execute(text("UPDATE audit_logs SET order_id = NULL"))
        db.commit()

        purged_orders = db.query(Order).delete(synchronize_session=False)
        db.commit()

    if target in ("all", "audit_logs"):
        purged_audit = db.query(AuditLog).delete(synchronize_session=False)
        db.commit()

    total_purged = purged_orders + purged_idemp + purged_audit

    return {
        "purged_records": total_purged,
        "purged_orders": purged_orders,
        "purged_idempotency_records": purged_idemp,
        "purged_audit_logs": purged_audit,
        "message": f"Successfully purged {total_purged} test records (Target: {target})"
    }


def manual_key_override(
    db: Session,
    idempotency_key: str,
    action: str = "release",
    actor: str = "admin",
    reason: str = "Manual override"
) -> Dict[str, Any]:
    """
    Manually overrides or releases an idempotency key lock.
    """
    key_clean = idempotency_key.strip()
    record = db.query(IdempotencyRecord).filter(
        IdempotencyRecord.idempotency_key == key_clean
    ).first()

    if not record:
        return {
            "status": "not_found",
            "message": f"Idempotency key '{key_clean}' not found in database",
            "key": key_clean
        }

    old_status = record.status
    order_id = record.order_id

    if action.lower() == "release":
        db.delete(record)
        db.commit()
        new_status = "RELEASED"
    elif action.lower() == "force_complete":
        record.status = "COMPLETED"
        db.commit()
        new_status = "COMPLETED"
    else:
        return {
            "status": "invalid_action",
            "message": f"Action '{action}' is invalid. Allowed: 'release', 'force_complete'",
            "key": key_clean
        }

    # Log MANUAL_OVERRIDE audit event
    log_audit_event(
        db=db,
        order_id=order_id,
        idempotency_key=key_clean,
        decision_type="MANUAL_OVERRIDE",
        actor=actor,
        details_dict={
            "action": action,
            "reason": reason,
            "old_status": old_status,
            "new_status": new_status
        }
    )

    return {
        "status": "success",
        "key": key_clean,
        "action": action,
        "old_status": old_status,
        "new_status": new_status,
        "message": f"Key '{key_clean}' successfully modified via action '{action}'"
    }
