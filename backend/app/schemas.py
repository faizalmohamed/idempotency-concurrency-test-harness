import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, ConfigDict, Field

class HealthResponse(BaseModel):
    status: str
    service: str

class OrderBase(BaseModel):
    order_reference: str
    client_type: str
    amount: float
    status: str
    payload_json: str

class OrderCreate(BaseModel):
    customer_id: Optional[str] = "C001"
    product_id: Optional[str] = "P100"
    quantity: Optional[int] = 1
    amount: float = Field(..., gt=0, description="Order monetary amount")
    client_type: Optional[str] = "web"
    items: Optional[List[Dict[str, Any]]] = None

class OrderResponse(OrderBase):
    id: int
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class ProtectedOrderResponse(BaseModel):
    order: Optional[OrderResponse] = None
    decision: str = Field(..., description="Decision: ALLOWED | RETRIED_AND_MATCHED | BLOCKED_AS_DUPLICATE | BLOCKED_AS_CONFLICT")
    idempotency_key: str
    replayed: bool

class ConflictErrorResponse(BaseModel):
    error: str = "IDEMPOTENCY_KEY_CONFLICT"
    decision: str = "BLOCKED_AS_CONFLICT"
    message: str = "Idempotency-Key reuse detected with non-matching payload fingerprint"

class IdempotencyRecordSchema(BaseModel):
    id: int
    idempotency_key: str
    request_fingerprint: str
    status: str
    order_id: Optional[int] = None
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    expires_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AuditLogSchema(BaseModel):
    id: int
    timestamp: datetime.datetime
    order_id: Optional[int] = None
    idempotency_key: Optional[str] = None
    decision_type: str
    actor: str
    details: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
