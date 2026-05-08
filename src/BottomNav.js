import React from 'react';

export default function BottomNav({ currentView, setView }) {
  return (
    <div className="bottom-nav">
      <div
        className={`bottom-nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
        onClick={() => setView('dashboard')}
      >
        Dashboard
      </div>
      <div
        className={`bottom-nav-item ${currentView === 'leads' ? 'active' : ''}`}
        onClick={() => setView('leads')}
      >
        Leads
      </div>
      <div
        className={`bottom-nav-item ${currentView === 'policies' ? 'active' : ''}`}
        onClick={() => setView('policies')}
      >
        Policies
      </div>
      <div
        className={`bottom-nav-item ${currentView === 'reminders' ? 'active' : ''}`}
        onClick={() => setView('reminders')}
      >
        Reminders
      </div>
    </div>
  );
}