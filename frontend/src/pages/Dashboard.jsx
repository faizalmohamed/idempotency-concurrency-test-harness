import React, { useState, useEffect } from 'react';
import MetricCard from '../components/MetricCard';
import { fetchTestResults } from '../services/api';

export function Dashboard({ orderCount = 0 }) {
  const [latestRun, setLatestRun] = useState(null);

  useEffect(() => {
    async function loadLatest() {
      const history = await fetchTestResults();
      if (history && history.length > 0) {
        setLatestRun(history[0]);
      }
    }
    loadLatest();
  }, []);

  const totalRequests = latestRun ? latestRun.total_requests : 0;
  const duplicates = latestRun ? latestRun.duplicates : 0;
  const duplicatesPrevented = latestRun ? latestRun.duplicates_prevented : 0;
  const conflicts = latestRun ? latestRun.conflicts : 0;
  const p50 = latestRun ? `${latestRun.latency.p50_ms} ms` : '0 ms';
  const p95 = latestRun ? `${latestRun.latency.p95_ms} ms` : '0 ms';

  const metrics = [
    { title: 'Requests Sent', value: totalRequests.toString(), subtitle: 'Latest workload batch', icon: '🚀', color: 'primary' },
    { title: 'Unique Operations', value: orderCount.toString(), subtitle: 'Distinct DB order records', icon: '✨', color: 'secondary' },
    { title: 'Duplicates', value: duplicates.toString(), subtitle: 'Unprotected duplicates', icon: '⚠️', color: 'warning' },
    { title: 'Duplicates Prevented', value: duplicatesPrevented.toString(), subtitle: 'Idempotency protected', icon: '🛡️', color: 'success' },
    { title: 'Conflicts', value: conflicts.toString(), subtitle: '409 Payload Mismatches', icon: '⚡', color: 'danger' },
    { title: 'Overrides', value: '0', subtitle: 'Bypassed locks', icon: '🔑', color: 'purple' },
    { title: 'p50 Latency', value: p50, subtitle: 'Median batch latency', icon: '⏱️', color: 'primary' },
    { title: 'p95 Latency', value: p95, subtitle: '95th percentile latency', icon: '📈', color: 'secondary' }
  ];

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 3 Live Concurrency Engine</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Real Concurrency Testing & Workload Simulator Operational
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            The multi-threaded `ThreadPoolExecutor` workload engine is actively firing parallel requests to measure baseline duplicate vulnerabilities versus protected idempotency locks.
          </p>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="metrics-grid">
        {metrics.map((m, idx) => (
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

      {/* Protection Status Section */}
      <div className="card-section">
        <h2 className="section-title">
          <span>🛡️</span> Endpoint Protection Status
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--accent-danger)', fontSize: '0.95rem' }}>Baseline Endpoint (`POST /orders`)</strong>
              <span className="badge badge-orange">UNPROTECTED</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Naive control group. 10 concurrent requests to this endpoint create 10 duplicate order records in SQLite database.
            </p>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--accent-success)', fontSize: '0.95rem' }}>Protected Endpoint (`POST /orders/v2`)</strong>
              <span className="badge badge-green">IDEMPOTENCY + UNIQUE DB LOCK</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Protected by mandatory `Idempotency-Key` headers, SHA-256 fingerprinting, atomic transaction scope, and SQLite `UNIQUE` key constraints. 10 concurrent requests result in exactly 1 order.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
