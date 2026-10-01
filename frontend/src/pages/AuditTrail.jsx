import React, { useState, useEffect } from 'react';
import { fetchAuditLogs, fetchAuditLogDetails } from '../services/api';

export function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [decisionFilter, setDecisionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [searchKey, setSearchKey] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (decisionFilter) filters.decision_type = decisionFilter;
      if (actorFilter) filters.actor = actorFilter;
      if (searchKey) filters.idempotency_key = searchKey;

      const data = await fetchAuditLogs(filters);
      setLogs(data.items || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 4000);
    return () => clearInterval(interval);
  }, [decisionFilter, actorFilter, searchKey]);

  const handleInspect = async (logId) => {
    try {
      const details = await fetchAuditLogDetails(logId);
      setSelectedLog(details);
    } catch (err) {
      console.error('Failed to inspect audit log:', err);
    }
  };

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case 'NEW_ORDER_CREATED_PROTECTED':
        return <span className="badge badge-green">ALLOWED (201)</span>;
      case 'IDEMPOTENT_REPLAY':
        return <span className="badge badge-green" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>REPLAYED (200)</span>;
      case 'PAYLOAD_CONFLICT':
        return <span className="badge badge-purple">CONFLICT (409)</span>;
      case 'NEW_ORDER_CREATED_BASELINE':
        return <span className="badge badge-orange">UNPROTECTED (201)</span>;
      case 'MANUAL_OVERRIDE':
        return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' }}>OVERRIDE</span>;
      default:
        return <span className="badge badge-gray">{decision}</span>;
    }
  };

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge" style={{ background: 'var(--accent-purple)' }}>Phase 5 Complete</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Immutable State & Decision Audit Trail
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Real-time append-only ledger tracking all transaction decisions, idempotency lock acquisitions, replay cache hits, payload conflict detections, and admin overrides.
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="card-section" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Decision Type Filter
            </label>
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              <option value="">All Decisions</option>
              <option value="NEW_ORDER_CREATED_PROTECTED">NEW_ORDER_CREATED_PROTECTED</option>
              <option value="IDEMPOTENT_REPLAY">IDEMPOTENT_REPLAY</option>
              <option value="PAYLOAD_CONFLICT">PAYLOAD_CONFLICT</option>
              <option value="NEW_ORDER_CREATED_BASELINE">NEW_ORDER_CREATED_BASELINE</option>
              <option value="MANUAL_OVERRIDE">MANUAL_OVERRIDE</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Actor Filter
            </label>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            >
              <option value="">All Actors</option>
              <option value="web">Web Client</option>
              <option value="legacy">Legacy Client</option>
              <option value="admin">Admin System</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Idempotency Key Search
            </label>
            <input
              type="text"
              placeholder="Search key..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={loadLogs}
              style={{ padding: '0.55rem 1rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', width: '100%' }}
            >
              🔄 Refresh Stream
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Stream Table */}
      <div className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title">📜 Audit Log Ledger ({totalCount} entries)</h2>
          {loading && <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>Loading entries...</span>}
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No audit records found</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              No audit records match the selected filters. Trigger order creations or traffic simulations to view audit logs.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Timestamp</th>
                  <th>Decision Type</th>
                  <th>Idempotency Key</th>
                  <th>Order ID</th>
                  <th>Actor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>#{log.id}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>{getDecisionBadge(log.decision_type)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {log.idempotency_key ? (
                        <span className="badge badge-purple">{log.idempotency_key}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None (Unprotected)</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {log.order_id ? `#${log.order_id}` : '-'}
                    </td>
                    <td><span className="badge badge-blue">{log.actor}</span></td>
                    <td>
                      <button
                        onClick={() => handleInspect(log.id)}
                        style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid var(--border-highlight)', color: '#a5b4fc', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem' }}
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

      {/* Audit Log Inspector Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '600px', width: '90%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Audit Log Details: #{selectedLog.id}
              </h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✖</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div>Timestamp: <strong>{new Date(selectedLog.timestamp).toLocaleString()}</strong></div>
              <div>Decision: {getDecisionBadge(selectedLog.decision_type)}</div>
              <div>Actor: <strong>{selectedLog.actor}</strong></div>
              <div>Order ID: <strong>{selectedLog.order_id || 'N/A'}</strong></div>
              <div style={{ gridColumn: 'span 2' }}>
                Idempotency Key: <code style={{ color: '#a5b4fc' }}>{selectedLog.idempotency_key || 'None'}</code>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                Payload / Event JSON Details
              </label>
              <pre style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399', overflowX: 'auto', maxHeight: '200px' }}>
                {JSON.stringify(selectedLog.details ? JSON.parse(selectedLog.details) : {}, null, 2)}
              </pre>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              style={{ width: '100%', padding: '0.65rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditTrail;

