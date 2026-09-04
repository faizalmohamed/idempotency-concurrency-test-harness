import React from 'react';

export function LimitationsView() {
  return (
    <div>
      <div className="card-section">
        <h2 className="section-title">⚠️ System Boundaries & Trade-Offs</h2>
        
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-warning)', marginBottom: '0.4rem' }}>1. Local SQLite Single-Node Scope</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Phase 1 utilizes SQLite in WAL (Write-Ahead Logging) mode. While optimal for local execution without complex cluster overhead (Redis/Kafka), cross-instance distributed locking requires Redis/PostgreSQL advisory locks in multi-region deployments.
            </p>
          </div>

          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-warning)', marginBottom: '0.4rem' }}>2. Key Expiration & Storage Growth</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Idempotency records must be assigned a TTL (e.g. 24-48 hours). Retaining key logs indefinitely causes database size inflation without practical retry benefits.
            </p>
          </div>

          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-warning)', marginBottom: '0.4rem' }}>3. Client Key Generation Compliance</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Idempotency protection relies on client software producing cryptographically random UUID v4 keys per unique transaction intent. Weak key generators (e.g. timestamp-only) increase collision risks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LimitationsView;
