import React from 'react';
import MetricCard from '../components/MetricCard';

export function Dashboard({ orderCount = 0 }) {
  const metrics = [
    { title: 'Requests Sent', value: '0', subtitle: 'Total traffic requests', icon: '🚀', color: 'primary' },
    { title: 'Unique Operations', value: orderCount.toString(), subtitle: 'Distinct database orders', icon: '✨', color: 'secondary' },
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
        <span className="phase-badge">Phase 2 Operational</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Core Idempotency Engine & DB Constraints Active
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Protected endpoint `POST /orders/v2` enforces mandatory `Idempotency-Key` headers, SHA-256 payload canonicalization, unique database key indexing, and atomic transaction boundaries.
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
              Serves as the naive control group. Every request creates a new order in the SQLite database without checking retries or duplicate payloads.
            </p>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--accent-success)', fontSize: '0.95rem' }}>Protected Endpoint (`POST /orders/v2`)</strong>
              <span className="badge badge-green">IDEMPOTENCY + UNIQUE DB LOCK</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Protected by mandatory `Idempotency-Key` headers, canonical SHA-256 fingerprinting, atomic SQLite transaction boundaries, and unique key database constraints.
            </p>
          </div>
        </div>
      </div>

      {/* Core Idempotency Algorithm Section */}
      <div className="card-section">
        <h2 className="section-title">
          <span>🧠</span> Core Idempotency Algorithm
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              1. Key Validation
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Rejects missing or invalid keys (must be non-empty string &le; 128 chars) with HTTP 400 Bad Request.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--accent-secondary)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              2. SHA-256 Fingerprint
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Canonicalizes JSON payloads (sorted keys) to compute deterministic SHA-256 digests.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--accent-warning)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              3. Conflict Detection
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Reusing an existing key with altered order payload parameters triggers an HTTP 409 Conflict.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ color: 'var(--accent-success)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              4. Unique DB Constraint
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              SQLite `UNIQUE` index catches concurrent race conditions, rolling back duplicate transactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
