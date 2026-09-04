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
