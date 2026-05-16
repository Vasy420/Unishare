import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Shield, Trash2, Ban, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i += 1;
  }
  return `${x.toFixed(x < 10 && i > 0 ? 2 : 0)} ${units[i]}`;
}

function formatDate(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

const AdminView = ({ token, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('files');
  const [busyId, setBusyId] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, f] = await Promise.all([
        axios.get(`${API}/admin/users`, { headers: authHeaders }),
        axios.get(`${API}/admin/files`, { headers: authHeaders }),
      ]);
      setUsers(u.data || []);
      setFiles(f.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const deleteFile = async (file) => {
    if (!window.confirm(`Delete "${file.original_filename}" permanently?`)) return;
    setBusyId(file.id);
    try {
      await axios.delete(`${API}/admin/files/${file.id}`, { headers: authHeaders });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleBlock = async (u) => {
    if (u.is_admin) return;
    const action = u.is_blocked ? 'unblock' : 'block';
    if (!window.confirm(`${action} user "${u.username}"?`)) return;
    setBusyId(u.id);
    try {
      await axios.post(`${API}/admin/users/${u.id}/${action}`, null, { headers: authHeaders });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_blocked: !u.is_blocked } : x)));
    } catch (e) {
      alert(e.response?.data?.detail || `${action} failed`);
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u) => {
    if (u.is_admin) return;
    if (!window.confirm(`Delete user "${u.username}" and ALL their files/history? This cannot be undone.`)) return;
    setBusyId(u.id);
    try {
      await axios.delete(`${API}/admin/users/${u.id}`, { headers: authHeaders });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setFiles((prev) => prev.filter((f) => f.owner_id !== u.id));
    } catch (e) {
      alert(e.response?.data?.detail || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Shield className="w-7 h-7 text-red-600 dark:text-red-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Admin Console</h1>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center space-x-2 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex space-x-2 mb-4 border-b border-gray-200 dark:border-slate-700">
        {['files', 'users'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t === 'files' ? `Files (${files.length})` : `Users (${users.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
      ) : tab === 'files' ? (
        <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left px-4 py-3">File</th>
                <th className="text-left px-4 py-3">Owner</th>
                <th className="text-left px-4 py-3">Size</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Uploaded</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {files.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No files uploaded
                  </td>
                </tr>
              )}
              {files.map((f) => (
                <tr key={f.id} className="text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3 max-w-xs truncate" title={f.original_filename}>
                    {f.original_filename}
                  </td>
                  <td className="px-4 py-3">
                    {f.owner_username}
                    <span className="ml-1 text-xs text-gray-400">({f.owner_type})</span>
                  </td>
                  <td className="px-4 py-3">{formatBytes(f.size)}</td>
                  <td className="px-4 py-3 text-xs">{f.content_type || '—'}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(f.upload_date)}</td>
                  <td className="px-4 py-3 text-xs">{f.source}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={busyId === f.id}
                      onClick={() => deleteFile(f)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Data shared</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {users.map((u) => {
                const self = currentUser && u.id === currentUser.id;
                return (
                  <tr key={u.id} className="text-gray-800 dark:text-gray-100">
                    <td className="px-4 py-3">
                      <span className="mr-1">{u.emoji}</span>
                      {u.username}
                      {self && <span className="ml-2 text-xs text-blue-500">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {u.is_admin ? 'admin' : u.is_guest ? 'guest' : 'registered'}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatBytes(u.total_data_shared)}</td>
                    <td className="px-4 py-3 text-xs">
                      {u.is_blocked ? (
                        <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          blocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {!u.is_admin && !self && (
                        <>
                          <button
                            disabled={busyId === u.id}
                            onClick={() => toggleBlock(u)}
                            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                              u.is_blocked
                                ? 'bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400'
                                : 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                            }`}
                          >
                            {u.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            <span>{u.is_blocked ? 'Unblock' : 'Block'}</span>
                          </button>
                          <button
                            disabled={busyId === u.id}
                            onClick={() => deleteUser(u)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminView;
