import React from 'react';
import MetricCard from '../components/MetricCard';

export function Dashboard({ orderCount = 0 }) {
  const metrics = [
    { title: 'Requests Sent', value: '0', subtitle: 'Total traffic requests', icon: '🚀', color: 'primary' },
    { title: 'Unique Operations', value: orderCount.toString(), subtitle: 'Distinct order references', icon: '✨', color: 'secondary' },
    { title: 'Duplicates', value: '0', subtitle: 'Unprotected duplicates', icon: '⚠️', color: 'warning' },
    { title: 'Duplicates Prevented', value: '0', subtitle: 'Idempotency protected', icon: '🛡️', color: 'success' },
    { title: 'Conflicts', value: '0', subtitle: '409 Payload Mismatches', icon: '⚡', color: 'danger' },
    { title: 'Overrides', value: '0', subtitle: 'Bypassed locks', icon: '🔑', color: 'purple' },
    { title: 'Baseline p50', value: '0 ms', subtitle: 'Unprotected latency', icon: '⏱️', color: 'primary' },
    { title: 'Protected p50', value: '0 ms', subtitle: 'Idempotent latency', icon: '📈', color: 'secondary' }
  ];

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 1 Active</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Project Foundation & Architecture Operational
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            The SQLite database engine, FastAPI server, SQLAlchemy domain models, and Pydantic validation schemas are fully initialized. Metric counters are ready to track live traffic in Phase 2.
          </p>
        </div>
      </div>

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

      <div className="card-section">
        <h2 className="section-title">
          <span>🧠</span> System Architecture Overview
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>Idempotency-Key Header</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Clients submit a unique request UUID token with checkouts to correlate retries with the original request.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-secondary)', marginBottom: '0.5rem' }}>SHA-256 Fingerprinting</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Normalizes request payload JSON to compute a SHA-256 digest, detecting key reuse with altered payloads (409 Conflict).
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-success)', marginBottom: '0.5rem' }}>Unique DB Constraints</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Enforces database-level unique indexing on `idempotency_key` within SQLite transactions for concurrency safety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
