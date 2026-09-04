import React, { useState, useEffect } from 'react';
import { runWorkloadSimulation, fetchTestResults } from '../services/api';

export function SimulateTraffic({ onSimulationRun }) {
  const [mode, setMode] = useState('protected');
  const [concurrency, setConcurrency] = useState(10);
  const [retryDelayMs, setRetryDelayMs] = useState(0);
  const [jitterMs, setJitterMs] = useState(5);
  const [conflictPercentage, setConflictPercentage] = useState(0);

  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        mode,
        concurrency: parseInt(concurrency, 10),
        retry_delay_ms: parseFloat(retryDelayMs),
        jitter_ms: parseFloat(jitterMs),
        conflict_percentage: parseFloat(conflictPercentage)
      };

      const result = await runWorkloadSimulation(payload);
      setLastResult(result);
      await loadHistory();
      if (onSimulationRun) onSimulationRun();
    } catch (err) {
      setErrorMsg(err.message || 'Simulation execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 3 Live Concurrency</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Workload & Concurrency Traffic Simulator
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Fires genuine multi-threaded concurrent requests from the FastAPI backend using `ThreadPoolExecutor`. Measures real latency percentiles (`p50`, `p95`) and calculates duplicate prevention counts from actual database state.
          </p>
        </div>
      </div>

      {/* Control Panel Card */}
      <div className="card-section">
        <h2 className="section-title">⚡ Simulation Controls</h2>
        
        <form onSubmit={handleRunSimulation} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
          
          {/* Mode Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Protection Mode
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`nav-link ${mode === 'baseline' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'baseline' ? 'var(--accent-warning)' : 'var(--border-color)', color: mode === 'baseline' ? '#fff' : 'var(--text-secondary)' }}
                onClick={() => setMode('baseline')}
              >
                Baseline
              </button>
              <button
                type="button"
                className={`nav-link ${mode === 'protected' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center', borderColor: mode === 'protected' ? 'var(--accent-success)' : 'var(--border-color)', color: mode === 'protected' ? '#fff' : 'var(--text-secondary)' }}
                onClick={() => setMode('protected')}
              >
                Protected
              </button>
            </div>
          </div>

          {/* Concurrency Slider */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              <span>Concurrency Workers</span>
              <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{concurrency} threads</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={concurrency}
              onChange={(e) => setConcurrency(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          {/* Retry Delay Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Retry Delay (ms)
            </label>
            <input
              type="number"
              min="0"
              value={retryDelayMs}
              onChange={(e) => setRetryDelayMs(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Jitter Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Jitter Stagger (ms)
            </label>
            <input
              type="number"
              min="0"
              value={jitterMs}
              onChange={(e) => setJitterMs(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: '#fff', fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {/* Payload Conflict Percentage */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              <span>Conflict %</span>
              <span style={{ color: 'var(--accent-danger)', fontFamily: 'var(--font-mono)' }}>{conflictPercentage}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={conflictPercentage}
              onChange={(e) => setConflictPercentage(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent-danger)' }}
            />
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={loading}
              className="nav-link"
              style={{
                width: '100%',
                justify: 'center',
                background: loading ? 'var(--border-color)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: '#fff',
                fontWeight: 700,
                padding: '0.75rem',
                fontSize: '0.9rem',
                boxShadow: 'var(--shadow-glow)'
              }}
            >
              {loading ? '⚡ Running Concurrency Test...' : '⚡ RUN SIMULATION'}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-danger)', fontSize: '0.85rem' }}>
            ❌ Error: {errorMsg}
          </div>
        )}
      </div>

      {/* Live Simulation Results Panel */}
      {lastResult && (
        <div className="card-section" style={{ borderColor: lastResult.mode === 'protected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)', background: lastResult.mode === 'protected' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(245, 158, 11, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>📊 Live Simulation Output</h2>
            <span className={`badge ${lastResult.mode === 'protected' ? 'badge-green' : 'badge-orange'}`}>
              RUN ID: {lastResult.run_id} | MODE: {lastResult.mode.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Requests</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{lastResult.total_requests}</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unique Operations</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)' }}>{lastResult.unique_logical_operations}</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Orders Created</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: lastResult.orders_created > 1 && lastResult.mode === 'baseline' ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                {lastResult.orders_created}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duplicates</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: lastResult.duplicates > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                {lastResult.duplicates}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duplicates Prevented</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>
                {lastResult.duplicates_prevented}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conflicts</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>
                {lastResult.conflicts}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>p50 Latency</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {lastResult.latency.p50_ms} ms
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>p95 Latency</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>
                {lastResult.latency.p95_ms} ms
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Runs Stream */}
      {history.length > 0 && (
        <div className="card-section">
          <h2 className="section-title">📜 Historical Concurrency Test Runs</h2>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Mode</th>
                  <th>Total Requests</th>
                  <th>Orders Created</th>
                  <th>Duplicates Prevented</th>
                  <th>Conflicts</th>
                  <th>p50 Latency</th>
                  <th>p95 Latency</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.run_id}>
                    <td><span className="badge badge-purple">{item.run_id}</span></td>
                    <td>
                      <span className={`badge ${item.mode === 'protected' ? 'badge-green' : 'badge-orange'}`}>
                        {item.mode.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.total_requests}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.orders_created}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-success)' }}>{item.duplicates_prevented}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.conflicts}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.latency.p50_ms} ms</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{item.latency.p95_ms} ms</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimulateTraffic;
