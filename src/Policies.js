import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState({
    policy_name: '',
    lead_id: '',
    premium_amount: '',
    start_date: '',
    maturity_date: '',
    reminder_offset_days: 30,
    status: 'active'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  useEffect(() => {
    fetchPolicies();
    fetchLeads();
  }, []);

  async function fetchPolicies() {
    const { data, error } = await supabase
      .from('lic_policies')
      .select(`
        *,
        lic_leads (name)
      `)
      .order('created_at', { ascending: false });
    
    if (!error) setPolicies(data);
    setLoading(false);
  }

  async function fetchLeads() {
    const { data } = await supabase.from('lic_leads').select('id, name, status');
    if (data) setLeads(data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { error } = isEditing
      ? await supabase.from('lic_policies').update(currentPolicy).eq('id', currentPolicy.id)
      : await supabase.from('lic_policies').insert([currentPolicy]);

    if (!error) {
      setShowModal(false);
      fetchPolicies();
    } else {
      alert(error.message);
    }
  }

  async function handleDelete(id) {
    if (window.confirm('Delete this policy?')) {
      const { error } = await supabase.from('lic_policies').delete().eq('id', id);
      if (!error) fetchPolicies();
    }
  }

  function openModal(policy = null) {
    if (policy) {
      // Remove nested lead data before setting state for update
      const { lic_leads, ...cleanPolicy } = policy;
      setCurrentPolicy({ ...cleanPolicy, reminder_offset_days: 30 });
      setIsEditing(true);
    } else {
      setCurrentPolicy({
        policy_name: '',
        lead_id: leads[0]?.id || '',
        premium_amount: '',
        start_date: new Date().toISOString().split('T')[0],
        maturity_date: '',
        reminder_offset_days: 30,
        status: 'active'
      });
      setIsEditing(false);
    }
    setShowModal(true);
  }

  const filteredPolicies = policies.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      p.policy_name.toLowerCase().includes(term) ||
      (p.lic_leads?.name && p.lic_leads.name.toLowerCase().includes(term)) ||
      p.premium_amount.toString().includes(term) ||
      p.status.toLowerCase().includes(term);

    const matchesStartDate = !startDateFilter || p.start_date >= startDateFilter;
    const matchesEndDate = !endDateFilter || p.maturity_date <= endDateFilter;

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const selectedLead = leads.find(l => l.id === currentPolicy.lead_id);

  return (
    <div>
      <div className="page-header">
        <h2>Policies</h2>
        <button className="btn-primary" onClick={() => openModal()}>Add New Policy</button>
      </div>

      <div className="filters-container">
        <input 
          type="text" 
          placeholder="Search by policy, client or premium..." 
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
      </div>

      {loading ? <p>Loading...</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Policy Number</th>
              <th>Client</th>
              <th>Premium</th>
              <th>Start Date</th>
              <th>Maturity Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPolicies.map(p => (
              <tr key={p.id} className={p.status === 'closed' ? 'row-closed' : ''}>
                <td data-label="Policy Number">{p.policy_name}</td>
                <td data-label="Client">{p.lic_leads?.name || 'N/A'}</td>
                <td data-label="Premium">₹{p.premium_amount}</td>
                <td data-label="Start Date">{p.start_date}</td>
                <td data-label="Maturity Date">{p.maturity_date}</td>
                <td data-label="Status"><span className={`status-${p.status}`}>{p.status}</span></td>
                <td data-label="Actions" className={p.status === 'closed' ? 'mobile-hide' : ''}>
                  {p.status !== 'closed' && (
                    <>
                      <button className="btn-small" onClick={() => openModal(p)}>Edit</button>
                      <button className="btn-small btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{isEditing ? 'Edit Policy' : 'New Policy'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Policy Number</label>
                <input required value={currentPolicy.policy_name} onChange={e => setCurrentPolicy({...currentPolicy, policy_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Client (Lead)</label>
                <select value={currentPolicy.lead_id} onChange={e => setCurrentPolicy({...currentPolicy, lead_id: e.target.value})}>
                  {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
                </select>
                {selectedLead && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#7f8c8d' }}>
                     This lead is in <span className={`status-${selectedLead.status}`} style={{ fontSize: '0.65rem' }}>
                     {selectedLead.status} 
                    </span> status
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Premium Amount (₹)</label>
                <input type="number" required value={currentPolicy.premium_amount} onChange={e => setCurrentPolicy({...currentPolicy, premium_amount: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" required value={currentPolicy.start_date} onChange={e => setCurrentPolicy({...currentPolicy, start_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Maturity Date</label>
                <input type="date" required value={currentPolicy.maturity_date} onChange={e => setCurrentPolicy({...currentPolicy, maturity_date: e.target.value})} />
              </div>
              <div className="form-group">
                <span style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                  Reminder will be shown in 30 days
                </span>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}