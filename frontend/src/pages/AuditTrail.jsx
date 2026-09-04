import React from 'react';

export function AuditTrail() {
  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 1 Model Ready</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Idempotency & Decision Audit Log
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            The `AuditLog` database model is initialized. In Phase 2 & 3, every request decision (`NEW_ORDER_CREATED`, `IDEMPOTENT_REPLAY`, `PAYLOAD_CONFLICT`, `BASELINE_DUPLICATE`) will be appended here with full actor metadata.
          </p>
        </div>
      </div>

      <div className="card-section">
        <h2 className="section-title">📜 Audit Stream Preview</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>Audit Log Stream Ready</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            No audit records logged yet. Traffic simulation in Phase 2 will stream decision records into this view.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuditTrail;
