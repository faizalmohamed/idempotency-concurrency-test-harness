import React, { useState, useEffect } from 'react';
import { purgeTestData, manualKeyOverride, fetchAdminConfig, updateAdminConfig } from '../services/api';

export function Admin() {
  // Purge State
  const [purgeTarget, setPurgeTarget] = useState('all');
  const [ttlHours, setTtlHours] = useState(24);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  // Key Override State
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideAction, setOverrideAction] = useState('release');
  const [overrideReason, setOverrideReason] = useState('Manual administrative override');
  const [overrideResult, setOverrideResult] = useState(null);
  const [overrideError, setOverrideError] = useState(null);

  // Config State
  const [config, setConfig] = useState({
    artificial_latency_enabled: false,
    artificial_latency_ms: 100,
    default_ttl_hours: 24
  });
  const [configMessage, setConfigMessage] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const cfg = await fetchAdminConfig();
    setConfig(cfg);
  };

  const handleConfirmPurge = async () => {
    try {
      const res = await purgeTestData(purgeTarget, ttlHours);
      setPurgeResult(res);
      setShowPurgeModal(false);
    } catch (err) {
      console.error('Purge error:', err);
      alert('Failed to purge data: ' + err.message);
    }
  };

  const handleExecuteOverride = async (e) => {
    e.preventDefault();
    setOverrideResult(null);
    setOverrideError(null);
    if (!overrideKey.trim()) return;

    try {
      const res = await manualKeyOverride(overrideKey.trim(), overrideAction, overrideReason);
      setOverrideResult(res);
      setOverrideKey('');
    } catch (err) {
      setOverrideError(err.message);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigMessage('');
    try {
      const updated = await updateAdminConfig(config);
      setConfig(updated);
      setConfigMessage('✓ Global configuration updated successfully!');
      setTimeout(() => setConfigMessage(''), 3000);
    } catch (err) {
      alert('Failed to update config: ' + err.message);
    }
  };

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge" style={{ background: 'var(--accent-danger)' }}>Phase 6 Complete</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            System Administration & Lock Management Controls
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Administrative engine for safely purging database test data, manually overriding locked idempotency state locks, and adjusting artificial latency injection parameters.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Card 1: Data Purge Engine */}
        <div className="card-section" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h2 className="section-title" style={{ color: 'var(--accent-danger)' }}>🗑️ Test Data Purge Engine</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Safely purge test orders, idempotency locks, or expired keys while preserving database integrity.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Purge Target Category
              </label>
              <select
                value={purgeTarget}
                onChange={(e) => setPurgeTarget(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              >
                <option value="all">ALL DATA (Orders, Idempotency Keys, Audit Logs)</option>
                <option value="expired_keys">Expired Idempotency Keys Only</option>
                <option value="idempotency_keys">All Idempotency Keys</option>
                <option value="orders">Orders Only</option>
              </select>
            </div>

            {purgeTarget === 'expired_keys' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Expiration Time-To-Live (TTL Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(parseInt(e.target.value) || 24)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
              </div>
            )}

            <button
              onClick={() => setShowPurgeModal(true)}
              style={{ marginTop: '0.5rem', padding: '0.65rem', background: 'var(--accent-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              ⚠️ Purge Selected Data
            </button>

            {purgeResult && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399' }}>
                ✓ {purgeResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Manual Key Lock Override */}
        <div className="card-section" style={{ border: '1px solid rgba(236, 72, 153, 0.3)' }}>
          <h2 className="section-title" style={{ color: '#f472b6' }}>🔑 Idempotency Key Lock Override</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Manually release stuck idempotency keys or force-complete lock records.
          </p>

          <form onSubmit={handleExecuteOverride} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Target Idempotency Key
              </label>
              <input
                type="text"
                required
                placeholder="e.g. key-test-uuid-1234"
                value={overrideKey}
                onChange={(e) => setOverrideKey(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Override Action
              </label>
              <select
                value={overrideAction}
                onChange={(e) => setOverrideAction(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              >
                <option value="release">RELEASE LOCK (Delete key record)</option>
                <option value="force_complete">FORCE COMPLETE (Mark status COMPLETED)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Audit Reason
              </label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
            </div>

            <button
              type="submit"
              style={{ marginTop: '0.5rem', padding: '0.65rem', background: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#f472b6', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              🔓 Execute Key Override
            </button>

            {overrideResult && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399' }}>
                ✓ {overrideResult.message}
              </div>
            )}
            {overrideError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                ❌ {overrideError}
              </div>
            )}
          </form>
        </div>

      </div>

      {/* Global Configuration Controls */}
      <div className="card-section">
        <h2 className="section-title">⚙️ Global Latency & TTL System Settings</h2>
        <form onSubmit={handleSaveConfig} style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={config.artificial_latency_enabled}
                onChange={(e) => setConfig({ ...config, artificial_latency_enabled: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
              />
              <strong>Enable Artificial Latency Injection</strong>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Adds processing delay to all incoming API requests to simulate heavy database lock contention.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Artificial Latency Delay (ms): {config.artificial_latency_ms} ms
            </label>
            <input
              type="range"
              min="0"
              max="2000"
              step="50"
              value={config.artificial_latency_ms}
              onChange={(e) => setConfig({ ...config, artificial_latency_ms: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Default Idempotency Key Time-To-Live (Hours)
            </label>
            <input
              type="number"
              min="1"
              max="720"
              value={config.default_ttl_hours}
              onChange={(e) => setConfig({ ...config, default_ttl_hours: parseInt(e.target.value) || 24 })}
              style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="submit"
              style={{ padding: '0.65rem 1.5rem', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              💾 Save Configuration Settings
            </button>
            {configMessage && <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>{configMessage}</span>}
          </div>
        </form>
      </div>

      {/* Confirm Purge Modal */}
      {showPurgeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-danger)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '480px', width: '90%', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-danger)', marginBottom: '0.75rem' }}>
              ⚠️ Confirm Purge Operation
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              Are you sure you want to purge <strong>{purgeTarget.toUpperCase()}</strong>? This action will permanently remove database records and reset test metrics.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPurgeModal(false)}
                style={{ padding: '0.55rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPurge}
                style={{ padding: '0.55rem 1rem', background: 'var(--accent-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;

