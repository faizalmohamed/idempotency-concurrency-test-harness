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

class EnhancedOrderResponse(OrderResponse):
    idempotency_key: Optional[str] = None
    decision: Optional[str] = "ALLOWED"
    is_duplicate: bool = False

    model_config = ConfigDict(from_attributes=True)

class ProtectedOrderResponse(BaseModel):
    order: Optional[EnhancedOrderResponse] = None
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


# Workload & Concurrency Schemas

class WorkloadTestRequest(BaseModel):
    mode: str = Field("protected", description="Mode: 'baseline' or 'protected'")
    concurrency: int = Field(10, ge=1, le=100, description="Number of concurrent worker threads")
    retry_delay_ms: float = Field(0.0, ge=0.0, description="Artificial delay between retries in ms")
    jitter_ms: float = Field(5.0, ge=0.0, description="Random stagger jitter between worker launches in ms")
    conflict_percentage: float = Field(0.0, ge=0.0, le=100.0, description="Percentage of requests with altered conflicting payload")

class LatencyMetrics(BaseModel):
    p50_ms: float
    p95_ms: float
    avg_ms: float
    min_ms: float
    max_ms: float

class WorkloadErrorCounts(BaseModel):
    validation_error: int = 0
    duplicate: int = 0
    conflict: int = 0
    timeout: int = 0
    database_error: int = 0
    concurrency_error: int = 0
    unexpected_error: int = 0

class WorkloadTestResponse(BaseModel):
    run_id: str
    timestamp: datetime.datetime
    mode: str
    total_requests: int
    unique_logical_operations: int
    orders_created: int
    duplicates: int
    duplicates_prevented: int
    conflicts: int
    false_positive_blocks: int
    latency: LatencyMetrics
    errors: WorkloadErrorCounts


# Phase 4 System Metrics Schema
class SystemMetricsResponse(BaseModel):
    requests_sent: int
    unique_operations: int
    baseline_duplicates: int
    protected_duplicates: int
    duplicates_prevented: int
    conflicts: int
    false_positive_blocks: int
    manual_overrides: int
