import React, { useState, useEffect } from 'react';
import Wallet from './components/Wallet';
import Dashboard from './components/Dashboard';
import ActionPanel from './components/ActionPanel';
import { getProjectDetails } from './lib/stellar';

// For bootcamp demo, we assume project ID is 1
const PROJECT_ID = 1;

function App() {
  const [address, setAddress] = useState(null);
  const [project, setProject] = useState(null);

  const fetchProject = async () => {
    const data = await getProjectDetails(PROJECT_ID);
    if (data) {
      setProject(data);
    } else {
      // Fallback mock data if contract hasn't been initialized by user yet
      setProject({
        capacity_kw: 0,
        total_shares: 0,
        shares_sold: 0,
        price_per_share: 0,
        total_yield: 0
      });
    }
  };

  useEffect(() => {
    fetchProject();
  }, []);

  return (
    <div className="app-container">
      <Wallet address={address} setAddress={setAddress} />
      
      <main>
        <div className="main-content">
          <Dashboard project={project} />
        </div>
        <aside>
          <ActionPanel projectId={PROJECT_ID} refreshData={fetchProject} />
        </aside>
      </main>
    </div>
  );
}

export default App;
