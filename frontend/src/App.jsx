import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import SimulateTraffic from './pages/SimulateTraffic';
import LiveOrders from './pages/LiveOrders';
import AuditTrail from './pages/AuditTrail';
import Admin from './pages/Admin';
import RequirementsView from './pages/RequirementsView';
import ComparisonView from './pages/ComparisonView';
import LimitationsView from './pages/LimitationsView';

import { fetchHealthStatus, fetchOrders } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [orders, setOrders] = useState([]);

  const checkBackend = async () => {
    const health = await fetchHealthStatus();
    setBackendStatus(health.status);
    if (health.status === 'ok') {
      const orderData = await fetchOrders();
      setOrders(orderData);
    }
  };

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard orderCount={orders.length} />;
      case 'simulate-traffic':
        return <SimulateTraffic />;
      case 'live-orders':
        return <LiveOrders orders={orders} onRefresh={checkBackend} />;
      case 'audit-trail':
        return <AuditTrail />;
      case 'admin':
        return <Admin />;
      case 'requirements':
        return <RequirementsView />;
      case 'comparison':
        return <ComparisonView />;
      case 'limitations':
        return <LimitationsView />;
      default:
        return <Dashboard orderCount={orders.length} />;
    }
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Header activeTab={activeTab} backendStatus={backendStatus} />
        <main className="page-body">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}

export default App;
