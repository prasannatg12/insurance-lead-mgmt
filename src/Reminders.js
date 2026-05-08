import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({
    reminderId: null,
    action: '', // 'Renew' or 'Close'
    renewalYears: 1,
    closeReason: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [policyStartDateFilter, setPolicyStartDateFilter] = useState('');
  const [policyMaturityDateFilter, setPolicyMaturityDateFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  useEffect(() => {
    fetchReminders();
  }, []);

  async function fetchReminders() {
    const { data, error } = await supabase
      .from('lic_reminders')
      .select(`
        *,
        lic_policies ( 
          id,
          policy_name,
          start_date,
          maturity_date,
          lic_leads (name)
        )
      `)
      .order('reminder_date', { ascending: true });

    if (!error) setReminders(data);
    setLoading(false);
  }

  const handleActionChange = (reminderId, actionType) => {
    setActionState({
      reminderId: reminderId,
      action: actionType,
      renewalYears: 1, // Reset to default
      closeReason: '' // Reset
    });
  };

  const handleSubmitAction = async () => {
    if (!actionState.reminderId || !actionState.action) {
      alert('Please select an action.');
      return;
    }

    const reminder = reminders.find(r => r.id === actionState.reminderId);
    if (!reminder) {
      alert('Reminder not found.');
      return;
    }

    try {
      if (actionState.action === 'Renew') {
        if (actionState.renewalYears <= 0) {
          alert('Number of years for renewal must be positive.');
          return;
        }

        const currentMaturityDate = new Date(reminder.lic_policies.maturity_date);
        currentMaturityDate.setFullYear(currentMaturityDate.getFullYear() + parseInt(actionState.renewalYears, 10));
        const newMaturityDate = currentMaturityDate.toISOString().split('T')[0];

        // Update the policy's maturity date
        const { error: policyUpdateError } = await supabase
          .from('lic_policies')
          .update({ maturity_date: newMaturityDate })
          .eq('id', reminder.lic_policies.id);

        if (policyUpdateError) throw policyUpdateError;

        // Log the action
        await supabase.from('lic_notifications').insert({
          tenant_id: reminder.tenant_id,
          lead_id: reminder.lic_policies.lic_leads?.id,
          type: 'renewal',
          message: `Policy ${reminder.lic_policies.policy_name} renewed for ${actionState.renewalYears} year(s). New maturity date: ${newMaturityDate}`,
          status: 'success'
        });

      } else if (actionState.action === 'Close') {
        if (!actionState.closeReason.trim()) {
          alert('Please provide a reason for closing.');
          return;
        }

        // Update both the reminder and the associated policy to 'closed'
        const [reminderRes, policyRes] = await Promise.all([
          supabase
            .from('lic_reminders')
            .update({ status: 'closed' })
            .eq('id', actionState.reminderId),
          supabase
            .from('lic_policies')
            .update({ status: 'closed' })
            .eq('id', reminder.lic_policies.id)
        ]);

        if (reminderRes.error) throw reminderRes.error;
        if (policyRes.error) throw policyRes.error;

        // Log the action
        await supabase.from('lic_notifications').insert({
          tenant_id: reminder.tenant_id,
          lead_id: reminder.lic_policies.lic_leads?.id,
          type: 'reminder_closed',
          message: `Reminder for policy ${reminder.lic_policies.policy_name} closed. Reason: ${actionState.closeReason}`,
          status: 'success'
        });
      }

      // Reset action state and re-fetch reminders
      setActionState({ reminderId: null, action: '', renewalYears: 1, closeReason: '' });
      fetchReminders();
    } catch (error) {
      alert(`Error performing action: ${error.message}`);
      console.error('Action submission error:', error);
    }
  };

  // Get local date strings for comparison
  const today = new Date().toLocaleDateString('en-CA');
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

  const filteredReminders = reminders.filter(r => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (r.lic_policies?.policy_name || '').toLowerCase().includes(term) ||
      (r.lic_policies?.lic_leads?.name || '').toLowerCase().includes(term);

    const matchesReminderStartDate = !startDateFilter || r.reminder_date >= startDateFilter;
    const matchesReminderEndDate = !endDateFilter || r.reminder_date <= endDateFilter;

    const matchesPolicyStartDate = !policyStartDateFilter || (r.lic_policies?.start_date && r.lic_policies.start_date >= policyStartDateFilter);
    const matchesPolicyMaturityDate = !policyMaturityDateFilter || (r.lic_policies?.maturity_date && r.lic_policies.maturity_date <= policyMaturityDateFilter);

    return matchesSearch && matchesReminderStartDate && matchesReminderEndDate && matchesPolicyStartDate && matchesPolicyMaturityDate;
  });


  return (
    <div>
      <div className="page-header">
        <h2>Reminders</h2>
      </div>

      <div className="filters-container">
        <input 
          type="text" 
          placeholder="Search by policy or client..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <input 
          type="date" 
          value={startDateFilter}
          onChange={(e) => setStartDateFilter(e.target.value)}
          className="filter-select"
        />
        <input 
          type="date" 
          value={endDateFilter}
          onChange={(e) => setEndDateFilter(e.target.value)}
          className="filter-select"
        />
        <input 
          type="date" 
          placeholder="Policy Start Date"
          value={policyStartDateFilter}
          onChange={(e) => setPolicyStartDateFilter(e.target.value)}
          className="filter-select"
        />
        <input 
          type="date" 
          placeholder="Policy Maturity Date"
          value={policyMaturityDateFilter}
          onChange={(e) => setPolicyMaturityDateFilter(e.target.value)}
          className="filter-select"
        />
      </div>

      {loading ? <p>Loading...</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Policy</th>
              <th>Reminder Date</th>
              <th>Status</th>
              <th>Action</th> {/* New column */}
            </tr>
          </thead>
          <tbody>
            {filteredReminders.map(r => {
              const isWithin30Days = r.status === 'pending' && r.lic_policies?.maturity_date >= today && r.lic_policies?.maturity_date <= thirtyDaysFromNow;
              return (
                <tr key={r.id} className={isWithin30Days ? 'reminder-highlight' : ''}>
                <td data-label="Client">{r.lic_policies?.lic_leads?.name || 'N/A'}</td>
                <td data-label="Policy">{r.lic_policies?.policy_name || 'N/A'}</td>
                <td data-label="Reminder Date">{r.reminder_date}</td>
                <td data-label="Status">
                  <span className={`status-${r.status}`}>
                    {r.status === 'pending' && r.reminder_date > today 
                      ? 'Scheduled' 
                      : r.status
                    }
                  </span>
                </td>
                <td data-label="Action" className={r.status === 'closed' ? 'mobile-hide' : ''}>
                  {r.status === 'pending' && r.reminder_date <= today && (
                    <div className="reminder-actions">
                      <select
                        value={actionState.reminderId === r.id ? actionState.action : ''}
                        onChange={(e) => handleActionChange(r.id, e.target.value)}
                      >
                        <option value="">Select Action</option>
                        <option value="Renew">Renew</option>
                        <option value="Close">Close</option>
                      </select>

                      {actionState.reminderId === r.id && actionState.action === 'Renew' && (
                        <div className="action-input-group">
                          <input
                            type="number"
                            placeholder="Years"
                            min="1"
                            value={actionState.renewalYears}
                            onChange={(e) => setActionState(prev => ({ ...prev, renewalYears: e.target.value }))}
                          />
                          <button className="btn-small btn-primary" onClick={handleSubmitAction}>Submit</button>
                        </div>
                      )}

                      {actionState.reminderId === r.id && actionState.action === 'Close' && (
                        <div className="action-input-group">
                          <input type="text" placeholder="Reason" value={actionState.closeReason} onChange={(e) => setActionState(prev => ({ ...prev, closeReason: e.target.value }))} />
                          <button className="btn-small btn-primary" onClick={handleSubmitAction}>Submit</button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}