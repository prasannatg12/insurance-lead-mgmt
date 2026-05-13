import React, { useState } from 'react';
import { supabase } from './supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [policyRange, setPolicyRange] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  // Helper to format currency in Indian format
  const formatCurrency = (amount) => {
    const val = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const downloadLeadsPdf = async () => {
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('lic_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Leads Report', 14, 20);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

      const tableRows = data.map(lead => [
        lead.name || 'N/A',
        lead.phone || 'N/A',
        lead.email || 'N/A',
        lead.status || 'N/A',
        lead.created_at ? lead.created_at.split('T')[0] : 'N/A'
      ]);

      autoTable(doc, {
        head: [['Name', 'Phone', 'Email', 'Status', 'Created At']],
        body: tableRows,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [52, 152, 219] }
      });

      doc.save('leads_report.pdf');
    } catch (err) {
      console.error(err);
      alert('Failed to generate Leads PDF: ' + err.message);
    } finally {
      setLoadingLeads(false);
    }
  };

  const downloadPoliciesPdf = async () => {
    setLoadingPolicies(true);
    try {
      // Default to 'start_date' for filtering as per request to remove 'Filter Date By' dropdown
      const defaultPolicyDateType = 'start_date'; 
      let query = supabase
        .from('lic_policies')
        .select('*, lic_leads(name)')
        .order(defaultPolicyDateType, { ascending: true });

      if (policyRange === 'custom' && startDate && endDate) {
        query = query.gte(defaultPolicyDateType, startDate).lte(defaultPolicyDateType, endDate);
      } else if (policyRange === 'this_month') {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        query = query.gte(defaultPolicyDateType, firstDay).lte(defaultPolicyDateType, lastDay);
      }

      const { data, error } = await query;
      if (error) throw error;

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Policy Report', 14, 20);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      const rangeText = policyRange === 'all' ? 'All Time' : 
                       policyRange === 'this_month' ? 'This Month' :
                       `${startDate} to ${endDate}`;
      doc.text(`Filter by: Start Date | Range: ${rangeText}`, 14, 28);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);

      const tableRows = data.map(p => [
        p.policy_name || 'N/A',
        p.lic_leads?.name || 'N/A',
        formatCurrency(p.premium_amount),
        p.start_date || 'N/A',
        p.maturity_date || 'N/A',
        p.status || 'N/A'
      ]);

      autoTable(doc, {
        head: [['Policy #', 'Client', 'Premium', 'Start Date', 'Maturity', 'Status']],
        body: tableRows,
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [46, 204, 113] }
      });

      doc.save(`policy_report_${policyRange}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate Policy PDF: ' + err.message);
    } finally {
      setLoadingPolicies(false);
    }
  };

  return (
    <div className="reports-container">
      <div className="page-header">
        <h2>Reports & Downloads</h2>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-card">
          <h3>Lead Database</h3>
          <p className="empty-text" style={{ textAlign: 'left', padding: '10px 0', color: '#7f8c8d', fontStyle: 'normal' }}>
            Generate a PDF containing all leads, their contact details, and current status.
          </p>
          <div style={{ marginTop: '20px' }}>
            <button className="btn-primary" onClick={downloadLeadsPdf} disabled={loadingLeads}>
              {loadingLeads ? 'Generating...' : 'Download Leads PDF'}
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Policy Analysis</h3>
          <div className="form-group">
            <label>Select Range</label>
            <select value={policyRange} onChange={(e) => setPolicyRange(e.target.value)}>
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {policyRange === 'custom' && (
            <div className="range-inputs" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>From</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>To</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <button 
              className="btn-primary" 
              style={{ backgroundColor: '#2ecc71' }} 
              onClick={downloadPoliciesPdf} 
              disabled={loadingPolicies}
            >
              {loadingPolicies ? 'Generating...' : 'Download Policy PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}