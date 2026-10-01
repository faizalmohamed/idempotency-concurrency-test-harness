import React, { useState } from 'react';

export function LimitationsView() {
  const [activeTab, setActiveTab] = useState('boundaries');

  const boundaries = [
    {
      title: '1. Single-Node SQLite WAL vs Multi-Region Distributed Locking',
      severity: 'High Architecture Consideration',
      color: 'var(--accent-warning)',
      desc: 'SQLite WAL mode provides zero-dependency transactional atomicity for local test environments. However, in multi-region microservices spanning multiple container instances, lock coordination requires external distributed stores like Redis (Redlock algorithm) or PostgreSQL Advisory Locks.',
      mitigation: 'In production multi-datacenter deployments, place a Redis lock layer or PostgreSQL `SELECT FOR UPDATE` constraint in front of the database transaction.'
    },
    {
      title: '2. Idempotency Record Storage TTL & Database Growth',
      severity: 'Storage Management',
      color: 'var(--accent-primary)',
      desc: 'Storing idempotency keys indefinitely leads to unbounded database storage inflation. If keys expire too early (e.g. < 1 hour), late retries from disconnected clients will result in duplicate order creations.',
      mitigation: 'Implement automated background TTL pruning (`POST /admin/purge` with target `expired_keys`) setting a standard 24 to 72-hour window.'
    },
    {
      title: '3. Client-Side Idempotency Key Generation Compliance',
      severity: 'Client Integration Rule',
      color: 'var(--accent-purple)',
      desc: 'Idempotency protection relies on clients supplying unique, cryptographically random UUID v4 strings for each logical operation. Insecure key generation (e.g., using low-resolution client timestamps) risks false positive collision blocks.',
      mitigation: 'Enforce strict regex validation (`validate_idempotency_key`) on the server and mandate UUID v4 headers in SDK client libraries.'
    },
    {
      title: '4. Network Partial Failures & In-Flight Timeouts',
      severity: 'Network Edge Case',
      color: 'var(--accent-danger)',
      desc: 'If a client fires a request and the server completes DB insertion but the network drops before delivering the HTTP 201 response, the client sees a timeout.',
      mitigation: 'When the client automatically retries with the exact same `Idempotency-Key`, the engine detects the existing `COMPLETED` record and safely replays stored response body without re-executing order creation logic.'
    },
    {
      title: '5. Out-of-Order Retries & Concurrent Payload Mismatches',
      severity: 'Concurrency Edge Case',
      color: 'var(--accent-danger)',
      desc: 'If a client reuses an `Idempotency-Key` but alters the payload parameters (e.g., changing order amount from $100 to $500), treating it as a simple retry would lead to silent data corruption.',
      mitigation: 'The engine canonicalizes the payload and calculates SHA-256 fingerprints. Mismatched fingerprints trigger an explicit `409 Conflict` response.'
    }
  ];

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge" style={{ background: 'var(--accent-warning)' }}>Phase 8 Complete</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            System Boundaries, Trade-Offs & Edge-Case Failure Analysis
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Comprehensive analysis of architectural boundaries, network failure recovery models, storage trade-offs, and production deployment considerations.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('boundaries')}
          style={{ padding: '0.6rem 1.25rem', background: activeTab === 'boundaries' ? 'var(--accent-primary)' : 'var(--bg-card)', color: activeTab === 'boundaries' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
        >
          ⚠️ Architectural Boundaries & Limitations
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{ padding: '0.6rem 1.25rem', background: activeTab === 'matrix' ? 'var(--accent-primary)' : 'var(--bg-card)', color: activeTab === 'matrix' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
        >
          🔍 Failure Scenario & Recovery Matrix
        </button>
      </div>

      {activeTab === 'boundaries' ? (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {boundaries.map((b, idx) => (
            <div key={idx} className="card-section" style={{ borderLeft: `4px solid ${b.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{b.title}</h3>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: b.color, border: `1px solid ${b.color}` }}>
                  {b.severity}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                {b.desc}
              </p>
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399' }}>
                <strong>💡 Production Mitigation:</strong> {b.mitigation}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-section">
          <h2 className="section-title">🛡️ Edge-Case Failure Mode Handling</h2>
          <div className="table-container" style={{ marginTop: '1rem' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Failure Scenario</th>
                  <th>Observed Symptom</th>
                  <th>Harness Engine Behavior</th>
                  <th>HTTP Status Code</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Mid-Flight Network Drop</strong></td>
                  <td>Client receives no HTTP response</td>
                  <td>DB order committed; retry replays cached result</td>
                  <td><span className="badge badge-green">200 OK (Replayed)</span></td>
                </tr>
                <tr>
                  <td><strong>Concurrent Duplicate Race</strong></td>
                  <td>2+ threads send identical key concurrently</td>
                  <td>Transactional DB unique constraint blocks race</td>
                  <td><span className="badge badge-green">200 OK (Match)</span></td>
                </tr>
                <tr>
                  <td><strong>Payload Conflict Attempt</strong></td>
                  <td>Reused key with modified order amount</td>
                  <td>SHA-256 fingerprint mismatch detected</td>
                  <td><span className="badge badge-purple">409 Conflict</span></td>
                </tr>
                <tr>
                  <td><strong>Missing Header on Legacy Client</strong></td>
                  <td>No `Idempotency-Key` sent</td>
                  <td>Executes unprotected baseline fallback with audit entry</td>
                  <td><span className="badge badge-orange">201 Created (Unprotected)</span></td>
                </tr>
                <tr>
                  <td><strong>Server Mid-Transaction Error</strong></td>
                  <td>Database connection drops mid-flight</td>
                  <td>Transaction rolls back cleanly, no orphan order created</td>
                  <td><span className="badge badge-red">500 Server Error</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default LimitationsView;

