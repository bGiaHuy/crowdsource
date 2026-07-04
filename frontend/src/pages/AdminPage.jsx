import React, { useState, useEffect } from 'react';
import { adminLogin, getAdminReports, updateReportStatus, getAdminObstacles, updateObstacleStatus } from '../services/api';
import { Trash2, Check, X as XIcon } from 'lucide-react';
import './AdminPage.css';

const AdminPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [reports, setReports] = useState([]);
  const [obstacles, setObstacles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsLoggedIn(true);
      fetchData();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await adminLogin(email, password);
      if (res.data.success) {
        localStorage.setItem('adminToken', res.data.token);
        setIsLoggedIn(true);
        fetchData();
      }
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsLoggedIn(false);
    setReports([]);
    setObstacles([]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, obstaclesRes] = await Promise.all([
        getAdminReports(),
        getAdminObstacles()
      ]);
      setReports(reportsRes.data.reports || []);
      setObstacles(obstaclesRes.data.obstacles || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
    setLoading(false);
  };

  const handleReportStatusChange = async (id, newStatus) => {
    try {
      await updateReportStatus(id, newStatus);
      fetchData(); // Refresh both lists
    } catch (err) {
      console.error('Failed to update report status', err);
      alert('Failed to update status');
    }
  };

  const handleObstacleStatusChange = async (id, newStatus) => {
    try {
      await updateObstacleStatus(id, newStatus);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Failed to update obstacle status', err);
      alert('Failed to update status');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="admin-login-container">
        <form onSubmit={handleLogin} className="admin-login-form">
          <h2>Admin Login</h2>
          {error && <div className="admin-error">{error}</div>}
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="admin-btn">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="admin-btn-logout">Logout</button>
      </header>
      
      <main className="admin-main">
        <h2>Reports</h2>
        {loading ? (
          <p>Loading reports...</p>
        ) : reports.length === 0 ? (
          <p>No reports found.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Building</th>
                <th>Floor</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(report => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>{report.building_code}</td>
                  <td>{report.floor}</td>
                  <td>{report.obstacle_type}</td>
                  <td>{report.description}</td>
                  <td>
                    <span className={`status-badge status-${report.status}`}>
                      {report.status}
                    </span>
                  </td>
                  <td>
                    {report.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleReportStatusChange(report.id, 'aggregated')}
                          style={{ background: '#16A34A', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => handleReportStatusChange(report.id, 'dismissed')}
                          style={{ background: '#DC2626', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Reject"
                        >
                          <XIcon size={16} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#6B7280', fontSize: '14px' }}>No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 style={{ marginTop: '2rem' }}>Current Obstacles</h2>
        {loading ? (
          <p>Loading obstacles...</p>
        ) : obstacles.length === 0 ? (
          <p>No active obstacles found.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Building</th>
                <th>Floor</th>
                <th>Type</th>
                <th>Source</th>
                <th>Votes (+/-)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {obstacles.map(obs => (
                <tr key={obs.id}>
                  <td>{obs.id}</td>
                  <td>{obs.building_code}</td>
                  <td>{obs.floor}</td>
                  <td>{obs.obstacle_type}</td>
                  <td>{obs.source}</td>
                  <td>{obs.upvotes} / {obs.downvotes}</td>
                  <td>
                    <span className={`status-badge status-${obs.status}`}>
                      {obs.status}
                    </span>
                  </td>
                  <td>
                    {obs.status !== 'removed' ? (
                      <button 
                        onClick={() => {
                          if(window.confirm('Are you sure you want to remove this obstacle?')) {
                            handleObstacleStatusChange(obs.id, 'removed');
                          }
                        }}
                        style={{ background: '#DC2626', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remove Obstacle"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <span style={{ color: '#6B7280', fontSize: '14px' }}>Removed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
