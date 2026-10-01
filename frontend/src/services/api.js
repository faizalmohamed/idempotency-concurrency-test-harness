/**
 * API service helper for connecting React frontend to FastAPI backend.
 */

const API_BASE_URL = 'http://localhost:8000';

export async function fetchHealthStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Backend health check error:', error.message);
    return { status: 'offline', service: 'idempotency-test-harness' };
  }
}

export async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE_URL}/metrics`);
    if (!res.ok) throw new Error(`Metrics fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Backend metrics fetch error:', error.message);
    return {
      requests_sent: 0,
      unique_operations: 0,
      baseline_duplicates: 0,
      protected_duplicates: 0,
      duplicates_prevented: 0,
      conflicts: 0,
      false_positive_blocks: 0,
      manual_overrides: 0
    };
  }
}

export async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE_URL}/orders`);
    if (!res.ok) throw new Error(`Orders fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Backend orders fetch error:', error.message);
    return [];
  }
}

export async function fetchOrderDetails(orderId) {
  try {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}`);
    if (!res.ok) throw new Error(`Order fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Fetch order details error:', error);
    throw error;
  }
}

export async function runWorkloadSimulation(config) {
  try {
    const res = await fetch(`${API_BASE_URL}/test/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Simulation execution failed');
    }
    return await res.json();
  } catch (error) {
    console.error('Workload simulation API error:', error);
    throw error;
  }
}

export async function fetchTestResults() {
  try {
    const res = await fetch(`${API_BASE_URL}/test/results`);
    if (!res.ok) throw new Error(`Test results fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Fetch test results error:', error.message);
    return [];
  }
}

export async function fetchAuditLogs(filters = {}) {
  try {
    const query = new URLSearchParams();
    if (filters.decision_type) query.append('decision_type', filters.decision_type);
    if (filters.idempotency_key) query.append('idempotency_key', filters.idempotency_key);
    if (filters.order_id) query.append('order_id', filters.order_id);
    if (filters.actor) query.append('actor', filters.actor);
    if (filters.limit) query.append('limit', filters.limit);
    if (filters.offset) query.append('offset', filters.offset);

    const res = await fetch(`${API_BASE_URL}/audit-logs?${query.toString()}`);
    if (!res.ok) throw new Error(`Audit logs fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Fetch audit logs error:', error.message);
    return { items: [], total: 0, limit: 50, offset: 0 };
  }
}

export async function fetchAuditLogDetails(logId) {
  try {
    const res = await fetch(`${API_BASE_URL}/audit-logs/${logId}`);
    if (!res.ok) throw new Error(`Audit log detail fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Fetch audit log details error:', error);
    throw error;
  }
}

export async function purgeTestData(target = 'all', ttlHours = 24) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, ttl_hours: ttlHours })
    });
    if (!res.ok) throw new Error(`Purge request failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Purge test data API error:', error);
    throw error;
  }
}

export async function manualKeyOverride(idempotencyKey, action = 'release', reason = 'Manual UI override') {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/key-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotency_key: idempotencyKey, action, reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Key override failed');
    }
    return await res.json();
  } catch (error) {
    console.error('Manual key override API error:', error);
    throw error;
  }
}

export async function fetchAdminConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/config`);
    if (!res.ok) throw new Error(`Admin config fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Fetch admin config error:', error.message);
    return { artificial_latency_enabled: false, artificial_latency_ms: 100, default_ttl_hours: 24 };
  }
}

export async function updateAdminConfig(config) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`Update config failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Update admin config API error:', error);
    throw error;
  }
}

export async function fetchComparisonReport() {
  try {
    const res = await fetch(`${API_BASE_URL}/comparison/report`);
    if (!res.ok) throw new Error(`Comparison report fetch failed with status ${res.status}`);
    return await res.json();
  } catch (error) {
    console.warn('Fetch comparison report error:', error.message);
    return null;
  }
}

export function getComparisonCSVDownloadUrl() {
  return `${API_BASE_URL}/comparison/export`;
}

