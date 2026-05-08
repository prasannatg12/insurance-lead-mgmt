import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentLead, setCurrentLead] = useState({ name: '', email: '', phone: '', source: '', status: 'new', notes: '', reminder_date: null });
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusOptions = ['new', 'contacted', 'converted', 'lost'];

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('lic_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setLeads(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { error } = isEditing 
      ? await supabase.from('lic_leads').update(currentLead).eq('id', currentLead.id)
      : await supabase.from('lic_leads').insert([currentLead]);

    if (!error) {
      setShowModal(false);
      fetchLeads();
      setCurrentLead({ name: '', email: '', phone: '', source: '', status: 'new', notes: '', reminder_date: null });
    } else {
      alert(error.message);
    }
  }

  async function handleDelete(id) {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      const { error } = await supabase.from('lic_leads').delete().eq('id', id);
      if (!error) fetchLeads(); else alert(error.message);
    }
  }

  function openModal(lead = null) {
    if (lead) {
      setCurrentLead(lead);
      setIsEditing(true);
    } else {
      setCurrentLead({ name: '', email: '', phone: '', source: '', status: 'new', notes: '', reminder_date: null });
      setIsEditing(false);
    }
    setShowModal(true);
  }

  const filteredLeads = leads.filter(lead => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      lead.name.toLowerCase().includes(term) ||
      (lead.email && lead.email.toLowerCase().includes(term)) ||
      (lead.phone && lead.phone.includes(term));
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Leads</h2>
        <button className="btn-primary" onClick={() => openModal()}>Add New Lead</button>
      </div>

      <div className="filters-container">
        <input 
          type="text" 
          placeholder="Search by name, email, or phone..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Statuses</option>
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(l => (
              <tr key={l.id}>
                <td data-label="Name">{l.name}</td>
                <td data-label="Status"><span className={`status-${l.status}`}>{l.status}</span></td>
                <td data-label="Email">{l.email}</td>
                <td data-label="Phone">{l.phone}</td>
                <td data-label="Actions">
                  <button className="btn-small" onClick={() => openModal(l)}>Edit</button>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(l.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{isEditing ? 'Edit Lead' : 'New Lead'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input required value={currentLead.name} onChange={e => setCurrentLead({...currentLead, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={currentLead.email} onChange={e => setCurrentLead({...currentLead, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={currentLead.phone} onChange={e => setCurrentLead({...currentLead, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select 
                  value={currentLead.status} 
                  onChange={e => {
                    const newStatus = e.target.value;
                    setCurrentLead({
                      ...currentLead, 
                      status: newStatus,
                      reminder_date: newStatus === 'new' ? currentLead.reminder_date : null
                    });
                  }}
                >
                  {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {currentLead.status === 'new' && (
                <div className="form-group">
                  <label>Follow-up Reminder (Date & Time)</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={currentLead.reminder_date || ''} 
                    onChange={e => setCurrentLead({...currentLead, reminder_date: e.target.value})} 
                  />
                </div>
              )}
              <div className="form-group">
                <label>Notes</label>
                <textarea value={currentLead.notes} onChange={e => setCurrentLead({...currentLead, notes: e.target.value})} />
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