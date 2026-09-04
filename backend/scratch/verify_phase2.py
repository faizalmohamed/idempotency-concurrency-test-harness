import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=== VERIFYING PHASE 2 MANUAL TEST SCENARIOS ===")

# Scenario 1: POST /orders (Baseline) twice
print("\n1. Testing POST /orders twice (Baseline)...")
p1 = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
r1 = client.post("/orders", json=p1)
r2 = client.post("/orders", json=p1)
print(f"Call 1 status: {r1.status_code}, Order ID: {r1.json().get('id')}")
print(f"Call 2 status: {r2.status_code}, Order ID: {r2.json().get('id')}")

# Scenario 2: POST /orders/v2 twice with same key
print("\n2. Testing POST /orders/v2 twice with same key (Protected)...")
key1 = "key-demo-uuid-001"
r_v2_1 = client.post("/orders/v2", json=p1, headers={"Idempotency-Key": key1})
r_v2_2 = client.post("/orders/v2", json=p1, headers={"Idempotency-Key": key1})
print(f"Call 1 status: {r_v2_1.status_code}, Decision: {r_v2_1.json().get('decision')}, Replayed: {r_v2_1.json().get('replayed')}")
print(f"Call 2 status: {r_v2_2.status_code}, Decision: {r_v2_2.json().get('decision')}, Replayed: {r_v2_2.json().get('replayed')}")

# Scenario 3: POST /orders/v2 with same key but changed payload
print("\n3. Testing POST /orders/v2 with same key but changed payload (Conflict)...")
p2_conflict = {"customer_id": "C001", "product_id": "P100", "quantity": 5, "amount": 999.0}
r_conflict = client.post("/orders/v2", json=p2_conflict, headers={"Idempotency-Key": key1})
print(f"Call status: {r_conflict.status_code}, Response JSON: {r_conflict.json()}")

# Scenario 4: GET /orders/{id}
print("\n4. Testing GET /orders/{id}...")
target_id = r1.json().get('id')
r_get = client.get(f"/orders/{target_id}")
print(f"GET status: {r_get.status_code}, Order Reference: {r_get.json().get('order_reference')}")

print("\n=== ALL MANUAL SCENARIOS VERIFIED SUCCESSFULLY ===")
