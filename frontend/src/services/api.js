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
