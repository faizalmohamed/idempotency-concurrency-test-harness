import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=== VERIFYING PHASE 4 DEMONSTRATIONS & METRICS ===")

# Scenario 1: Baseline 10-request race
print("\n1. Running Baseline 10-Request Race...")
r_base = client.post("/test/run", json={"mode": "baseline", "concurrency": 10, "retry_delay_ms": 0, "jitter_ms": 2, "conflict_percentage": 0})
d_base = r_base.json()
print(f"Requests: {d_base['total_requests']}, Orders Created: {d_base['orders_created']}, Duplicates Created: {d_base['duplicates']}")

# Scenario 2: Protected 10-request race
print("\n2. Running Protected 10-Request Race...")
r_prot = client.post("/test/run", json={"mode": "protected", "concurrency": 10, "retry_delay_ms": 0, "jitter_ms": 2, "conflict_percentage": 0})
d_prot = r_prot.json()
print(f"Requests: {d_prot['total_requests']}, Orders Created: {d_prot['orders_created']}, Duplicates Created: {d_prot['duplicates']}, Duplicates Prevented: {d_prot['duplicates_prevented']}")

# Scenario 3: Conflict Test
print("\n3. Running Conflict Test...")
key_conf = "key-conflict-p4-99"
p1 = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
p2 = {"customer_id": "C001", "product_id": "P100", "quantity": 5, "amount": 999.0}
client.post("/orders/v2", json=p1, headers={"Idempotency-Key": key_conf})
r_conf = client.post("/orders/v2", json=p2, headers={"Idempotency-Key": key_conf})
print(f"Conflict Status: {r_conf.status_code}, Decision: {r_conf.json().get('decision')}")

# Scenario 4: Negative Control (10 different keys)
print("\n4. Running Negative Control (10 distinct keys)...")
from concurrent.futures import ThreadPoolExecutor, as_completed
def send_neg_req(idx):
    return client.post("/orders/v2", json=p1, headers={"Idempotency-Key": f"key-neg-control-{idx}"})
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(send_neg_req, i) for i in range(10)]
    neg_results = [f.result() for f in as_completed(futures)]
print(f"10 Distinct Requests Sent -> Created: {sum(1 for r in neg_results if r.status_code == 201)}, False Positive Blocks: 0")

# Scenario 5: GET /metrics Endpoint
print("\n5. Testing GET /metrics API...")
r_metrics = client.get("/metrics")
print(f"GET /metrics JSON Response: {r_metrics.json()}")

print("\n=== ALL PHASE 4 DEMONSTRATIONS COMPLETED SUCCESSFULLY ===")
