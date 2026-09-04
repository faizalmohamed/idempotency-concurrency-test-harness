import React from 'react';

export function RequirementsView() {
  return (
    <div>
      <div className="card-section">
        <h2 className="section-title">📌 System Requirements Specification</h2>
        
        <h3 style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
          1. Problem Statement
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Duplicate order processing occurs when identical logical operations are submitted repeatedly or concurrently due to client network timeouts, rapid double-clicking on checkout buttons, multi-tab checkout, mobile connection drops, and high-concurrency database race condition windows.
        </p>

        <h3 style={{ color: 'var(--accent-secondary)', fontSize: '1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
          2. System Actors
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', margin: '0.75rem 0' }}>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>🌐 Web Client</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SPA client generating standard Idempotency-Key headers.</p>
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>📱 Mobile Client</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mobile client subject to network drops & automatic retries.</p>
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>🤖 Retry Agent</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automated background proxy retrying unacknowledged calls.</p>
          </div>
          <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <strong style={{ color: '#fff', fontSize: '0.85rem' }}>🏛️ Legacy Client</strong>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client without idempotency header or fingerprint support.</p>
          </div>
        </div>

        <h3 style={{ color: 'var(--accent-success)', fontSize: '1rem', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
          3. Functional & Non-Functional Specifications
        </h3>
        <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <li><strong>Order Creation:</strong> Baseline (unprotected) vs Protected (idempotent) endpoints.</li>
          <li><strong>Duplicate Prevention:</strong> Cache and safely return original HTTP response for matching keys.</li>
          <li><strong>Conflict Detection:</strong> Reject key reuse with altered payload with HTTP 409 Conflict.</li>
          <li><strong>Concurrency Safety:</strong> Database unique indexing on idempotency key with atomic transaction scope.</li>
          <li><strong>Auditability:</strong> Full append-only decision audit logging.</li>
        </ul>
      </div>
    </div>
  );
}

export default RequirementsView;
