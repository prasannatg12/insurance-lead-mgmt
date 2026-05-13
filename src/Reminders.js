import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({
    reminderId: null,
    action: '', // 'Renew' or 'Close'
    startDate: '',
    endDate: '',
    closeReason: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

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
          status,
          lic_leads (name)
        )
      `)
      .neq('status', 'closed')
      .order('reminder_date', { ascending: true });

    if (!error) setReminders(data);
    setLoading(false);
  }

  const handleActionChange = (reminderId, actionType) => {
    setActionState({
      reminderId: reminderId,
      action: actionType,
      startDate: new Date().toLocaleDateString('en-CA'),
      endDate: '',
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
        if (!actionState.startDate || !actionState.endDate) {
          alert('Please provide both start and end dates.');
          return;
        }

        const today = actionState.startDate;
        const newMaturityDate = actionState.endDate;

        // Fetch full old policy details to clone
        const { data: oldPolicy, error: fetchErr } = await supabase
          .from('lic_policies')
          .select('*')
          .eq('id', reminder.lic_policies.id)
          .single();

        if (fetchErr) throw fetchErr;

        // 1. Insert new active policy row
        const { error: insertErr } = await supabase
          .from('lic_policies')
          .insert([{
            policy_name: oldPolicy.policy_name,
            lead_id: oldPolicy.lead_id,
            premium_amount: oldPolicy.premium_amount,
            start_date: today,
            maturity_date: newMaturityDate,
            status: 'active',
            document_path: oldPolicy.document_path,
            reminder_offset_days: oldPolicy.reminder_offset_days
          }]);

        if (insertErr) throw insertErr;

        // 2. Update the old policy's status
        const { error: policyUpdateError } = await supabase
          .from('lic_policies')
          .update({ status: 'renewed and closed' })
          .eq('id', oldPolicy.id);

        if (policyUpdateError) throw policyUpdateError;

        // 3. Close the current reminder
        const { error: closeRemErr } = await supabase
          .from('lic_reminders')
          .update({ status: 'closed' })
          .eq('id', actionState.reminderId);

        if (closeRemErr) throw closeRemErr;

        // Log the action
        await supabase.from('lic_notifications').insert({
          tenant_id: reminder.tenant_id,
          lead_id: oldPolicy.lead_id,
          type: 'renewal',
          message: `Policy ${oldPolicy.policy_name} renewed. New term: ${today} to ${newMaturityDate}. Old policy marked as renewed and closed.`,
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
      setActionState({ reminderId: null, action: '', startDate: '', endDate: '', closeReason: '' });
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

    const isPolicyClosed = r.lic_policies?.status === 'closed' || r.lic_policies?.status === 'renewed and closed';
    return matchesSearch && !isPolicyClosed;
  });


  return (
    <div>
      <div className="sticky-header">
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
        </div>
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
                        <div className="action-input-group" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Start Date</label>
                              <input
                                type="date"
                                value={actionState.startDate}
                                onChange={(e) => setActionState(prev => ({ ...prev, startDate: e.target.value }))}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>End Date</label>
                              <input
                                type="date"
                                value={actionState.endDate}
                                onChange={(e) => setActionState(prev => ({ ...prev, endDate: e.target.value }))}
                              />
                            </div>
                          </div>
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