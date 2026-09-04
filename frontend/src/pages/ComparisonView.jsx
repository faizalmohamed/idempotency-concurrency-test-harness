import React from 'react';

export function ComparisonView() {
  return (
    <div>
      <div className="card-section">
        <h2 className="section-title">⚖️ Baseline vs Protected Implementation Matrix</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Feature / Dimension</th>
                <th>Baseline Endpoint (Unprotected)</th>
                <th>Protected Endpoint (Idempotent)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Retry Handling</strong></td>
                <td><span className="badge badge-orange">Creates Duplicate Record</span></td>
                <td><span className="badge badge-green">Returns Original Response (200 OK)</span></td>
              </tr>
              <tr>
                <td><strong>Payload Conflict (Same Key)</strong></td>
                <td><span className="badge badge-orange">Creates New Record</span></td>
                <td><span className="badge badge-purple">409 Conflict Rejection</span></td>
              </tr>
              <tr>
                <td><strong>Concurrent Race Window</strong></td>
                <td><span className="badge badge-orange">Multiple DB Inserts Allowed</span></td>
                <td><span className="badge badge-blue">Atomic Unique DB Lock</span></td>
              </tr>
              <tr>
                <td><strong>Audit Logging</strong></td>
                <td><span className="badge badge-blue">Minimal / Standard</span></td>
                <td><span className="badge badge-green">Comprehensive Decision Trail</span></td>
              </tr>
              <tr>
                <td><strong>Transaction Boundary</strong></td>
                <td>Single Table Insert</td>
                <td>Atomic Idempotency Record + Order Transaction</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ComparisonView;
