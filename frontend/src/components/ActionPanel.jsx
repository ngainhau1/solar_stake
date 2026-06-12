import React, { useState } from 'react';
import { buyShares, claimYield } from '../lib/stellar';

export default function ActionPanel({ projectId, refreshData }) {
  const [shares, setShares] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleBuy = async (e) => {
    e.preventDefault();
    if (!shares || shares <= 0) return;

    setLoading(true);
    setMsg({ text: 'Sign transaction in Freighter...', type: '' });
    try {
      await buyShares(projectId, parseInt(shares));
      setMsg({ text: 'Shares purchased successfully!', type: 'success' });
      setShares('');
      refreshData();
    } catch (err) {
      setMsg({ text: 'Transaction failed or rejected.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setLoading(true);
    setMsg({ text: 'Checking yield...', type: '' });
    try {
      await claimYield(projectId);
      setMsg({ text: 'Yield claimed to your wallet!', type: 'success' });
      refreshData();
    } catch (err) {
      setMsg({ text: 'No yield available to claim.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel action-form">
      <h3>Invest & Earn</h3>
      <p>Buy shares to earn monthly electricity yields.</p>

      {msg.text && (
        <div className={`alert ${msg.type === 'error' ? 'error' : ''}`}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleBuy} className="form-group">
        <div className="form-row">
          <input
            type="number"
            placeholder="Number of shares to buy"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="primary" disabled={loading || !shares}>
            Buy
          </button>
        </div>
      </form>

      <div className="form-group" style={{ marginTop: '2rem' }}>
        <p>Already an investor? Claim your share of the electricity profits.</p>
        <button onClick={handleClaim} disabled={loading} style={{ width: '100%' }}>
          Claim Yield
        </button>
      </div>
    </div>
  );
}
