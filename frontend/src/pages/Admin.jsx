import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';



export const Admin = () => {
    const { token, logout, API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [uploads, setUploads] = useState([]);
    const [loadingUploads, setLoadingUploads] = useState(true);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const response = await fetch(`${API_BASE_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            } else {
                console.error('Failed to fetch user list');
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchUploads = async () => {
        try {
            setLoadingUploads(true);
            const response = await fetch(`${API_BASE_URL}/admin/uploads`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUploads(data);
            } else {
                console.error('Failed to fetch uploads list');
            }
        } catch (err) {
            console.error('Error fetching uploads:', err);
        } finally {
            setLoadingUploads(false);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            setLoadingLogs(true);
            const response = await fetch(`${API_BASE_URL}/admin/audit-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAuditLogs(data);
            } else {
                console.error('Failed to fetch audit logs');
            }
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const downloadUploadFile = async (uploadId, filename) => {
        try {
            const response = await fetch(`${API_BASE_URL}/uploads/${uploadId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert('Failed to download file');
            }
        } catch (err) {
            console.error('Error downloading file:', err);
            alert('A network error occurred while downloading.');
        }
    };

    const deleteUploadFile = async (uploadId) => {
        if (!window.confirm("Are you sure you want to delete this dataset from the database? This action cannot be undone.")) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/uploads/${uploadId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                // Refresh uploads list
                fetchUploads();
            } else {
                const data = await response.json();
                alert(data.detail || 'Delete failed');
            }
        } catch (err) {
            console.error('Error deleting upload:', err);
            alert('A network error occurred while deleting.');
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchUploads();
        fetchAuditLogs();
    }, [token]);

    const updateStatus = async (userId, action) => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/${action}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                // Refresh list on success
                fetchUsers();
            } else {
                const data = await response.json();
                alert(data.detail || 'Action failed');
            }
        } catch (err) {
            console.error('Failed to update status:', err);
            alert('A network error occurred. Please try again.');
        }
    };

    const updateSubscription = async (userId, action) => {
        const endpoint = action === 'grant' ? 'grant_subscription' : 'revoke_subscription';
        try {
            const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/${endpoint}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchUsers();
            } else {
                const data = await response.json();
                alert(data.detail || 'Action failed');
            }
        } catch (err) {
            console.error('Error updating subscription:', err);
            alert('A network error occurred.');
        }
    };

    const handleSignOut = () => {
        logout();
        navigate('/admin-login');
    };

    const viewRawUploads = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/uploads`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const jsonWindow = window.open();
                if (jsonWindow) {
                    jsonWindow.document.write('<pre style="color: #0f172a; background-color: #f1f5f9; padding: 20px; font-family: monospace; font-size: 0.9rem; line-height: 1.4;">' + JSON.stringify(data, null, 2) + '</pre>');
                    jsonWindow.document.body.style.backgroundColor = "#f1f5f9";
                    jsonWindow.document.title = "Raw Uploads JSON Log";
                } else {
                    alert("Pop-up blocked! Please allow pop-ups for this website in your browser settings.");
                }
            } else {
                const errData = await response.json();
                alert('Failed to fetch raw uploads: ' + (errData.detail || response.statusText));
            }
        } catch (err) {
            console.error('Error fetching raw uploads:', err);
            alert('A network error occurred while fetching raw uploads.');
        }
    };

    return (
        <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            minHeight: '100vh',
            padding: '40px 8%',
            backgroundImage: `
                radial-gradient(circle at 10% 10%, rgba(37, 99, 235, 0.03) 0%, transparent 40%),
                radial-gradient(circle at 90% 90%, rgba(16, 185, 129, 0.03) 0%, transparent 40%)
            `
        }}>
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '40px',
                paddingBottom: '20px',
                borderBottom: 'none'
            }}>
                <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: '1.8rem',
                    letterSpacing: '-0.5px'
                }}>
                    Rotordyn<span style={{ color: '#2563eb' }}>Admin</span>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button 
                        onClick={viewRawUploads}
                        style={{
                            background: '#f1f5f9',
                            border: 'none',
                            color: '#2563eb',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                            transition: 'all 0.3s'
                        }}
                    >View Raw Uploads JSON</button>
                    <button 
                        onClick={handleSignOut}
                        style={{
                            background: '#f1f5f9',
                            border: 'none',
                            color: '#0f172a',
                            padding: '10px 20px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '4px 4px 10px #cbd5e1, -4px -4px 10px #ffffff',
                            transition: 'all 0.3s'
                        }}
                    >Sign Out</button>
                </div>
            </header>

            <h2 style={{ fontFamily: "'Outfit', sans-serif", marginBottom: '20px', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>User Registrations Approval Queue</h2>

            <div className="neu-card" style={{
                overflow: 'hidden',
                marginBottom: '40px'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <th style={thStyle}>Full Name</th>
                            <th style={thStyle}>Email Address</th>
                            <th style={thStyle}>Company</th>
                            <th style={thStyle}>Intended Purpose</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Subscription</th>
                            <th style={thStyle}>Action Controls</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingUsers ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>Loading registered users list...</td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>No user registrations found.</td>
                            </tr>
                        ) : (
                            users.map((user) => {
                                // Determine status badge styling
                                let badgeColor = '#b45309';
                                let badgeBg = '#fef3c7';
                                if (user.status === 'approved') {
                                    badgeColor = '#065f46';
                                    badgeBg = '#d1fae5';
                                } else if (user.status === 'rejected') {
                                    badgeColor = '#991b1b';
                                    badgeBg = '#fee2e2';
                                } else if (user.status === 'blocked') {
                                    badgeColor = '#7f1d1d';
                                    badgeBg = '#fca5a5';
                                }

                                return (
                                    <tr key={user.id}>
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{user.name}</td>
                                        <td style={tdStyle}>{user.email}</td>
                                        <td style={tdStyle}>{user.company}</td>
                                        <td style={{ 
                                            ...tdStyle,
                                            maxWidth: '250px', 
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis' 
                                        }} title={user.purpose || ''}>
                                            {user.purpose || 'None'}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                color: badgeColor,
                                                backgroundColor: badgeBg
                                            }}>{user.status}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                color: user.subscription_status === 'premium' ? '#0369a1' : '#4b5563',
                                                backgroundColor: user.subscription_status === 'premium' ? '#e0f2fe' : '#f3f4f6'
                                            }}>{user.subscription_status || 'free'}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            {user.role === 'admin' ? (
                                                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>System Administrator</span>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {user.status !== 'approved' && (
                                                            <button style={{ ...actionBtnStyle, backgroundColor: '#10b981' }} onClick={() => updateStatus(user.id, 'approve')}>Approve</button>
                                                        )}
                                                        {user.status !== 'rejected' && (
                                                            <button style={{ ...actionBtnStyle, backgroundColor: '#f59e0b' }} onClick={() => updateStatus(user.id, 'reject')}>Reject</button>
                                                        )}
                                                        {user.status !== 'blocked' && (
                                                            <button style={{ ...actionBtnStyle, backgroundColor: '#ef4444' }} onClick={() => updateStatus(user.id, 'block')}>Block</button>
                                                        )}
                                                    </div>
                                                    {user.status === 'approved' && (
                                                        <div style={{ display: 'flex', gap: '6px', borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                                                            {user.subscription_status !== 'premium' ? (
                                                                <button style={{ ...actionBtnStyle, backgroundColor: '#0284c7' }} onClick={() => updateSubscription(user.id, 'grant')} title="Grant Premium Subscription">Grant Premium</button>
                                                            ) : (
                                                                <button style={{ ...actionBtnStyle, backgroundColor: '#4b5563' }} onClick={() => updateSubscription(user.id, 'revoke')} title="Revoke Premium Subscription">Revoke Premium</button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <h2 style={{ fontFamily: "'Outfit', sans-serif", marginTop: '50px', marginBottom: '20px', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>All Uploaded Datasets</h2>

            <div className="neu-card" style={{
                overflow: 'hidden',
                marginBottom: '40px'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <th style={thStyle}>File Name</th>
                            <th style={thStyle}>File Size</th>
                            <th style={thStyle}>Uploader</th>
                            <th style={thStyle}>Company</th>
                            <th style={thStyle}>Upload Date</th>
                            <th style={thStyle}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingUploads ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>Loading uploaded datasets...</td>
                            </tr>
                        ) : uploads.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>No uploaded datasets found in the database.</td>
                            </tr>
                        ) : (
                            uploads.map((upload) => {
                                const sizeStr = upload.file_size < 1024 * 1024 
                                    ? `${(upload.file_size / 1024).toFixed(1)} KB` 
                                    : `${(upload.file_size / (1024 * 1024)).toFixed(2)} MB`;
                                const uploadDate = new Date(upload.upload_time).toLocaleString();
                                
                                return (
                                    <tr key={upload.id}>
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{upload.original_filename}</td>
                                        <td style={tdStyle}>{sizeStr}</td>
                                        <td style={tdStyle}>
                                            <div style={{ color: '#0f172a', fontWeight: 600 }}>{upload.uploader.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{upload.uploader.email}</div>
                                        </td>
                                        <td style={tdStyle}>{upload.uploader.company}</td>
                                        <td style={tdStyle}>{uploadDate}</td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => downloadUploadFile(upload.id, upload.original_filename)}
                                                    style={{ ...actionBtnStyle, backgroundColor: '#2563eb' }}
                                                >Download</button>
                                                <button 
                                                    onClick={() => deleteUploadFile(upload.id)}
                                                    style={{ ...actionBtnStyle, backgroundColor: '#ef4444' }}
                                                >Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '50px', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>System Audit Trails & Logs</h2>
                <button 
                    onClick={fetchAuditLogs}
                    style={{
                        background: '#f1f5f9',
                        border: 'none',
                        color: '#2563eb',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '3px 3px 6px #cbd5e1, -3px -3px 6px #ffffff',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s'
                    }}
                >Refresh Logs</button>
            </div>

            <div className="neu-card" style={{
                overflow: 'hidden',
                marginBottom: '60px'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <th style={thStyle}>Timestamp</th>
                            <th style={thStyle}>User</th>
                            <th style={thStyle}>Company</th>
                            <th style={thStyle}>Action</th>
                            <th style={thStyle}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingLogs ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>Loading audit logs...</td>
                            </tr>
                        ) : auditLogs.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>No audit logs recorded yet.</td>
                            </tr>
                        ) : (
                            auditLogs.map((log) => {
                                const logDate = new Date(log.created_at).toLocaleString();
                                let actionColor = '#3b82f6';
                                let actionBg = 'rgba(59, 130, 246, 0.1)';
                                if (log.action.startsWith('ADMIN_')) {
                                    actionColor = '#ec4899';
                                    actionBg = 'rgba(236, 72, 153, 0.1)';
                                } else if (log.action.includes('DOWNLOAD') || log.action.includes('DELETE')) {
                                    actionColor = '#ef4444';
                                    actionBg = 'rgba(239, 68, 68, 0.1)';
                                } else if (log.action.includes('UPLOAD')) {
                                    actionColor = '#10b981';
                                    actionBg = 'rgba(16, 185, 129, 0.1)';
                                }
                                
                                return (
                                    <tr key={log.id}>
                                        <td style={tdStyle}>{logDate}</td>
                                        <td style={tdStyle}>
                                            <div style={{ color: '#0f172a', fontWeight: 600 }}>{log.user.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.user.email}</div>
                                        </td>
                                        <td style={tdStyle}>{log.user.company}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '3px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                color: actionColor,
                                                backgroundColor: actionBg
                                            }}>{log.action}</span>
                                        </td>
                                        <td style={{ 
                                            ...tdStyle, 
                                            fontSize: '0.75rem', 
                                            fontFamily: 'monospace', 
                                            color: '#475569',
                                            maxWidth: '300px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }} title={JSON.stringify(log.details)}>
                                            {JSON.stringify(log.details)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const thStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid #cbd5e1',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    letterSpacing: '0.5px'
};

const tdStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid #cbd5e1',
    color: '#0f172a'
};

const actionBtnStyle = {
    padding: '6px 12px',
    fontSize: '0.8rem',
    borderRadius: '6px',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#ffffff',
    boxShadow: '3px 3px 6px #cbd5e1, -3px -3px 6px #ffffff',
    transition: 'all 0.2s'
};
