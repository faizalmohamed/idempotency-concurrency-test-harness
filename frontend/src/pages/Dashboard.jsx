import React, { useState, useEffect } from 'react';
import MetricCard from '../components/MetricCard';
import { fetchMetrics, fetchTestResults } from '../services/api';

export function Dashboard() {
  const [metricsData, setMetricsData] = useState({
    requests_sent: 0,
    unique_operations: 0,
    baseline_duplicates: 0,
    protected_duplicates: 0,
    duplicates_prevented: 0,
    conflicts: 0,
    false_positive_blocks: 0,
    manual_overrides: 0
  });

  const [history, setHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);

  const loadData = async () => {
    const metrics = await fetchMetrics();
    setMetricsData(metrics);
    const testRuns = await fetchTestResults();
    setHistory(testRuns);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const latestBaseline = history.find(r => r.mode === 'baseline');
  const latestProtected = history.find(r => r.mode === 'protected');

  const cards = [
    { title: 'Requests Sent', value: metricsData.requests_sent.toString(), subtitle: 'Total HTTP requests', icon: '🚀', color: 'primary' },
    { title: 'Unique Logical Operations', value: metricsData.unique_operations.toString(), subtitle: 'Distinct transaction intents', icon: '✨', color: 'secondary' },
    { title: 'Baseline Duplicates', value: metricsData.baseline_duplicates.toString(), subtitle: 'Unprotected order duplicates', icon: '⚠️', color: 'warning' },
    { title: 'Protected Duplicates', value: metricsData.protected_duplicates.toString(), subtitle: 'Duplicate orders in protected path', icon: '🛡️', color: 'success' },
    { title: 'Duplicates Prevented', value: metricsData.duplicates_prevented.toString(), subtitle: 'Atomic lock duplicates blocked', icon: '🔒', color: 'success' },
    { title: 'Conflicts Flagged', value: metricsData.conflicts.toString(), subtitle: '409 Payload Mismatches', icon: '⚡', color: 'danger' },
    { title: 'False Positive Blocks', value: metricsData.false_positive_blocks.toString(), subtitle: 'Incorrectly blocked valid orders', icon: '❌', color: 'purple' },
    { title: 'Manual Overrides', value: metricsData.manual_overrides.toString(), subtitle: 'Admin bypassed key locks', icon: '🔑', color: 'primary' }
  ];

  return (
    <div>
      {/* Project Status Indicator Badge */}
      <div className="phase-banner" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.08))', border: '1px solid var(--border-highlight)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span className="phase-badge" style={{ background: 'var(--accent-success)', fontSize: '0.85rem' }}>
                PROJECT COMPLETION: 35%
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Review 1 Milestone Operational</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Idempotency & Concurrency Test Harness Engine
            </h3>
          </div>
        </div>
      </div>

      {/* 8 Dynamic Metric Cards */}
      <div className="metrics-grid">
        {cards.map((m, idx) => (
          <MetricCard
            key={idx}
            title={m.title}
            value={m.value}
            subtitle={m.subtitle}
            icon={m.icon}
            color={m.color}
          />
        ))}
      </div>

      {/* Baseline vs Protected Visual Comparison */}
      <div className="card-section">
        <h2 className="section-title">⚖️ Baseline vs Protected Performance Matrix</h2>
        <div className="table-container" style={{ marginTop: '1rem' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Metric / Dimension</th>
                <th>Baseline (Unprotected)</th>
                <th>Protected (Idempotency + DB Lock)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Orders Created</strong></td>
                <td>
                  <span className="badge badge-orange">
                    {latestBaseline ? latestBaseline.orders_created : 0} Orders
                  </span>
                </td>
                <td>
                  <span className="badge badge-green">
                    {latestProtected ? latestProtected.orders_created : 0} Order
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>Duplicates Created</strong></td>
                <td>
                  <span className="badge badge-orange">
                    {latestBaseline ? latestBaseline.duplicates : 0} Duplicates
                  </span>
                </td>
                <td>
                  <span className="badge badge-green">
                    {latestProtected ? latestProtected.duplicates : 0} Duplicates
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>Duplicates Prevented</strong></td>
                <td>0</td>
                <td>
                  <span className="badge badge-green">
                    {latestProtected ? latestProtected.duplicates_prevented : 0} Prevented
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>Conflicts Flagged</strong></td>
                <td>0</td>
                <td>
                  <span className="badge badge-purple">
                    {latestProtected ? latestProtected.conflicts : 0} Conflicts
                  </span>
                </td>
              </tr>
              <tr>
                <td><strong>p50 Latency</strong></td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  {latestBaseline ? `${latestBaseline.latency.p50_ms} ms` : 'N/A'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                  {latestProtected ? `${latestProtected.latency.p50_ms} ms` : 'N/A'}
                </td>
              </tr>
              <tr>
                <td><strong>p95 Latency</strong></td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  {latestBaseline ? `${latestBaseline.latency.p95_ms} ms` : 'N/A'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>
                  {latestProtected ? `${latestProtected.latency.p95_ms} ms` : 'N/A'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Simulation History */}
      <div className="card-section">
        <h2 className="section-title">📜 Recent Concurrency Simulation Runs</h2>
        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>No simulation runs yet</h3>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Run a traffic simulation on the "Simulate Traffic" page to generate live test history.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Timestamp</th>
                  <th>Mode</th>
                  <th>Requests</th>
                  <th>Orders</th>
                  <th>Duplicates</th>
                  <th>Conflicts</th>
                  <th>p95 Latency</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.run_id}>
                    <td><span className="badge badge-purple">{run.run_id}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(run.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className={`badge ${run.mode === 'protected' ? 'badge-green' : 'badge-orange'}`}>
                        {run.mode.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{run.total_requests}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{run.orders_created}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: run.duplicates > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                      {run.duplicates}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{run.conflicts}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{run.latency.p95_ms} ms</td>
                    <td>
                      <button
                        onClick={() => setSelectedRun(run)}
                        style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid var(--border-highlight)', color: '#a5b4fc', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scope Checklist Indicator */}
      <div className="card-section">
        <h2 className="section-title">📌 Project Completion Scope Breakdown</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h4 style={{ color: 'var(--accent-success)', marginBottom: '0.5rem' }}>✓ Completed Scope (35%)</h4>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: '1.7' }}>
              <li>✓ Foundation & Modular Architecture</li>
              <li>✓ SQLite Database with WAL Mode</li>
              <li>✓ Unprotected Baseline Endpoint (`POST /orders`)</li>
              <li>✓ Idempotency-Protected Endpoint (`POST /orders/v2`)</li>
              <li>✓ Idempotency Keys & Validation Rules</li>
              <li>✓ SHA-256 Request Fingerprinting</li>
              <li>✓ Payload Conflict Detection (409 Conflict)</li>
              <li>✓ Transactional Unique DB Constraint Protection</li>
              <li>✓ Multi-Threaded Concurrency Workload Engine</li>
              <li>✓ Traffic Simulator with Latency Profiling</li>
              <li>✓ Live Orders List with Duplicate Badges</li>
              <li>✓ Interactive Dashboard Shell</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>○ Remaining Roadmap (65%)</h4>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: '1.7' }}>
              <li>○ Immutable Audit Log Stream & Search UI (Phase 5)</li>
              <li>○ Admin Key Purging & Lock Override Controls</li>
              <li>○ Transaction Rollback Engine</li>
              <li>○ Partial Failure & Network Drop Simulator</li>
              <li>○ Legacy Client Coexistence Controls</li>
              <li>○ Exportable Benchmark Comparison Reports</li>
              <li>○ System Boundaries & Stakeholder Validation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Inspect Run Modal */}
      {selectedRun && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '550px', width: '90%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Run Details: {selectedRun.run_id}
              </h3>
              <button onClick={() => setSelectedRun(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✖</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>Mode: <strong>{selectedRun.mode.toUpperCase()}</strong></div>
              <div>Requests: <strong>{selectedRun.total_requests}</strong></div>
              <div>Orders Created: <strong style={{ color: 'var(--accent-success)' }}>{selectedRun.orders_created}</strong></div>
              <div>Duplicates: <strong style={{ color: 'var(--accent-danger)' }}>{selectedRun.duplicates}</strong></div>
              <div>Prevented: <strong style={{ color: 'var(--accent-success)' }}>{selectedRun.duplicates_prevented}</strong></div>
              <div>Conflicts: <strong style={{ color: 'var(--accent-warning)' }}>{selectedRun.conflicts}</strong></div>
              <div>p50 Latency: <strong>{selectedRun.latency.p50_ms} ms</strong></div>
              <div>p95 Latency: <strong>{selectedRun.latency.p95_ms} ms</strong></div>
            </div>
            <button
              onClick={() => setSelectedRun(null)}
              style={{ marginTop: '1.5rem', width: '100%', padding: '0.65rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
