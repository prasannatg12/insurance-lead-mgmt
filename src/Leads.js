import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentLead, setCurrentLead] = useState({ name: '', email: '', phone: '', source: '', status: 'new', notes: '', reminder_date: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [viewType, setViewType] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusOptions = ['new', 'contacted', 'converted', 'lost'];

  useEffect(() => {
    fetchLeads();

    // Ensure Kanban is only used on desktop and handle window resizing
    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setViewType('list');
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check on component mount
    return () => window.removeEventListener('resize', handleResize);
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
    
    // Permanent fix for timezone drift:
    // Convert the local datetime string from the input (YYYY-MM-DDTHH:mm) 
    // into a proper UTC ISO string before saving to Supabase.
    const dateToSave = currentLead.reminder_date ? new Date(currentLead.reminder_date + 'T00:00:00') : null;
    const leadData = {
      ...currentLead,
      reminder_date: (currentLead.status === 'new' && dateToSave) 
        ? dateToSave.toISOString() 
        : null
    };

    const { error } = isEditing 
      ? await supabase.from('lic_leads').update(leadData).eq('id', currentLead.id)
      : await supabase.from('lic_leads').insert([leadData]);

    if (!error) {
      setShowModal(false);
      fetchLeads();
      setCurrentLead({ name: '', email: '', phone: '', source: '', status: 'new', notes: '', reminder_date: '' });
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
      // Robust formatting for datetime-local input (requires YYYY-MM-DDTHH:mm).
      // We also trim the status to handle any potential whitespace in database values.
      const normalizedStatus = lead.status?.toLowerCase().trim() || 'new';
      
      let formattedDate = '';
      if (lead.reminder_date) {
        const d = new Date(lead.reminder_date);
        if (!isNaN(d.getTime())) {
          // Format as YYYY-MM-DD in local time for the date input
          const pad = (n) => String(n).padStart(2, '0');
          formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      }

      setCurrentLead({
        ...lead,
        status: normalizedStatus,
        reminder_date: formattedDate
      });
      setIsEditing(true);
    } else {
      setCurrentLead({ name: '', email: '', phone: '', source: '', status: 'new', notes: '', reminder_date: '' });
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
    
    const matchesStatus = statusFilter === 'all' || lead.status?.toLowerCase() === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Drag and Drop Handlers for Kanban
  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e, newStatus) => {
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leads.find(l => l.id.toString() === leadId);
    
    if (lead && lead.status !== newStatus) {
      const { error } = await supabase
        .from('lic_leads')
        .update({ status: newStatus })
        .eq('id', leadId);
      
      if (!error) {
        fetchLeads();
      } else {
        alert(error.message);
      }
    }
  };

  return (
    <div>
      <div className="sticky-header">
        <div className="page-header">
          <h2>Leads</h2>
          <div className="view-controls">
            <div className="view-toggle">
              <button 
                className={`btn-toggle ${viewType === 'list' ? 'active' : ''}`} 
                onClick={() => setViewType('list')}
              >
                List
              </button>
              <button 
                className={`btn-toggle ${viewType === 'kanban' ? 'active' : ''}`} 
                onClick={() => setViewType('kanban')}
              >
                Kanban
              </button>
            </div>
            <button className="btn-primary" onClick={() => openModal()}>Add New Lead</button>
          </div>
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
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        viewType === 'list' ? (
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
                <td data-label="Status">
                  <span className={`status-${l.status}`}>{l.status}</span>
                  {l.status?.toLowerCase().trim() === 'new' && l.reminder_date && (
                    <span 
                      className="info-icon" 
                      title={`Follow-up: ${new Date(l.reminder_date).toLocaleDateString('en-CA')}`}
                      style={{ marginLeft: '6px', cursor: 'pointer', fontSize: '0.9rem', color: '#7f8c8d' }}
                    >
                      ⓘ
                    </span>
                  )}
                </td>
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
        ) : (
          <div className="kanban-board">
            {statusOptions.map(status => (
              <div 
                key={status} 
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <h3 className="capitalize">
                  {status}
                  <span className="kanban-count">
                    {filteredLeads.filter(l => l.status === status).length}
                  </span>
                </h3>
                <div className="kanban-cards">
                  {filteredLeads
                    .filter(l => l.status?.toLowerCase().trim() === status)
                    .map(l => (
                      <div 
                        key={l.id} 
                        className="kanban-card" 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, l.id)}
                        onClick={() => openModal(l)}
                      >
                        <div className="kanban-card-title">{l.name}</div>
                        <div className="kanban-card-info">{l.phone || l.email || 'No contact info'}</div>
                        {l.status === 'new' && l.reminder_date && (
                          <div className="kanban-card-reminder">
                            📅 {new Date(l.reminder_date).toLocaleDateString('en-CA')}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )
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
                      reminder_date: newStatus === 'new' ? currentLead.reminder_date : ''
                    });
                  }}
                >
                  {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {currentLead.status === 'new' && (
                <div className="form-group">
                  <label>Follow-up Reminder (Date)</label>
                  <input 
                    type="date" 
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