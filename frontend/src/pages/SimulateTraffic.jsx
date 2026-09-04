import React from 'react';

export function SimulateTraffic() {
  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge">Phase 2 Preview</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Traffic Workload Generator & Concurrency Simulator
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            This page will allow simulating client retries, double-click checkouts, multi-tab racing, and concurrent threads against both Baseline and Protected endpoints.
          </p>
        </div>
      </div>

      <div className="card-section">
        <h2 className="section-title">⚡ Simulation Controls</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', opacity: 0.75 }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Client Retries</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Simulate client retry logic on network timeouts</p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Double-Click Burst</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Simulate rapid repeated button clicking</p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Concurrent Threads</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Launch parallel threads targeting identical keys</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SimulateTraffic;
