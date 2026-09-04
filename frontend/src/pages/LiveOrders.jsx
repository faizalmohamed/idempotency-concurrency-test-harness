import React, { useState, useEffect } from 'react';
import { fetchOrders } from '../services/api';

export function LiveOrders({ orders = [], onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [orderList, setOrderList] = useState(orders);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Stored Orders List</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live query results from `GET /orders` endpoint</p>
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
            <h3>No Orders Created Yet</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              The SQLite database `orders` table is empty. In Phase 2, baseline and protected requests will populate orders here.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Order Reference</th>
                  <th>Client Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {orderList.map((ord) => (
                  <tr key={ord.id}>
                    <td><span className="badge badge-purple">#{ord.id}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ord.order_reference}</td>
                    <td><span className="badge badge-blue">{ord.client_type}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>${ord.amount.toFixed(2)}</td>
                    <td><span className="badge badge-green">{ord.status}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(ord.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveOrders;
