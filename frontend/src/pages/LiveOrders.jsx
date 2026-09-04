import React, { useState, useEffect } from 'react';
import { fetchOrders, fetchOrderDetails } from '../services/api';

export function LiveOrders({ orders = [], onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [orderList, setOrderList] = useState(orders);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleRefresh = async () => {
    setLoading(true);
    const data = await fetchOrders();
    setOrderList(data);
    setLoading(false);
    if (onRefresh) onRefresh();
  };

  useEffect(() => {
    setOrderList(orders);
  }, [orders]);

  const handleSelectOrder = async (order) => {
    try {
      const details = await fetchOrderDetails(order.id);
      setSelectedOrder(details);
    } catch (err) {
      setSelectedOrder(order);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Database Orders</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Real-time query results with idempotency decision tags and duplicate record indicators
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="nav-link"
          style={{ width: 'auto', background: 'var(--accent-primary)', color: '#fff', padding: '0.5rem 1rem' }}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Orders'}
        </button>
      </div>

      <div className="card-section" style={{ padding: 0, overflow: 'hidden' }}>
        {orderList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3>No orders created yet</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              No orders created yet. Run a traffic simulation on the "Simulate Traffic" page to generate test data.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Order Reference</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Idempotency Key</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((ord) => {
                  const isBaseline = ord.order_reference?.startsWith('ORD-BASE-');
                  const isDuplicate = ord.is_duplicate;

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => handleSelectOrder(ord)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><span className="badge badge-purple">#{ord.id}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ord.order_reference}</td>
                      <td><span className="badge badge-blue">{ord.client_type || 'web'}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>${ord.amount?.toFixed(2)}</td>
                      <td><span className="badge badge-green">{ord.status}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(ord.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-secondary)' }}>
                        {ord.idempotency_key ? ord.idempotency_key : '— (None)'}
                      </td>
                      <td>
                        {isDuplicate ? (
                          <span className="badge badge-orange">BASELINE DUPLICATE</span>
                        ) : isBaseline ? (
                          <span className="badge badge-orange">UNPROTECTED</span>
                        ) : (
                          <span className="badge badge-green">{ord.decision || 'ALLOWED'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-highlight)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '600px', width: '90%', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Order Details: #{selectedOrder.id}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Reference: {selectedOrder.order_reference}
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✖</button>
            </div>

            {/* Explanation Banner */}
            <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', background: selectedOrder.order_reference?.startsWith('ORD-BASE-') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: selectedOrder.order_reference?.startsWith('ORD-BASE-') ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)', color: selectedOrder.order_reference?.startsWith('ORD-BASE-') ? 'var(--accent-warning)' : 'var(--accent-success)', fontSize: '0.85rem' }}>
              <strong>Execution Path Note:</strong>{' '}
              {selectedOrder.order_reference?.startsWith('ORD-BASE-')
                ? 'This order was created through the unprotected baseline path.'
                : 'This order was created through the idempotency-protected path.'}
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <div>Client Type: <strong>{selectedOrder.client_type || 'web'}</strong></div>
              <div>Amount: <strong style={{ fontFamily: 'var(--font-mono)' }}>${selectedOrder.amount?.toFixed(2)}</strong></div>
              <div>Status: <strong>{selectedOrder.status}</strong></div>
              <div>Created At: <strong>{new Date(selectedOrder.created_at).toLocaleString()}</strong></div>
              <div style={{ gridColumn: 'span 2' }}>
                Idempotency Key: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-secondary)' }}>{selectedOrder.idempotency_key || 'N/A (Unprotected Baseline)'}</strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                Decision: <strong>{selectedOrder.decision || 'ALLOWED'}</strong>
              </div>
            </div>

            {/* Payload JSON view */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Request Payload JSON
              </div>
              <div className="code-block" style={{ maxHeight: '180px' }}>
                {selectedOrder.payload_json}
              </div>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              style={{ marginTop: '1.5rem', width: '100%', padding: '0.65rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveOrders;
