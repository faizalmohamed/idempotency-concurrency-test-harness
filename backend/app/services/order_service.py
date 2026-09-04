import json
import uuid
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import Order, IdempotencyRecord, AuditLog
from app.core.idempotency import (
    generate_request_fingerprint,
    detect_duplicate,
    detect_conflict
)

def create_baseline_order(
    db: Session,
    payload: Dict[str, Any],
    client_type: str = "web"
) -> Order:
    """
    Naive order creation implementation (Control Group).
    
    WARNING: Every call creates a new order in the database regardless of retries
    or repeated payloads. Serves as the unprotected baseline.
    """
    amount = float(payload.get("amount", 0.0))
    order_ref = f"ORD-BASE-{uuid.uuid4().hex[:6].upper()}"
    canonical_payload = json.dumps(payload, sort_keys=True)

    order = Order(
        order_reference=order_ref,
        client_type=client_type,
        payload_json=canonical_payload,
        amount=amount,
        status="created"
    )
    db.add(order)
    db.flush()

    audit_entry = AuditLog(
        order_id=order.id,
        idempotency_key=None,
        decision_type="NEW_ORDER_CREATED_BASELINE",
        actor=client_type,
        details=json.dumps({"order_reference": order_ref, "amount": amount})
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(order)
    return order


def create_protected_order(
    db: Session,
    payload: Dict[str, Any],
    idempotency_key: str,
    client_type: str = "web"
) -> Tuple[Optional[Order], str, str, bool, int]:
    """
    Idempotent Order Creation Engine (Protected Implementation).
    
    Guarantees atomic execution using transactional unique constraints on `idempotency_key`.
    
    Returns tuple:
        (order_obj, decision_str, idempotency_key, is_replayed, http_status_code)
        
    Possible decisions:
        - ALLOWED (Status 201)
        - RETRIED_AND_MATCHED (Status 200)
        - BLOCKED_AS_CONFLICT (Status 409)
    """
    incoming_fingerprint = generate_request_fingerprint(payload)
    amount = float(payload.get("amount", 0.0))
    canonical_payload = json.dumps(payload, sort_keys=True)

    # 1. Check if an idempotency record already exists for this key
    existing_record = db.query(IdempotencyRecord).filter(
        IdempotencyRecord.idempotency_key == idempotency_key
    ).first()

    if existing_record:
        # Evaluate fingerprint against existing record
        if detect_duplicate(existing_record.request_fingerprint, incoming_fingerprint):
            # Duplicate / Retry -> Return original stored result
            order = None
            if existing_record.order_id:
                order = db.query(Order).filter(Order.id == existing_record.order_id).first()

            # Record audit log
            audit_entry = AuditLog(
                order_id=existing_record.order_id,
                idempotency_key=idempotency_key,
                decision_type="IDEMPOTENT_REPLAY",
                actor=client_type,
                details=json.dumps({"fingerprint": incoming_fingerprint, "action": "returned_stored_result"})
            )
            db.add(audit_entry)
            db.commit()

            return order, "RETRIED_AND_MATCHED", idempotency_key, True, 200

        elif detect_conflict(existing_record.request_fingerprint, incoming_fingerprint):
            # Conflict -> Same key reused with different payload
            audit_entry = AuditLog(
                order_id=existing_record.order_id,
                idempotency_key=idempotency_key,
                decision_type="PAYLOAD_CONFLICT",
                actor=client_type,
                details=json.dumps({"stored_fp": existing_record.request_fingerprint, "incoming_fp": incoming_fingerprint})
            )
            db.add(audit_entry)
            db.commit()

            return None, "BLOCKED_AS_CONFLICT", idempotency_key, False, 409

    # 2. Key does not exist yet -> Attempt atomic creation inside a transaction boundary
    try:
        # Insert initial IdempotencyRecord with PROCESSING state
        idemp_record = IdempotencyRecord(
            idempotency_key=idempotency_key,
            request_fingerprint=incoming_fingerprint,
            status="PROCESSING"
        )
        db.add(idemp_record)
        db.flush()  # Triggers DB unique constraint check immediately

        # Generate unique order reference and insert Order
        order_ref = f"ORD-PROT-{uuid.uuid4().hex[:6].upper()}"
        order = Order(
            order_reference=order_ref,
            client_type=client_type,
            payload_json=canonical_payload,
            amount=amount,
            status="completed"
        )
        db.add(order)
        db.flush()

        # Finalize IdempotencyRecord status and store response details
        idemp_record.status = "COMPLETED"
        idemp_record.order_id = order.id
        idemp_record.response_code = 201
        idemp_record.response_body = json.dumps({
            "id": order.id,
            "order_reference": order.order_reference,
            "amount": order.amount,
            "status": order.status
        })

        # Add Audit Log entry
        audit_entry = AuditLog(
            order_id=order.id,
            idempotency_key=idempotency_key,
            decision_type="NEW_ORDER_CREATED_PROTECTED",
            actor=client_type,
            details=json.dumps({"order_reference": order_ref, "fingerprint": incoming_fingerprint})
        )
        db.add(audit_entry)

        # Commit atomic transaction
        db.commit()
        db.refresh(order)

        return order, "ALLOWED", idempotency_key, False, 201

    except IntegrityError:
        # Race condition catch: Another concurrent thread inserted this key first!
        db.rollback()

        # Re-query record created by racing thread
        race_record = db.query(IdempotencyRecord).filter(
            IdempotencyRecord.idempotency_key == idempotency_key
        ).first()

        if race_record and detect_duplicate(race_record.request_fingerprint, incoming_fingerprint):
            order = None
            if race_record.order_id:
                order = db.query(Order).filter(Order.id == race_record.order_id).first()
            return order, "RETRIED_AND_MATCHED", idempotency_key, True, 200
        else:
            return None, "BLOCKED_AS_CONFLICT", idempotency_key, False, 409
