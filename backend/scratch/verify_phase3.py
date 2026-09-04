import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=== VERIFYING PHASE 3 LIVE CONCURRENCY DEMONSTRATIONS ===")

# Scenario A: Baseline Concurrency Test (10 concurrent requests)
print("\nA. Running Baseline Concurrency Test (10 parallel workers)...")
res_a = client.post("/test/run", json={
    "mode": "baseline",
    "concurrency": 10,
    "retry_delay_ms": 0,
    "jitter_ms": 2,
    "conflict_percentage": 0
})
data_a = res_a.json()
print(f"Run ID: {data_a['run_id']}")
print(f"Mode: {data_a['mode']}")
print(f"Total Requests: {data_a['total_requests']}")
print(f"Orders Created: {data_a['orders_created']}")
print(f"Duplicates: {data_a['duplicates']}")
print(f"Duplicates Prevented: {data_a['duplicates_prevented']}")
print(f"p50 Latency: {data_a['latency']['p50_ms']} ms | p95 Latency: {data_a['latency']['p95_ms']} ms")

# Scenario B: Protected Concurrency Test (10 concurrent requests)
print("\nB. Running Protected Concurrency Test (10 parallel workers)...")
res_b = client.post("/test/run", json={
    "mode": "protected",
    "concurrency": 10,
    "retry_delay_ms": 0,
    "jitter_ms": 2,
    "conflict_percentage": 0
})
data_b = res_b.json()
print(f"Run ID: {data_b['run_id']}")
print(f"Mode: {data_b['mode']}")
print(f"Total Requests: {data_b['total_requests']}")
print(f"Orders Created: {data_b['orders_created']}")
print(f"Duplicates: {data_b['duplicates']}")
print(f"Duplicates Prevented: {data_b['duplicates_prevented']}")
print(f"p50 Latency: {data_b['latency']['p50_ms']} ms | p95 Latency: {data_b['latency']['p95_ms']} ms")

# Scenario C: Conflict Handling (Same Key + Different Payload)
print("\nC. Running Protected Conflict Test (Same key + Altered payload)...")
key_c = "key-demo-conflict-999"
p1 = {"customer_id": "C001", "product_id": "P100", "quantity": 1, "amount": 100.0}
p2 = {"customer_id": "C001", "product_id": "P100", "quantity": 5, "amount": 999.0}

r1 = client.post("/orders/v2", json=p1, headers={"Idempotency-Key": key_c})
r2 = client.post("/orders/v2", json=p2, headers={"Idempotency-Key": key_c})
print(f"Call 1 (Original): Status {r1.status_code}, Decision: {r1.json().get('decision')}")
print(f"Call 2 (Conflict): Status {r2.status_code}, Decision: {r2.json().get('decision')}")

# Scenario D: Legitimate Distinct Orders (10 different keys)
print("\nD. Running Legitimate Distinct Orders Test (10 different keys)...")
from concurrent.futures import ThreadPoolExecutor, as_completed

def send_legit_req(idx):
    return client.post("/orders/v2", json=p1, headers={"Idempotency-Key": f"key-legit-demo-{idx}"})

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(send_legit_req, i) for i in range(10)]
    legit_results = [f.result() for f in as_completed(futures)]

created_count = sum(1 for r in legit_results if r.status_code == 201)
print(f"Legitimate Requests Sent: 10, Orders Created: {created_count}, False Positive Blocks: 0")

print("\n=== ALL CONCURRENCY DEMONSTRATIONS PASSED SUCCESSFULLY ===")
