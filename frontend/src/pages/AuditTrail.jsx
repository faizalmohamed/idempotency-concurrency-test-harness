import React, { useState, useEffect, useCallback } from 'react';
import { fetchAuditLogs, fetchAuditLogDetails, fetchOrderDetails } from '../services/api';

export function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filter states
  const [decisionFilter, setDecisionFilter] = useState('All');
  const [actorFilter, setActorFilter] = useState('All');
  const [searchKey, setSearchKey] = useState('');
  const [searchOrderId, setSearchOrderId] = useState('');
  
  // Applied filters (active query)
  const [appliedFilters, setAppliedFilters] = useState({
    decision_type: 'All',
    actor: 'All',
    idempotency_key: '',
    order_id: ''
  });

  // Pagination states
  const [page, setPage] = useState(0);
  const pageSize = 15;

  // Auto-poll state
  const [autoPoll, setAutoPoll] = useState(true);
  const [loading, setLoading] = useState(false);

  // Inspector Modal states
  const [selectedLog, setSelectedLog] = useState(null);
  const [associatedOrder, setAssociatedOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        limit: pageSize,
        offset: page * pageSize
      };
      if (appliedFilters.decision_type && appliedFilters.decision_type !== 'All') {
        filters.decision_type = appliedFilters.decision_type;
      }
      if (appliedFilters.actor && appliedFilters.actor !== 'All') {
        filters.actor = appliedFilters.actor;
      }
      if (appliedFilters.idempotency_key && appliedFilters.idempotency_key.trim()) {
        filters.idempotency_key = appliedFilters.idempotency_key.trim();
      }
      if (appliedFilters.order_id && appliedFilters.order_id.toString().trim()) {
        filters.order_id = parseInt(appliedFilters.order_id.toString().trim(), 10);
      }

      const data = await fetchAuditLogs(filters);
      setLogs(data.items || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(loadLogs, 4000);
    return () => clearInterval(interval);
  }, [autoPoll, loadLogs]);

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(0);
    setAppliedFilters({
      decision_type: decisionFilter,
      actor: actorFilter,
      idempotency_key: searchKey,
      order_id: searchOrderId
    });
  };

  const handleClearFilters = () => {
    setDecisionFilter('All');
    setActorFilter('All');
    setSearchKey('');
    setSearchOrderId('');
    setPage(0);
    setAppliedFilters({
      decision_type: 'All',
      actor: 'All',
      idempotency_key: '',
      order_id: ''
    });
  };

  const handleInspect = async (log) => {
    setSelectedLog(log);
    setAssociatedOrder(null);

    // If full detail fetch is needed
    try {
      const details = await fetchAuditLogDetails(log.id);
      setSelectedLog(details);
      if (details.order) {
        setAssociatedOrder(details.order);
      } else if (details.order_id) {
        setLoadingOrder(true);
        try {
          const ord = await fetchOrderDetails(details.order_id);
          setAssociatedOrder(ord);
        } catch {
          setAssociatedOrder(null);
        } finally {
          setLoadingOrder(false);
        }
      }
    } catch (err) {
      console.error('Failed to inspect audit log:', err);
    }
  };

  const getDecisionBadge = (decision) => {
    switch (decision) {
      case 'NEW_ORDER_CREATED_PROTECTED':
        return <span className="badge badge-green">ALLOWED (201)</span>;
      case 'IDEMPOTENT_REPLAY':
        return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>REPLAYED (200)</span>;
      case 'PAYLOAD_CONFLICT':
        return <span className="badge badge-purple">CONFLICT (409)</span>;
      case 'NEW_ORDER_CREATED_BASELINE':
        return <span className="badge badge-orange">UNPROTECTED (201)</span>;
      case 'RACE_LOCKED':
        return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>RACE LOCKED</span>;
      case 'MANUAL_OVERRIDE':
        return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' }}>MANUAL OVERRIDE</span>;
      default:
        return <span className="badge badge-gray">{decision}</span>;
    }
  };

  const getDecisionTreeExplanation = (decision) => {
    switch (decision) {
      case 'NEW_ORDER_CREATED_PROTECTED':
        return 'First-time request with unique key. Generated SHA-256 canonical payload fingerprint, acquired atomic transaction lock in database, and executed order creation. Return 201 Created.';
      case 'NEW_ORDER_CREATED_BASELINE':
        return 'Unprotected baseline endpoint. No idempotency protection or lock check enforced. Order record created unconditionally regardless of prior submissions. Return 201 Created.';
      case 'IDEMPOTENT_REPLAY':
        return 'Idempotency key matched existing completed record with identical SHA-256 fingerprint. Original stored response replayed from database without re-executing order creation. Return 200 OK.';
      case 'PAYLOAD_CONFLICT':
        return 'Idempotency key was previously used with a different request payload. Canonical SHA-256 fingerprint mismatch detected. Explicitly rejected to protect against semantic collision. Return 409 Conflict.';
      case 'RACE_LOCKED':
        return 'Concurrent request detected during active in-flight processing window. Atomic unique constraint blocked duplicate race condition. Safe replay completed. Return 200 OK.';
      case 'MANUAL_OVERRIDE':
        return 'Administrative operator manually released or force-completed an idempotency key state lock with recorded reason. Return Status Success.';
      default:
        return 'Audit event processed through transaction state engine.';
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge" style={{ background: 'var(--accent-purple)' }}>Phase 5 Complete</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Immutable Audit Trail Engine & Search UI
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Append-only audit ledger tracking every state transition: New Orders, Replays, Conflicts, Race Locks, and Manual Overrides.
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="card-section" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleApplyFilters}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
            
            {/* Decision Type Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Decision Type
              </label>
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              >
                <option value="All">All</option>
                <option value="New Order">New Order</option>
                <option value="Replay">Replay</option>
                <option value="Conflict">Conflict</option>
                <option value="Race Lock">Race Lock</option>
                <option value="Manual Override">Manual Override</option>
              </select>
            </div>

            {/* Actor Filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Actor Filter
              </label>
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              >
                <option value="All">All</option>
                <option value="Web">Web</option>
                <option value="Mobile">Mobile</option>
                <option value="Retry Agent">Retry Agent</option>
                <option value="Legacy">Legacy</option>
              </select>
            </div>

            {/* Idempotency Key Search */}
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

            {/* Order ID Search */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Order ID Search
              </label>
              <input
                type="number"
                placeholder="e.g. 1"
                value={searchOrderId}
                onChange={(e) => setSearchOrderId(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                style={{ flex: 1, padding: '0.55rem 0.75rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                style={{ padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={loadLogs}
                title="Refresh"
                style={{ padding: '0.55rem 0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                🔄
              </button>
            </div>

          </div>

          {/* Secondary Controls Bar: Auto-poll toggle & pagination info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoPoll}
                onChange={(e) => setAutoPoll(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
              />
              <span>Auto-poll live events (every 4s)</span>
              {autoPoll && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />}
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Showing {logs.length} of {totalCount} events</span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{ padding: '0.3rem 0.65rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}
                >
                  ◀ Prev
                </button>
                <span style={{ padding: '0.3rem 0.5rem', fontFamily: 'var(--font-mono)' }}>
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ padding: '0.3rem 0.65rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: page + 1 >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: page + 1 >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.75rem' }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Audit Log Stream Table */}
      <div className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title">📜 Immutable Audit Trail Ledger</h2>
          {loading && <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>Loading records...</span>}
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3>No audit records found</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              No audit records match the current filter criteria. Run traffic simulations or create orders to see audit records.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Timestamp</th>
                  <th>Decision</th>
                  <th>Order ID</th>
                  <th>Idempotency Key</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => handleInspect(log)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)' }}>#{log.id}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>{getDecisionBadge(log.decision_type)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {log.order_id ? `#${log.order_id}` : '-'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      {log.idempotency_key ? (
                        <span className="badge badge-purple">{log.idempotency_key}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None (Unprotected)</span>
                      )}
                    </td>
                    <td><span className="badge badge-blue">{log.actor}</span></td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {log.details ? (log.details.length > 40 ? log.details.slice(0, 40) + '...' : log.details) : '—'}
                      </span>
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
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '650px', width: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Audit Event Inspector: #{selectedLog.id}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Immutable Ledger Event Record
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✖
              </button>
            </div>

            {/* Decision Tree Explanation Card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.05))', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '0.35rem' }}>
                🧠 Decision Tree Rationale
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>
                {getDecisionTreeExplanation(selectedLog.decision_type)}
              </p>
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div>Timestamp: <strong>{new Date(selectedLog.timestamp).toLocaleString()}</strong></div>
              <div>Decision Type: {getDecisionBadge(selectedLog.decision_type)}</div>
              <div>Actor: <strong>{selectedLog.actor}</strong></div>
              <div>Order ID: <strong>{selectedLog.order_id ? `#${selectedLog.order_id}` : 'None (No order created)'}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}>
                Idempotency Key: <code style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>{selectedLog.idempotency_key || 'None (Unprotected Request)'}</code>
              </div>
            </div>

            {/* Associated Order Details Card */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', fontWeight: 600 }}>
                📦 Associated Order Information
              </div>
              {loadingOrder ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem' }}>Fetching order details...</div>
              ) : associatedOrder ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>Reference: <strong style={{ fontFamily: 'var(--font-mono)' }}>{associatedOrder.order_reference}</strong></div>
                    <div>Amount: <strong>${associatedOrder.amount?.toFixed(2)}</strong></div>
                    <div>Status: <span className="badge badge-green">{associatedOrder.status}</span></div>
                    <div>Client Type: <strong>{associatedOrder.client_type}</strong></div>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.65rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedLog.order_id ? `Order #${selectedLog.order_id} record not found or was purged.` : 'No order associated with this event (e.g. Conflict or Purge).'}
                </div>
              )}
            </div>

            {/* Raw Event Details JSON */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase' }}>
                Full Raw Event Details (JSON)
              </label>
              <pre style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399', overflowX: 'auto', maxHeight: '200px' }}>
                {(() => {
                  try {
                    return JSON.stringify(selectedLog.details ? JSON.parse(selectedLog.details) : selectedLog, null, 2);
                  } catch {
                    return selectedLog.details || '{}';
                  }
                })()}
              </pre>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              style={{ width: '100%', padding: '0.65rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
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
