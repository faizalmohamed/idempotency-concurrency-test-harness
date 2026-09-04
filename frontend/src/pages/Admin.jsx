import React from 'react';

export function Admin() {
  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 1 Architecture</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            System Administrative Controls
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Admin actions will provide capabilities to reset database states, purge idempotency key locks, adjust TTL expiration timeouts, and toggle simulation parameters.
          </p>
        </div>
      </div>

      <div className="card-section">
        <h2 className="section-title">⚙️ Engine Administration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', opacity: 0.8 }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-danger)', marginBottom: '0.5rem' }}>Purge Database</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clear orders, idempotency keys, and audit logs</p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-warning)', marginBottom: '0.5rem' }}>Key Expiration TTL</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure idempotency record time-to-live</p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>Latency Injector</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inject artificial latency to simulate race conditions</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;
