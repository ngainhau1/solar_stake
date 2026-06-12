import React from 'react';
import { stroopsToXlm } from '../lib/stellar';

export default function Dashboard({ project }) {
  if (!project) {
    return (
      <div className="glass-panel">
        <p>Loading project details from blockchain...</p>
      </div>
    );
  }

  // project mapping based on our Rust struct:
  // owner, capacity_kw, total_shares, shares_sold, price_per_share, total_yield
  const capacity = project.capacity_kw || 0;
  const totalShares = project.total_shares || 0;
  const sold = project.shares_sold || 0;
  const price = project.price_per_share || 0;
  const yieldTotal = project.total_yield || 0;

  return (
    <div className="glass-panel">
      <div className="action-form">
        <h3>System Overview</h3>
        <p>Live status of the SolarStake grid #1</p>
      </div>
      
      <div className="dashboard-grid">
        <div className="stat-card">
          <span className="label">Capacity</span>
          <span className="value">{capacity} kW</span>
        </div>
        <div className="stat-card">
          <span className="label">Shares Available</span>
          <span className="value">{totalShares - sold} / {totalShares}</span>
        </div>
        <div className="stat-card">
          <span className="label">Price per Share</span>
          <span className="value">{stroopsToXlm(price)} XLM</span>
        </div>
        <div className="stat-card">
          <span className="label">Total Yield Generated</span>
          <span className="value">{stroopsToXlm(yieldTotal)} XLM</span>
        </div>
      </div>
    </div>
  );
}
