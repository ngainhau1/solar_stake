import React from 'react';
import { connectWallet } from '../lib/stellar';

export default function Wallet({ address, setAddress }) {
  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) setAddress(addr);
  };

  return (
    <header className="glass-panel">
      <div className="logo-container">
        <h1>☀️ SolarStake</h1>
      </div>
      <button 
        className={address ? "" : "primary"} 
        onClick={handleConnect}
      >
        {address 
          ? `${address.slice(0, 5)}...${address.slice(-4)}` 
          : "Connect Freighter"}
      </button>
    </header>
  );
}
