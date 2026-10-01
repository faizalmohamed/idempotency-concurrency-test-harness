import React, { useState, useEffect } from 'react';
import { runWorkloadSimulation, fetchTestResults } from '../services/api';

export function SimulateTraffic({ onSimulationRun }) {
  const [mode, setMode] = useState('protected');
  const [concurrency, setConcurrency] = useState(10);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [jitterMs, setJitterMs] = useState(5);
  const [conflictPercentage, setConflictPercentage] = useState(0);
  const [clientType, setClientType] = useState('web');

  // Phase 7 Failure & Legacy Client Simulation state
  const [failureType, setFailureType] = useState('none');
  const [failureRatePercent, setFailureRatePercent] = useState(0);
  const [legacyClientPercentage, setLegacyClientPercentage] = useState(0);

  // Payload form fields
  const [customerId, setCustomerId] = useState('C001');
  const [productId, setProductId] = useState('P100');
  const [quantity, setQuantity] = useState(2);
  const [amount, setAmount] = useState(500.0);

  const [loading, setLoading] = useState(false);
  const [dispatchedCount, setDispatchedCount] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadHistory = async () => {
    const data = await fetchTestResults();
    setHistory(data);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMsg(null);
    setDispatchedCount(0);

    const total = parseInt(concurrency, 10) || 10;
    let current = 0;
    const ticker = setInterval(() => {
      current = Math.min(total, current + Math.ceil(total / 5));
      setDispatchedCount(current);
    }, 100);

    try {
      const payloadConfig = {
        mode,
        concurrency: total,
        retry_delay_ms: parseFloat(retryDelayMs) || 0.0,
        jitter_ms: parseFloat(jitterMs) || 0.0,
        conflict_percentage: parseFloat(conflictPercentage) || 0.0,
        client_type: clientType,
        failure_type: failureType,
        failure_rate_percent: parseFloat(failureRatePercent) || 0.0,
        legacy_client_percentage: parseFloat(legacyClientPercentage) || 0.0,
        custom_payload: {
          customer_id: customerId,
          product_id: productId,
          quantity: parseInt(quantity, 10) || 1,
          amount: parseFloat(amount) || 100.0
        }
      };

      const result = await runWorkloadSimulation(payloadConfig);

      setDispatchedCount(total);
      setLastResult(result);
      await loadHistory();
      if (onSimulationRun) onSimulationRun();
    } catch (err) {
      setErrorMsg(err.message || 'Simulation execution failed');
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 7 Live Simulator</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Workload, Concurrency & Failure Traffic Simulator
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Fires parallel multi-threaded HTTP/DB worker requests. Evaluates unprotected baseline duplicate vulnerabilities vs idempotency-protected unique locks, network drops, and legacy coexistence.
          </p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="card-section">
        <h2 className="section-title">⚡ Simulation Controls</h2>

        <form onSubmit={handleRunSimulation} style={{ display: 'grid', gap: '1.25rem', marginTop: '1rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            
            {/* Test Mode */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Test Mode
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={loading}
                  className={`nav-link ${mode === 'baseline' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'baseline' ? 'var(--accent-warning)' : 'var(--border-color)', color: mode === 'baseline' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setMode('baseline')}
                >
                  Baseline
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className={`nav-link ${mode === 'protected' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'protected' ? 'var(--accent-success)' : 'var(--border-color)', color: mode === 'protected' ? '#fff' : 'var(--text-secondary)' }}
                  onClick={() => setMode('protected')}
                >
                  Protected
                </button>
              </div>
            </div>

            {/* Concurrency Workers (1-100) */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                <span>Concurrency (1-100)</span>
                <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{concurrency} workers</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                disabled={loading}
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Retry Delay */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Retry Delay (ms)
              </label>
              <input
                type="number"
                min="0"
                disabled={loading}
                value={retryDelayMs}
                onChange={(e) => setRetryDelayMs(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Jitter Stagger */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Jitter Stagger (ms)
              </label>
              <input
                type="number"
                min="0"
                disabled={loading}
                value={jitterMs}
                onChange={(e) => setJitterMs(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Conflict % */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                <span>Conflict %</span>
                <span style={{ color: 'var(--accent-danger)', fontFamily: 'var(--font-mono)' }}>{conflictPercentage}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                disabled={loading}
                value={conflictPercentage}
                onChange={(e) => setConflictPercentage(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent-danger)' }}
              />
            </div>

            {/* Client Type Dropdown */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Client Type
              </label>
              <select
                value={clientType}
                disabled={loading}
                onChange={(e) => setClientType(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
              >
                <option value="web">Web Client</option>
                <option value="mobile">Mobile Client</option>
                <option value="retry_agent">Retry Agent</option>
                <option value="legacy">Legacy Client</option>
              </select>
            </div>

            {/* Failure Simulation Type (Phase 7) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Failure Type
              </label>
              <select
                value={failureType}
                disabled={loading}
                onChange={(e) => setFailureType(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff' }}
              >
                <option value="none">None</option>
                <option value="timeout">Timeout</option>
                <option value="server_error">Server Error</option>
                <option value="connection_drop">Connection Drop</option>
              </select>
            </div>

            {/* Failure Rate % (Phase 7) */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                <span>Failure Rate</span>
                <span style={{ color: 'var(--accent-warning)', fontFamily: 'var(--font-mono)' }}>{failureRatePercent}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={loading}
                value={failureRatePercent}
                onChange={(e) => setFailureRatePercent(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', accentColor: 'var(--accent-warning)' }}
              />
            </div>

            {/* Legacy Client Coexistence % (Phase 7) */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                <span>Legacy Client %</span>
                <span style={{ color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{legacyClientPercentage}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={loading}
                value={legacyClientPercentage}
                onChange={(e) => setLegacyClientPercentage(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
              />
            </div>
          </div>

          {/* Structured Order Payload Fields */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              📦 Order Payload Configuration
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer ID</label>
                <input
                  type="text"
                  disabled={loading}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product ID</label>
                <input
                  type="text"
                  disabled={loading}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quantity</label>
                <input
                  type="number"
                  min="1"
                  disabled={loading}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  disabled={loading}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>

          {/* Configuration Preview Badge Bar */}
          <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>Selected Configuration:</span>
            <span className={`badge ${mode === 'protected' ? 'badge-green' : 'badge-orange'}`}>{mode.toUpperCase()}</span>
            <span className="badge badge-blue">{concurrency} Workers</span>
            <span className="badge badge-purple">{failureType !== 'none' ? `${failureType} (${failureRatePercent}%)` : 'No Failure Injection'}</span>
            <span className="badge badge-gray">{legacyClientPercentage > 0 ? `Legacy: ${legacyClientPercentage}%` : 'Standard Client'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>${amount} ({customerId})</span>
          </div>

          {/* Action Button & Running Status Ticker */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="nav-link"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: loading ? 'var(--border-color)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: '#fff',
                fontWeight: 700,
                padding: '0.85rem',
                fontSize: '0.95rem',
                boxShadow: 'var(--shadow-glow)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? `RUNNING TEST... Requests dispatched: ${dispatchedCount} / ${concurrency}` : '⚡ RUN SIMULATION'}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-danger)', fontSize: '0.85rem' }}>
            ❌ Error: {errorMsg}
          </div>
        )}
      </div>

      {/* Result Panel */}
      {lastResult && (
        <div className="card-section" style={{ borderColor: lastResult.mode === 'protected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)', background: lastResult.mode === 'protected' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(245, 158, 11, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>📊 TEST COMPLETED</h2>
            <span className={`badge ${lastResult.mode === 'protected' ? 'badge-green' : 'badge-orange'}`}>
              RUN ID: {lastResult.run_id} | MODE: {lastResult.mode.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            
            {/* Total Requests */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Requests</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{lastResult.total_requests}</div>
            </div>

            {/* Successful Requests */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Successful Requests</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>
                {lastResult.successful_requests !== undefined ? lastResult.successful_requests : lastResult.orders_created}
              </div>
            </div>

            {/* Failures */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Failures</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: lastResult.failures > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                {lastResult.failures || 0}
              </div>
            </div>

            {/* Retries */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retries</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {lastResult.retries !== undefined ? lastResult.retries : lastResult.duplicates_prevented}
              </div>
            </div>

            {/* Replay Count */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Replay Count</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)' }}>
                {lastResult.replay_count !== undefined ? lastResult.replay_count : lastResult.duplicates_prevented}
              </div>
            </div>

            {/* Conflicts */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conflicts</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>
                {lastResult.conflicts}
              </div>
            </div>

            {/* Legacy Requests */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Legacy Requests</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>
                {lastResult.legacy_requests || 0}
              </div>
            </div>

            {/* Orders Created */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Orders Created</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {lastResult.orders_created}
              </div>
            </div>

            {/* Duplicates Created */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duplicates Created</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: lastResult.duplicates > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                {lastResult.duplicates}
              </div>
            </div>

            {/* Latency */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>p50 / p95 Latency</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {lastResult.latency.p50_ms}ms / {lastResult.latency.p95_ms}ms
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default SimulateTraffic;
