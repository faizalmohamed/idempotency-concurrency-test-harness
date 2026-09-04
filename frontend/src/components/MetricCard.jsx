import React from 'react';

export function MetricCard({ title, value, subtitle, icon, color = 'blue' }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className="metric-icon-wrap" style={{ color: `var(--accent-${color}, var(--accent-primary))` }}>
          {icon}
        </div>
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  );
}

export default MetricCard;
