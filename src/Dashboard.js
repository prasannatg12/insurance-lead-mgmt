import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({ 
    leads: 0, 
    converted: 0, 
    reminders: 0, 
    totalPremium: 0,
    statusBreakdown: {},
    upcomingRenewalsCount: 0,
    followUpTodayCount: 0,
    policyStatusBreakdown: {},
    followUpTomorrowCount: 0
  });
  const [upcoming, setUpcoming] = useState([]);
  const [followUpLeads, setFollowUpLeads] = useState([]);
  const [followUpTomorrowLeads, setFollowUpTomorrowLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    fetchDashboardData();

    const handleResize = () => {
      // Detect mobile view based on common 768px breakpoint
      setIsMobileView(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Run once on mount

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    
    // Get local date string in YYYY-MM-DD format (en-CA is robust for this)
    const today = new Date().toLocaleDateString('en-CA');
    const todayEnd = today + 'T23:59:59';
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

    try {
      // Fetch all dashboard data in parallel for world-class performance
      const [
        { count: leads },
        { count: converted },
        { count: pendingRemindersCount },
        { count: upcomingRenewalsCount },
        { count: followUpTodayCount },
        { count: followUpTomorrowCount },
        { data: premiumData },
        { data: leadsData },
        { data: upcomingData },
        { data: followUpLeadsData },
        { data: followUpTomorrowLeadsData }
      ] = await Promise.all([
        supabase.from('lic_leads').select('*', { count: 'exact', head: true }),
        supabase.from('lic_leads').select('*', { count: 'exact', head: true }).eq('status', 'converted'),
        supabase.from('lic_reminders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'failed']).lte('reminder_date', today),
        supabase.from('lic_policies').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('maturity_date', today).lte('maturity_date', thirtyDaysFromNow),
        supabase.from('lic_leads').select('*', { count: 'exact', head: true }).eq('status', 'new').lte('reminder_date', todayEnd),
        supabase.from('lic_leads').select('*', { count: 'exact', head: true }).eq('status', 'new').gte('reminder_date', tomorrow + 'T00:00:00').lte('reminder_date', tomorrow + 'T23:59:59'),
        supabase.from('lic_policies').select('premium_amount, status'),
        supabase.from('lic_leads').select('status'),
        supabase.from('lic_policies').select('*, lic_leads(name)').eq('status', 'active').gte('maturity_date', today).lte('maturity_date', thirtyDaysFromNow).order('maturity_date', { ascending: true }).limit(10),
        supabase.from('lic_leads').select('id, name, phone, email, reminder_date').eq('status', 'new').lte('reminder_date', todayEnd).order('reminder_date', { ascending: true }).limit(5),
        supabase.from('lic_leads').select('id, name, phone, email, reminder_date').eq('status', 'new').gte('reminder_date', tomorrow + 'T00:00:00').lte('reminder_date', tomorrow + 'T23:59:59').order('reminder_date', { ascending: true }).limit(5)
      ]);

      // Calculate Totals
      const totalPremium = premiumData?.reduce((sum, p) => sum + Number(p.premium_amount), 0) || 0;

      const policyBreakdown = premiumData?.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}) || {};

      // Calculate Breakdown
      const breakdown = leadsData?.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {}) || {};

      setStats({ 
        leads: leads || 0, 
        converted: converted || 0, 
        reminders: pendingRemindersCount || 0, 
        totalPremium, 
        statusBreakdown: breakdown, 
        upcomingRenewalsCount: upcomingRenewalsCount || 0,
        policyStatusBreakdown: policyBreakdown,
        followUpTodayCount: followUpTodayCount || 0,
        followUpTomorrowCount: followUpTomorrowCount || 0
      });
      setUpcoming(upcomingData || []);
      setFollowUpLeads(followUpLeadsData || []);
      setFollowUpTomorrowLeads(followUpTomorrowLeadsData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      alert("Failed to refresh dashboard. Please check your connection.");
    }
    setLoading(false);
  }

  if (loading) return <div className="content">Loading Dashboard...</div>;

  // Helper to generate a pie chart using CSS conic-gradient
  const getLeadPieStyle = () => {
    if (stats.leads === 0) return { background: '#eee' };
    
    const colors = {
      new: '#3498db',
      contacted: '#f1c40f',
      converted: '#2ecc71',
      lost: '#e74c3c'
    };

    let currentPercentage = 0;
    const gradient = ['new', 'contacted', 'converted', 'lost']
      .map(status => {
        const count = stats.statusBreakdown[status] || 0;
        const percentage = (count / stats.leads) * 100;
        const start = currentPercentage;
        currentPercentage += percentage;
        return `${colors[status]} ${start}% ${currentPercentage}%`;
      })
      .join(', ');

    return { background: `conic-gradient(${gradient})` };
  };

  const getPolicyPieStyle = () => {
    const totalPolicies = (stats.policyStatusBreakdown.active || 0) + (stats.policyStatusBreakdown.closed || 0);
    if (totalPolicies === 0) return { background: '#eee' };
    
    const colors = {
      active: '#2ecc71', // LightGreen
      closed: '#f08080'  // LightCoral (Light Red)
    };

    let currentPercentage = 0;
    const gradient = ['active', 'closed']
      .map(status => {
        const count = stats.policyStatusBreakdown[status] || 0;
        const percentage = (count / totalPolicies) * 100;
        const start = currentPercentage;
        currentPercentage += percentage;
        return `${colors[status]} ${start}% ${currentPercentage}%`;
      })
      .join(', ');

    return { background: `conic-gradient(${gradient})` };
  };

  const kpiCards = [
    { label: 'Total Leads', value: stats.leads, target: 'leads' },
    { label: 'Total Premium', value: `₹${stats.totalPremium.toLocaleString()}`, target: 'policies' },
    { label: 'Conversion Rate', value: `${stats.leads > 0 ? ((stats.converted / stats.leads) * 100).toFixed(1) : 0}%`, target: 'leads' },
    { label: 'Upcoming Renewals', value: stats.upcomingRenewalsCount, target: 'policies' },
    { label: 'Pending Reminders', value: stats.reminders, target: 'reminders', highlight: true },
    { label: 'Follow Up Today', value: stats.followUpTodayCount, target: 'leads', highlight: true },
    { label: 'Follow Up Tomorrow', value: stats.followUpTomorrowCount, target: 'leads', highlight: true },
  ];

  const todayStr = new Date().toLocaleDateString('en-CA');
  const thirtyDaysFromNowStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2>Dashboard Summary</h2>
        <button className="btn-small" onClick={fetchDashboardData}>Refresh Data</button>
      </div>

      {/* Conditional rendering for KPI cards based on isMobileView */}
      {isMobileView ? (
        <div className="mobile-kpi-tiles-container"> {/* New container for mobile tiles */}
          {kpiCards.map((card, index) => (
            <div key={index} className="stat-card clickable mobile-kpi-tile" onClick={() => onNavigate && onNavigate(card.target)}>
              <h3>
                {card.label}
                {card.label === 'Upcoming Renewals' && (
                  <span
                    className="info-icon"
                    title={`From ${todayStr} to ${thirtyDaysFromNowStr}`}
                    style={{
                      marginLeft: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#7f8c8d'
                    }}
                  >
                    ⓘ
                  </span>
                )}
              </h3>
              <p className={`stat-value ${card.highlight ? 'highlight' : ''}`}>{card.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Row 1: Primary Metrics (Desktop) */}
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            {kpiCards.slice(0, 3).map((card, index) => (
              <div key={index} className="stat-card clickable" onClick={() => onNavigate && onNavigate(card.target)}>
                <h3>{card.label}</h3>
                <p className={`stat-value ${card.highlight ? 'highlight' : ''}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Row 2: Reminders & Follow-ups (Desktop) */}
          <div className="stats-grid">
            {kpiCards.slice(3).map((card, index) => (
              <div key={index + 3} className="stat-card clickable" onClick={() => onNavigate && onNavigate(card.target)}>
                <h3>
                  {card.label}
                  {card.label === 'Upcoming Renewals' && (
                    <span
                      className="info-icon"
                      title={`From ${todayStr} to ${thirtyDaysFromNowStr}`}
                      style={{
                        marginLeft: '8px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: '#7f8c8d'
                      }}
                    >
                      ⓘ
                    </span>
                  )}
                </h3>
                <p className={`stat-value ${card.highlight ? 'highlight' : ''}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={`dashboard-sections ${isMobileView ? 'mobile-dashboard-sections' : ''}`}>
        <div className="dashboard-card status-breakdown">
          <h3>Lead Status Breakdown</h3>
          <div className="pie-section">
            <div className="pie-chart" style={getLeadPieStyle()}></div>
            <div className="pie-legend">
              {['new', 'contacted', 'converted', 'lost'].map(status => (
                <div key={status} className="legend-item">
                  <span className={`legend-color pie-${status}`}></span>
                  <span className="capitalize">{status}</span>
                  <span className="legend-count">{stats.statusBreakdown[status] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-card status-breakdown">
          <h3>Policy Status Breakdown</h3>
          <div className="pie-section">
            <div className="pie-chart" style={getPolicyPieStyle()}></div>
            <div className="pie-legend">
              {['active', 'closed'].map(status => (
                <div key={status} className="legend-item">
                  <span className={`legend-color pie-${status}`}></span>
                  <span className="capitalize">{status}</span>
                  <span className="legend-count">{stats.policyStatusBreakdown[status] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-card upcoming-renewals">
          <h3>Upcoming Renewals (30 Days)</h3>
          {upcoming.length > 0 ? (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Policy</th>
                  <th>Premium</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(item => (
                  <tr key={item.id}>
                    <td>{item.lic_leads?.name}</td>
                    <td>{item.policy_name}</td>
                    <td>₹{Number(item.premium_amount).toLocaleString()}</td>
                    <td>{item.maturity_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">No renewals due in the next 30 days.</p>
          )}
        </div>

        <div className="dashboard-card follow-up-today">
          <h3>Leads to Follow Up Today</h3>
          {followUpLeads.length > 0 ? (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {followUpLeads.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.phone}</td>
                    <td>{item.reminder_date ? item.reminder_date.split('T')[0] : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">No leads require follow-up today.</p>
          )}
        </div>

        <div className="dashboard-card follow-up-tomorrow">
          <h3>Leads to Follow Up Tomorrow</h3>
          {followUpTomorrowLeads.length > 0 ? (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {followUpTomorrowLeads.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.phone}</td>
                    <td>{item.reminder_date ? item.reminder_date.split('T')[0] : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty-text">No leads require follow-up tomorrow.</p>
          )}
        </div>
      </div>
    </div>
  );
}