import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_reference = Column(String(64), unique=True, index=True, nullable=False)
    client_type = Column(String(32), default="web", nullable=False)
    payload_json = Column(Text, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    status = Column(String(32), default="created", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Relationships prepared for subsequent phases
    idempotency_records = relationship("IdempotencyRecord", back_populates="order")
    audit_logs = relationship("AuditLog", back_populates="order")


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(128), unique=True, index=True, nullable=False)
    request_fingerprint = Column(String(64), nullable=False)
    status = Column(String(32), default="PROCESSING", nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    response_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    order = relationship("Order", back_populates="idempotency_records")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    idempotency_key = Column(String(128), nullable=True)
    decision_type = Column(String(64), nullable=False)
    actor = Column(String(64), default="web_client", nullable=False)
    details = Column(Text, nullable=True)

    order = relationship("Order", back_populates="audit_logs")
