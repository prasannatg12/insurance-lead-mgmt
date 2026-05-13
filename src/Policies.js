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
    status: 'active',
    document_path: ''
  });
  const [file, setFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllPolicies, setShowAllPolicies] = useState(false);

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
    const { data, error } = await supabase.from('lic_leads').select('id, name, status');
    if (!error && data) setLeads(data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    let documentPath = currentPolicy.document_path;

    // Handle file upload to Supabase Storage if a new file is selected
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = fileName;

      const { data, error: uploadError } = await supabase.storage
        .from('docs_common')
        .upload(filePath, file);

      if (uploadError) {
        alert('Error uploading document: ' + uploadError.message);
        setLoading(false);
        return;
      }
      documentPath = data.path;
    }

    const policyToSave = { ...currentPolicy, document_path: documentPath };
    const { error } = isEditing
      ? await supabase.from('lic_policies').update(policyToSave).eq('id', currentPolicy.id)
      : await supabase.from('lic_policies').insert([policyToSave]);

    if (!error) {
      setShowModal(false);
      setFile(null);
      fetchPolicies();
      setLoading(false);
    } else {
      alert(error.message);
      setLoading(false);
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
      setCurrentPolicy({ ...cleanPolicy, reminder_offset_days: 30, document_path: cleanPolicy.document_path || '' });
      setFile(null);
      setIsEditing(true);
    } else {
      setCurrentPolicy({
        policy_name: '',
        lead_id: leads[0]?.id || '',
        premium_amount: '',
        start_date: new Date().toISOString().split('T')[0],
        maturity_date: '',
        reminder_offset_days: 30,
        status: 'active',
        document_path: ''
      });
      setFile(null);
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

    // New filter logic: if showAllPolicies is false, hide 'closed' and 'renewed and closed'
    const matchesStatusFilter = showAllPolicies || (p.status !== 'closed' && p.status !== 'renewed and closed');

    return matchesSearch && matchesStatusFilter;
  });

  const selectedLead = leads.find(l => l.id === currentPolicy.lead_id);

  return (
    <div>
      <div className="sticky-header">
        <div className="page-header">
          <h2>Policies</h2>
          <div className="view-controls">
            <div className="view-toggle">
              <button
                className={`btn-toggle ${showAllPolicies ? 'active' : ''}`}
                onClick={() => setShowAllPolicies(true)}
              >
                Show All
              </button>
              <button
                className={`btn-toggle ${!showAllPolicies ? 'active' : ''}`}
                onClick={() => setShowAllPolicies(false)}
              >
                Show Active Only
              </button>
            </div>
            <button className="btn-primary" onClick={() => openModal()}>Add New Policy</button>
          </div>
        </div>

        <div className="filters-container">
          <input 
            type="text" 
            placeholder="Search by policy, client or premium..." 
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
            {filteredPolicies.map(p => {
              const isInactive = p.status === 'closed' || p.status === 'renewed and closed';
              const statusClass = p.status.toLowerCase().replace(/\s+/g, '-');
              return (
                <tr key={p.id} className={isInactive ? 'row-closed' : ''}>
                <td data-label="Policy Number">
                  {p.policy_name}
                  {p.document_path && (
                    <a 
                      href={supabase.storage.from('docs_common').getPublicUrl(p.document_path).data.publicUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ marginLeft: '8px', textDecoration: 'none' }}
                      title="View Document"
                    >
                      📄
                    </a>
                  )}
                </td>
                <td data-label="Client">{p.lic_leads?.name || 'N/A'}</td>
                <td data-label="Premium">₹{p.premium_amount}</td>
                <td data-label="Start Date">{p.start_date}</td>
                <td data-label="Maturity Date">{p.maturity_date}</td>
                <td data-label="Status"><span className={`status-${statusClass}`}>{p.status}</span></td>
                <td data-label="Actions" className={isInactive ? 'mobile-hide' : ''}>
                  {!isInactive && (
                    <>
                      <button className="btn-small" onClick={() => openModal(p)}>Edit</button>
                      <button className="btn-small btn-danger" onClick={() => handleDelete(p.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
              );
            })}
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
                <label>Policy Document (Optional)</label>
                <input 
                  type="file" 
                  onChange={e => setFile(e.target.files[0])}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {currentPolicy.document_path && !file && <p style={{ fontSize: '0.75rem', color: '#7f8c8d' }}>Existing file attached</p>}
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