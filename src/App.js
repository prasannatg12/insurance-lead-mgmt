import React, { useState, useEffect } from 'react';
import './App.css';
import { supabase } from './supabase';
import Dashboard from './Dashboard';
import Leads from './Leads';
import Policies from './Policies';
import Reminders from './Reminders';
import BottomNav from './BottomNav'; // Import the new component

function App() {
  const [view, setView] = useState('dashboard');

  return (
    <div className="App">
      <nav className="sidebar">
        <div className="nav-brand">Agent Portal</div>
        <ul>
          <li 
            role="button"
            tabIndex={0}
            onClick={() => setView('dashboard')} 
            onKeyDown={(e) => e.key === 'Enter' && setView('dashboard')}
            className={view === 'dashboard' ? 'active' : ''}
          >
            Dashboard
          </li>
          <li 
            role="button"
            tabIndex={0}
            onClick={() => setView('leads')} 
            onKeyDown={(e) => e.key === 'Enter' && setView('leads')}
            className={view === 'leads' ? 'active' : ''}
          >
            Leads
          </li>
          <li 
            role="button"
            tabIndex={0}
            onClick={() => setView('policies')} 
            onKeyDown={(e) => e.key === 'Enter' && setView('policies')}
            className={view === 'policies' ? 'active' : ''}
          >
            Policies
          </li>
          <li 
            role="button"
            tabIndex={0}
            onClick={() => setView('reminders')} 
            onKeyDown={(e) => e.key === 'Enter' && setView('reminders')}
            className={view === 'reminders' ? 'active' : ''}
          >
            Reminders
          </li>
        </ul>
      </nav>

      <main className="content">
        {view === 'dashboard' && <Dashboard onNavigate={setView} key={view} />}
        {view === 'leads' && <Leads key={view} />}
        {view === 'policies' && <Policies key={view} />}
        {view === 'reminders' && <Reminders key={view} />}
      </main>
      <BottomNav currentView={view} setView={setView} /> {/* Render BottomNav */}
    </div>
  );
}

export default App;
