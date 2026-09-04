import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

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
    client_type: Optional[str] = "web"
    items: List[Dict[str, Any]]
    amount: float

class OrderResponse(OrderBase):
    id: int
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

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
