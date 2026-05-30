import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Shield, Trash2, Ban, CheckCircle, RefreshCw, AlertTriangle, VolumeX, Volume2, Pencil, X, Check, Activity, Zap, Clock, Database } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { toastError, toastSuccess } from '../utils/toast';
import webrtcManager from '../utils/webrtcManager2';
import { getApiUrl } from '../utils/backendUrl';

const API = getApiUrl();

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
  const [pendingAction, setPendingAction] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [muteDialog, setMuteDialog] = useState(null);
  const [muteMinutes, setMuteMinutes] = useState('15');
  const [muteBusy, setMuteBusy] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  // Bulk file selection
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());

  // Backend connectivity monitor
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    latency: null,
    dbLatency: null,
    uptime: null,
    lastChecked: null,
  });

  const startRename = (u) => {
    setRenamingId(u.id);
    setRenameDraft(u.username);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  const submitRename = async (u) => {
    const newName = (renameDraft || '').trim();
    if (!newName || newName === u.username) {
      cancelRename();
      return;
    }
    setRenameBusy(true);
    try {
      await axios.patch(`${API}/admin/users/${u.id}/rename`, { username: newName }, { headers: authHeaders });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, username: newName } : x)));
      toastSuccess(`Renamed to ${newName}`);
      cancelRename();
    } catch (e) {
      toastError(e.response?.data?.detail || 'Rename failed');
    } finally {
      setRenameBusy(false);
    }
  };

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
      setSelectedFileIds(new Set());
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const handler = (event) => {
      if (event.type === 'auto_unmuted') {
        fetchAll();
      }
    };
    const prior = webrtcManager.onChatEvent;
    webrtcManager.onChatEvent = handler;
    return () => {
      webrtcManager.onChatEvent = prior;
    };
  }, [fetchAll]);

  // Poll backend health every 5 seconds
  useEffect(() => {
    const checkHealth = async () => {
      const sentAt = performance.now();
      try {
        const res = await axios.get(`${API.replace('/api', '')}/health`, {
          timeout: 10000,
        });
        const latency = Math.round(performance.now() - sentAt);
        setBackendHealth({
          status: res.data.status === 'healthy' ? 'online' : 'degraded',
          latency,
          dbLatency: res.data.database_latency_ms ?? null,
          uptime: res.data.uptime_seconds ?? null,
          lastChecked: new Date().toLocaleTimeString(),
        });
      } catch {
        setBackendHealth((prev) => ({
          ...prev,
          status: 'offline',
          latency: null,
          dbLatency: null,
          lastChecked: new Date().toLocaleTimeString(),
        }));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const deleteFile = (file) =>
    setPendingAction({
      kind: 'deleteFile',
      title: 'Delete file?',
      message: `"${file.original_filename}" will be permanently removed (disk + database).`,
      confirmLabel: 'Delete',
      destructive: true,
      target: file,
    });

  // Bulk selection helpers
  const toggleFileSelection = (fileId) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleSelectAllFiles = () => {
    setSelectedFileIds((prev) => {
      if (prev.size === files.length && files.length > 0) return new Set();
      return new Set(files.map((f) => f.id));
    });
  };

  const clearSelection = () => setSelectedFileIds(new Set());

  const bulkDeleteFiles = () => {
    if (selectedFileIds.size === 0) return;
    const count = selectedFileIds.size;
    setPendingAction({
      kind: 'bulkDeleteFiles',
      title: `Delete ${count} files?`,
      message: `${count} selected file${count > 1 ? 's' : ''} will be permanently removed from disk and database. This cannot be undone.`,
      confirmLabel: `Delete ${count}`,
      destructive: true,
      target: null,
    });
  };

  const toggleBlock = (u) => {
    if (u.is_admin) return;
    setPendingAction({
      kind: u.is_blocked ? 'unblock' : 'block',
      title: u.is_blocked ? 'Unblock user?' : 'Block user?',
      message: u.is_blocked
        ? `Restore "${u.username}"'s access. They will be able to log in again.`
        : `Prevent "${u.username}" from logging in. They keep their data but cannot sign in.`,
      confirmLabel: u.is_blocked ? 'Unblock' : 'Block',
      destructive: !u.is_blocked,
      target: u,
    });
  };

  const muteUser = (u) => {
    setMuteDialog(u);
    setMuteMinutes('15');
  };

  const unmuteUser = (u) =>
    setPendingAction({
      kind: 'unmute',
      title: 'Unmute user?',
      message: `Restore chat access for "${u.username}".`,
      confirmLabel: 'Unmute',
      destructive: false,
      target: u,
    });

  const deleteUser = (u) => {
    if (u.is_admin) return;
    setPendingAction({
      kind: 'deleteUser',
      title: 'Delete user?',
      message: `"${u.username}" and ALL their files + history will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete user',
      destructive: true,
      target: u,
    });
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    const { kind, target } = pendingAction;
    setActionBusy(true);
    try {
      if (kind === 'deleteFile') {
        await axios.delete(`${API}/admin/files/${target.id}`, { headers: authHeaders });
        setFiles((prev) => prev.filter((f) => f.id !== target.id));
        toastSuccess('File deleted');
      } else if (kind === 'block' || kind === 'unblock') {
        await axios.post(`${API}/admin/users/${target.id}/${kind}`, null, { headers: authHeaders });
        setUsers((prev) => prev.map((x) => (x.id === target.id ? { ...x, is_blocked: kind === 'block' } : x)));
        toastSuccess(`User ${kind}ed`);
      } else if (kind === 'unmute') {
        await axios.post(`${API}/admin/users/${target.id}/unmute`, null, { headers: authHeaders });
        setUsers((prev) => prev.map((x) => (x.id === target.id ? { ...x, muted_until: null } : x)));
        toastSuccess('User unmuted');
      } else if (kind === 'deleteUser') {
        await axios.delete(`${API}/admin/users/${target.id}`, { headers: authHeaders });
        setUsers((prev) => prev.filter((x) => x.id !== target.id));
        setFiles((prev) => prev.filter((f) => f.owner_id !== target.id));
        toastSuccess('User deleted');
      } else if (kind === 'bulkDeleteFiles') {
        const ids = Array.from(selectedFileIds);
        const res = await axios.delete(`${API}/admin/files/bulk-delete`, {
          headers: authHeaders,
          params: { file_ids: ids },
        });
        setFiles((prev) => prev.filter((f) => !selectedFileIds.has(f.id)));
        setSelectedFileIds(new Set());
        toastSuccess(`${res.data.deleted_count} files deleted`);
      }
      setPendingAction(null);
    } catch (e) {
      toastError(e.response?.data?.detail || 'Action failed');
    } finally {
      setActionBusy(false);
    }
  };

  const confirmMute = async () => {
    if (!muteDialog) return;
    const n = parseInt(muteMinutes, 10);
    if (!n || n < 1) {
      toastError('Enter a number ≥ 1');
      return;
    }
    setMuteBusy(true);
    try {
      const r = await axios.post(`${API}/admin/users/${muteDialog.id}/mute?minutes=${n}`, null, { headers: authHeaders });
      setUsers((prev) => prev.map((x) => (x.id === muteDialog.id ? { ...x, muted_until: r.data.muted_until } : x)));
      toastSuccess(`${muteDialog.username} muted for ${n} min`);
      setMuteDialog(null);
    } catch (e) {
      toastError(e.response?.data?.detail || 'Mute failed');
    } finally {
      setMuteBusy(false);
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

      {/* Backend Health Monitor */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Status Card */}
        <div className={`rounded-xl border p-4 flex items-center space-x-3 ${
          backendHealth.status === 'online'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : backendHealth.status === 'degraded'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className={`p-2 rounded-lg ${
            backendHealth.status === 'online'
              ? 'bg-emerald-100 dark:bg-emerald-900/40'
              : backendHealth.status === 'degraded'
              ? 'bg-yellow-100 dark:bg-yellow-900/40'
              : 'bg-red-100 dark:bg-red-900/40'
          }`}>
            <Activity className={`w-5 h-5 ${
              backendHealth.status === 'online'
                ? 'text-emerald-600 dark:text-emerald-400'
                : backendHealth.status === 'degraded'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Backend Status</p>
            <p className={`text-sm font-semibold ${
              backendHealth.status === 'online'
                ? 'text-emerald-700 dark:text-emerald-300'
                : backendHealth.status === 'degraded'
                ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {backendHealth.status === 'online' ? 'Online' : backendHealth.status === 'degraded' ? 'Degraded' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Latency Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center space-x-3">
          <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">HTTP Latency</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {backendHealth.latency !== null ? `${backendHealth.latency} ms` : '—'}
            </p>
          </div>
        </div>

        {/* DB Latency Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center space-x-3">
          <div className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg">
            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">DB Latency</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {backendHealth.dbLatency !== null ? `${backendHealth.dbLatency} ms` : '—'}
            </p>
          </div>
        </div>

        {/* Uptime Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex items-center space-x-3">
          <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
            <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Uptime</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatUptime(backendHealth.uptime)}
            </p>
          </div>
        </div>
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
        <div className="space-y-3">
          {/* Bulk action bar */}
          {selectedFileIds.size > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {selectedFileIds.size} file{selectedFileIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={clearSelection}
                  className="px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600"
                >
                  Clear
                </button>
                <button
                  onClick={bulkDeleteFiles}
                  className="flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete {selectedFileIds.size}</span>
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={files.length > 0 && selectedFileIds.size === files.length}
                      onChange={toggleSelectAllFiles}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                  </th>
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
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No files uploaded
                    </td>
                  </tr>
                )}
                {files.map((f) => (
                  <tr key={f.id} className={`text-gray-800 dark:text-gray-100 ${selectedFileIds.has(f.id) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedFileIds.has(f.id)}
                        onChange={() => toggleFileSelection(f.id)}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
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
                      {renamingId === u.id ? (
                        <span className="inline-flex items-center space-x-1 align-middle">
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitRename(u);
                              if (e.key === 'Escape') cancelRename();
                            }}
                            disabled={renameBusy}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <button onClick={() => submitRename(u)} disabled={renameBusy} className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelRename} disabled={renameBusy} className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ) : (
                        <>
                          {u.username}
                          {!u.is_admin && !self && (
                            <button
                              onClick={() => startRename(u)}
                              className="ml-2 p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Rename user"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {self && <span className="ml-2 text-xs text-blue-500">(you)</span>}
                        </>
                      )}
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
                      ) : u.online ? (
                        <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          online
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          offline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {!u.is_admin && !self && (
                        <>
                          {u.muted_until ? (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => unmuteUser(u)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 disabled:opacity-50"
                            >
                              <Volume2 className="w-4 h-4" />
                              <span>Unmute</span>
                            </button>
                          ) : (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => muteUser(u)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 disabled:opacity-50"
                            >
                              <VolumeX className="w-4 h-4" />
                              <span>Mute</span>
                            </button>
                          )}
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

      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction?.title || ''}
        message={pendingAction?.message || ''}
        confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
        destructive={!!pendingAction?.destructive}
        busy={actionBusy}
        onConfirm={runPendingAction}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />

      {muteDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center space-x-2">
              <VolumeX className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mute user</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Mute <span className="font-semibold">{muteDialog.username}</span> from chat for how many minutes?
              </p>
              <input
                type="number"
                min="1"
                value={muteMinutes}
                onChange={(e) => setMuteMinutes(e.target.value)}
                disabled={muteBusy}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 flex justify-end space-x-2">
              <button
                onClick={() => !muteBusy && setMuteDialog(null)}
                disabled={muteBusy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMute}
                disabled={muteBusy}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
              >
                {muteBusy ? 'Muting…' : 'Mute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
