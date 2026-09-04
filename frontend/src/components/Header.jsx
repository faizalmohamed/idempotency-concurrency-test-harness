import React from 'react';

const PAGE_TITLES = {
  'dashboard': 'System Metrics & Health Dashboard',
  'simulate-traffic': 'Workload & Concurrency Traffic Simulator',
  'live-orders': 'Live Database Orders',
  'audit-trail': 'Idempotency Audit & Decision Log',
  'admin': 'Admin Controls & Engine Config',
  'requirements': 'Requirements & System Specifications',
  'comparison': 'Baseline vs Protected Comparison Matrix',
  'limitations': 'System Boundaries & Design Trade-Offs'
};

export function Header({ activeTab, backendStatus }) {
  const isOnline = backendStatus === 'ok';

  return (
    <header className="top-bar">
      <h1 className="page-title-heading">
        {PAGE_TITLES[activeTab] || 'Dashboard'}
      </h1>
      <div className={`status-indicator ${isOnline ? '' : 'status-offline'}`} style={!isOnline ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: 'var(--accent-danger)' } : {}}>
        <div className="status-dot" style={!isOnline ? { backgroundColor: 'var(--accent-danger)', boxShadow: '0 0 8px var(--accent-danger)' } : {}}></div>
        <span>Backend API: {isOnline ? 'Connected' : 'Offline / Initializing'}</span>
      </div>
    </header>
  );
}

export default Header;
