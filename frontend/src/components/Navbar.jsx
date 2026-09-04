import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'simulate-traffic', label: 'Simulate Traffic', icon: '⚡' },
  { id: 'live-orders', label: 'Live Orders', icon: '📦' },
  { id: 'audit-trail', label: 'Audit Trail', icon: '📜' },
  { id: 'admin', label: 'Admin', icon: '⚙️' },
  { id: 'requirements', label: 'Requirements', icon: '📋' },
  { id: 'comparison', label: 'Comparison', icon: '⚖️' },
  { id: 'limitations', label: 'Limitations', icon: '⚠️' }
];

export function Navbar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge">🛡️</div>
        <div>
          <div className="brand-title">Idempotency Core</div>
          <div className="brand-subtitle">Test Harness v1.0</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Navbar;
