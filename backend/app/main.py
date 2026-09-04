from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models import Order
from app.schemas import HealthResponse, OrderResponse

# Initialize database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Idempotency & Concurrency Test Harness",
    description="API engine for testing baseline vs protected idempotent order operations",
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
    """Health check endpoint required by Phase 1 specification."""
    return {
        "status": "ok",
        "service": "idempotency-test-harness"
    }

@app.get("/orders", response_model=List[OrderResponse], tags=["Orders"])
def get_orders(db: Session = Depends(get_db)):
    """Fetch list of stored orders from database."""
    orders = db.query(Order).order_by(Order.id.desc()).all()
    return orders
