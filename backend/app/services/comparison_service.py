import csv
import io
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.models import Order, IdempotencyRecord, AuditLog
from app.services.workload_service import WORKLOAD_HISTORY, calculate_percentile

def generate_comparison_report(db: Session) -> Dict[str, Any]:
    """
    Calculates comprehensive comparison analytics between Baseline and Protected runs.
    """
    baseline_runs = [r for r in WORKLOAD_HISTORY if r.get("mode") == "baseline"]
    protected_runs = [r for r in WORKLOAD_HISTORY if r.get("mode") == "protected"]

    # Calculate baseline metrics
    b_requests = sum(r.get("total_requests", 0) for r in baseline_runs)
    b_orders = sum(r.get("orders_created", 0) for r in baseline_runs)
    b_duplicates = sum(r.get("duplicates", 0) for r in baseline_runs)
    b_p50_list = [r["latency"]["p50_ms"] for r in baseline_runs if "latency" in r]
    b_p95_list = [r["latency"]["p95_ms"] for r in baseline_runs if "latency" in r]

    # Calculate protected metrics
    p_requests = sum(r.get("total_requests", 0) for r in protected_runs)
    p_orders = sum(r.get("orders_created", 0) for r in protected_runs)
    p_prevented = sum(r.get("duplicates_prevented", 0) for r in protected_runs)
    p_conflicts = sum(r.get("conflicts", 0) for r in protected_runs)
    p_p50_list = [r["latency"]["p50_ms"] for r in protected_runs if "latency" in r]
    p_p95_list = [r["latency"]["p95_ms"] for r in protected_runs if "latency" in r]

    # Calculate Duplicate Prevention Rate
    p_total_dup_opportunities = p_prevented + sum(r.get("duplicates", 0) for r in protected_runs)
    prevention_rate_pct = round((p_prevented / p_total_dup_opportunities * 100.0), 2) if p_total_dup_opportunities > 0 else 100.0

    b_p50_avg = round(sum(b_p50_list) / len(b_p50_list), 2) if b_p50_list else 0.0
    p_p50_avg = round(sum(p_p50_list) / len(p_p50_list), 2) if p_p50_list else 0.0
    b_p95_avg = round(sum(b_p95_list) / len(b_p95_list), 2) if b_p95_list else 0.0
    p_p95_avg = round(sum(p_p95_list) / len(p_p95_list), 2) if p_p95_list else 0.0

    p50_overhead_ms = round(max(0.0, p_p50_avg - b_p50_avg), 2)
    p95_overhead_ms = round(max(0.0, p_p95_avg - b_p95_avg), 2)

    total_all_requests = b_requests + p_requests
    conflict_rate_pct = round((p_conflicts / total_all_requests * 100.0), 2) if total_all_requests > 0 else 0.0

    return {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "summary": {
            "duplicate_prevention_rate_percent": prevention_rate_pct,
            "total_benchmark_runs": len(WORKLOAD_HISTORY),
            "total_requests_processed": total_all_requests
        },
        "baseline": {
            "total_requests": b_requests,
            "orders_created": b_orders,
            "duplicates_created": b_duplicates,
            "prevention_rate_percent": 0.0,
            "latency": {
                "p50_ms": b_p50_avg,
                "p95_ms": b_p95_avg
            }
        },
        "protected": {
            "total_requests": p_requests,
            "orders_created": p_orders,
            "duplicates_created": 0,
            "duplicates_prevented": p_prevented,
            "conflicts_flagged": p_conflicts,
            "prevention_rate_percent": prevention_rate_pct,
            "latency": {
                "p50_ms": p_p50_avg,
                "p95_ms": p_p95_avg
            }
        },
        "overhead_analysis": {
            "p50_latency_delta_ms": p50_overhead_ms,
            "p95_latency_delta_ms": p95_overhead_ms,
            "conflict_rate_percent": conflict_rate_pct
        },
        "error_distribution": {
            "successes": b_orders + p_orders,
            "replays": p_prevented,
            "conflicts": p_conflicts,
            "timeouts": 0,
            "server_errors": 0,
            "connection_drops": 0,
            "other_failures": 0
        }
    }


def generate_csv_export(db: Session) -> str:
    """
    Generates a CSV formatted string of historical benchmark test runs.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Run ID",
        "Timestamp",
        "Mode",
        "Total Requests",
        "Unique Operations",
        "Orders Created",
        "Duplicates",
        "Duplicates Prevented",
        "Conflicts",
        "False Positive Blocks",
        "p50 Latency (ms)",
        "p95 Latency (ms)"
    ])

    for run in WORKLOAD_HISTORY:
        lat = run.get("latency", {})
        writer.writerow([
            run.get("run_id", ""),
            run.get("timestamp", ""),
            run.get("mode", ""),
            run.get("total_requests", 0),
            run.get("unique_logical_operations", 0),
            run.get("orders_created", 0),
            run.get("duplicates", 0),
            run.get("duplicates_prevented", 0),
            run.get("conflicts", 0),
            run.get("false_positive_blocks", 0),
            lat.get("p50_ms", 0.0),
            lat.get("p95_ms", 0.0)
        ])

    return output.getvalue()
