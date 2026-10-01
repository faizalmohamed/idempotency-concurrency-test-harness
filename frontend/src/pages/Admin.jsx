import React, { useState, useEffect } from 'react';
import { purgeTestData, manualKeyOverride, fetchAdminConfig, updateAdminConfig } from '../services/api';

export function Admin() {
  // Purge & Database Reset State
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [purging, setPurging] = useState(false);

  // TTL Expiration Manager State
  const [ttlHours, setTtlHours] = useState(24);
  const [currentTtl, setCurrentTtl] = useState(24);
  const [pruningTtl, setPruningTtl] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);

  // Key Override State
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideAction, setOverrideAction] = useState('release');
  const [overrideReason, setOverrideReason] = useState('Manual race-condition recovery');
  const [overrideResult, setOverrideResult] = useState(null);
  const [overrideError, setOverrideError] = useState(null);
  const [overriding, setOverriding] = useState(false);

  // Latency & Config State
  const [config, setConfig] = useState({
    artificial_latency_enabled: false,
    artificial_latency_ms: 100,
    default_ttl_hours: 24
  });
  const [configMessage, setConfigMessage] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const cfg = await fetchAdminConfig();
    setConfig(cfg);
    if (cfg.default_ttl_hours) {
      setCurrentTtl(cfg.default_ttl_hours);
      setTtlHours(cfg.default_ttl_hours);
    }
  };

  // 1. Purge all test data
  const handleConfirmPurge = async () => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await purgeTestData('all', ttlHours);
      setPurgeResult(res);
      setShowPurgeModal(false);
    } catch (err) {
      console.error('Purge error:', err);
      alert('Failed to purge data: ' + err.message);
    } finally {
      setPurging(false);
    }
  };

  // 2. Prune expired keys now
  const handlePruneExpiredKeys = async () => {
    setPruningTtl(true);
    setPruneResult(null);
    try {
      const res = await purgeTestData('expired_keys', ttlHours);
      setPruneResult(res);
    } catch (err) {
      console.error('TTL Prune error:', err);
      alert('Failed to prune expired keys: ' + err.message);
    } finally {
      setPruningTtl(false);
    }
  };

  // 3. Manual Key Override
  const handleExecuteOverride = async (e) => {
    e.preventDefault();
    setOverrideResult(null);
    setOverrideError(null);
    if (!overrideKey.trim()) return;

    setOverriding(true);
    try {
      const res = await manualKeyOverride(overrideKey.trim(), overrideAction, overrideReason);
      setOverrideResult(res);
      setOverrideKey('');
    } catch (err) {
      setOverrideError(err.message || 'Key override failed');
    } finally {
      setOverriding(false);
    }
  };

  // 4. Save Latency & Admin Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigMessage('');
    try {
      const updated = await updateAdminConfig(config);
      setConfig(updated);
      if (updated.default_ttl_hours) {
        setCurrentTtl(updated.default_ttl_hours);
      }
      setConfigMessage('✓ Global configuration updated successfully!');
      setTimeout(() => setConfigMessage(''), 3500);
    } catch (err) {
      alert('Failed to update config: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div>
      <div className="phase-banner">
        <span className="phase-badge" style={{ background: 'var(--accent-danger)' }}>Phase 6 Complete</span>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Admin Controls, TTL Pruning & Lock Overrides
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Administrative engine for database reset, background TTL expiration management, manual race-condition recovery, and latency injection.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Card 1: Database Reset Card */}
        <div className="card-section" style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🗑️</span>
            <h2 className="section-title" style={{ margin: 0, color: 'var(--accent-danger)' }}>Database Reset</h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Clears all orders, idempotency records, and audit logs. Foreign keys and database integrity constraints are safely respected.
          </p>

          <button
            onClick={() => setShowPurgeModal(true)}
            style={{ width: '100%', padding: '0.75rem', background: 'var(--accent-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}
          >
            ⚠️ Purge Test Data
          </button>

          {purgeResult && (
            <div style={{ marginTop: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>✓ {purgeResult.message}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                <div>Orders: {purgeResult.purged_orders}</div>
                <div>Keys: {purgeResult.purged_idempotency_records}</div>
                <div>Audit: {purgeResult.purged_audit_logs}</div>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: TTL Expiration Manager */}
        <div className="card-section" style={{ border: '1px solid rgba(59, 130, 246, 0.35)', background: 'rgba(59, 130, 246, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⏳</span>
            <h2 className="section-title" style={{ margin: 0, color: 'var(--accent-primary)' }}>TTL Expiration Manager</h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Prune idempotency records older than the configured TTL. Active and non-expired keys remain intact.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Current Configured TTL:</span>
              <strong style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{currentTtl} hours</strong>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                <span>Prune Window: {ttlHours} hours</span>
                <span>(1 - 168h)</span>
              </div>
              <input
                type="range"
                min="1"
                max="168"
                value={ttlHours}
                onChange={(e) => setTtlHours(parseInt(e.target.value, 10) || 24)}
                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
              />
            </div>

            <button
              onClick={handlePruneExpiredKeys}
              disabled={pruningTtl}
              style={{ padding: '0.65rem', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid var(--accent-primary)', color: '#93c5fd', borderRadius: 'var(--radius-md)', cursor: pruningTtl ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              {pruningTtl ? 'Pruning...' : '🧹 Prune Expired Keys Now'}
            </button>

            {pruneResult && (
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#93c5fd' }}>
                ✓ Purged {pruneResult.purged_idempotency_records} expired keys older than {ttlHours}h.
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Manual Key Override */}
        <div className="card-section" style={{ border: '1px solid rgba(236, 72, 153, 0.35)', background: 'rgba(236, 72, 153, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🔑</span>
            <h2 className="section-title" style={{ margin: 0, color: '#f472b6' }}>Manual Key Override</h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Recover from stuck transactions by releasing or force-completing an idempotency key lock with audit tracking.
          </p>

          <form onSubmit={handleExecuteOverride} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Target Idempotency Key
              </label>
              <input
                type="text"
                required
                placeholder="e.g. key-test-uuid-1234"
                value={overrideKey}
                onChange={(e) => setOverrideKey(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Action
                </label>
                <select
                  value={overrideAction}
                  onChange={(e) => setOverrideAction(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                >
                  <option value="release">Release (Delete lock)</option>
                  <option value="force_complete">Force Complete</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Reason
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={overriding}
              style={{ marginTop: '0.35rem', padding: '0.65rem', background: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.5)', color: '#f472b6', borderRadius: 'var(--radius-md)', cursor: overriding ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              {overriding ? 'Modifying...' : `🔓 Execute ${overrideAction === 'release' ? 'Release' : 'Force Complete'}`}
            </button>

            {overrideResult && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.65rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#34d399' }}>
                ✓ Key <strong>{overrideResult.key}</strong> status changed: <code>{overrideResult.old_status}</code> ➔ <code>{overrideResult.new_status}</code>
              </div>
            )}
            {overrideError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.65rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                ❌ {overrideError}
              </div>
            )}
          </form>
        </div>

        {/* Card 4: Latency Injector */}
        <div className="card-section" style={{ border: '1px solid rgba(16, 185, 129, 0.35)', background: 'rgba(16, 185, 129, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚡</span>
            <h2 className="section-title" style={{ margin: 0, color: 'var(--accent-success)' }}>Latency Injector</h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Inject artificial delays into request handling to simulate high database lock contention and network latency.
          </p>

          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.artificial_latency_enabled}
                  onChange={(e) => setConfig({ ...config, artificial_latency_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-success)' }}
                />
                <strong>Enable Artificial Latency</strong>
              </label>
              <span className={`badge ${config.artificial_latency_enabled ? 'badge-green' : 'badge-gray'}`}>
                {config.artificial_latency_enabled ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                <span>Delay: {config.artificial_latency_ms} ms</span>
                <span>(0 - 2000 ms)</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000"
                step="25"
                value={config.artificial_latency_ms}
                onChange={(e) => setConfig({ ...config, artificial_latency_ms: parseInt(e.target.value, 10) || 0 })}
                style={{ width: '100%', accentColor: 'var(--accent-success)' }}
              />
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              style={{ padding: '0.65rem', background: 'var(--accent-success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: savingConfig ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              {savingConfig ? 'Saving...' : '💾 Save Latency Configuration'}
            </button>

            {configMessage && (
              <div style={{ color: '#34d399', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}>
                {configMessage}
              </div>
            )}
          </form>
        </div>

      </div>

      {/* Red Confirmation Modal for Database Reset */}
      {showPurgeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-surface)', border: '2px solid var(--accent-danger)', borderRadius: 'var(--radius-lg)', padding: '1.75rem', maxWidth: '480px', width: '92%', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-danger)', margin: 0 }}>
                Confirm Test Data Purge
              </h3>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              Are you sure you want to purge <strong>ALL TEST DATA</strong>? This will permanently delete all orders, idempotency state records, and audit log entries in the database.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                style={{ padding: '0.55rem 1.1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurge}
                disabled={purging}
                style={{ padding: '0.55rem 1.1rem', background: 'var(--accent-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: purging ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
              >
                {purging ? 'Purging...' : 'Yes, Purge All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
