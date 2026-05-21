import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { X, Sparkles, Check, User } from 'lucide-react';
import { getApiUrl } from '../utils/backendUrl';

const API = getApiUrl();

const STYLES = [
  'adventurer',
  'avataaars',
  'bottts',
  'fun-emoji',
  'lorelei',
  'micah',
  'notionists',
  'open-peeps',
  'personas',
  'pixel-art',
  'thumbs',
];

const buildDicebearUrl = (style, seed) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

const randomSeed = () => Math.random().toString(36).slice(2, 10);

const ProfileModal = ({ open, onClose, token, user, onUpdated }) => {
  const [seed, setSeed] = useState(() => randomSeed());
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar_url || null);
  const [username, setUsername] = useState(user?.username || '');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [usernameError, setUsernameError] = useState('');
  const [tab, setTab] = useState('avatar');

  const grid = useMemo(() => {
    return STYLES.map((style) => ({
      style,
      url: buildDicebearUrl(style, seed),
    }));
  }, [seed]);

  if (!open) return null;

  const isAdmin = user?.is_admin;

  const getUsernameError = (val) => {
    if (isAdmin) return 'Admins cannot change their username';
    const t = val.trim();
    if (!t) return 'Username is required';
    if (t.length < 2 || t.length > 32) return 'Must be 2-32 characters';
    return '';
  };

  const saveAvatar = async (url) => {
    setBusy(true);
    setAvatarError(null);
    try {
      const r = await axios.patch(
        `${API}/auth/me/avatar`,
        { avatar_url: url },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onUpdated) onUpdated({ avatar_url: r.data.avatar_url || null });
      setSelectedAvatar(r.data.avatar_url || null);
    } catch (e) {
      setAvatarError(e.response?.data?.detail || 'Failed to save avatar');
    } finally {
      setBusy(false);
    }
  };

  const saveUsername = async () => {
    const err = getUsernameError(username);
    if (err) { setUsernameError(err); return; }
    setBusy(true);
    setUsernameError('');
    try {
      const r = await axios.patch(
        `${API}/auth/me/username`,
        { username: username.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onUpdated) onUpdated({ username: r.data.username });
      onClose();
    } catch (e) {
      setUsernameError(e.response?.data?.detail || 'Failed to update username');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Profile</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => !isAdmin && setTab('avatar')}
            disabled={isAdmin}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
              isAdmin
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : tab === 'avatar'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Avatar</span>
          </button>
          <button
            onClick={() => !isAdmin && setTab('username')}
            disabled={isAdmin}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${
              isAdmin
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : tab === 'username'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Username</span>
          </button>
        </div>

        {tab === 'avatar' && (
          <>
            <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Avatars powered by DiceBear. Each style uses the same seed; reroll to try a different identity.
              </div>
              <button
                onClick={() => setSeed(randomSeed())}
                disabled={busy || isAdmin}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50"
              >
                Reroll seed
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {grid.map(({ style, url }) => {
                const isSelected = selectedAvatar === url;
                return (
                  <button
                    key={style}
                    onClick={() => !isAdmin && setSelectedAvatar(url)}
                    disabled={busy || isAdmin}
                    className={`relative aspect-square rounded-xl border-2 transition-colors flex flex-col items-center justify-center p-2 ${
                      isAdmin
                        ? 'border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-gray-200 dark:border-slate-600 hover:border-purple-300 dark:hover:border-purple-700'
                    } disabled:opacity-50`}
                  >
                    <img src={url} alt={style} className="w-16 h-16 sm:w-20 sm:h-20" />
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{style}</span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {avatarError && (
              <div className="px-6 py-2 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {avatarError}
              </div>
            )}

            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <button
                onClick={() => !isAdmin && saveAvatar(null)}
                disabled={busy || isAdmin}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove avatar
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => !isAdmin && selectedAvatar && saveAvatar(selectedAvatar)}
                  disabled={busy || !selectedAvatar || isAdmin}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'username' && (
          <div className="p-6">
            {isAdmin ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Profile editing is disabled for admin accounts.</p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  maxLength={32}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameTouched(true);
                    if (usernameError) setUsernameError('');
                  }}
                  onBlur={() => setUsernameTouched(true)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-white"
                  placeholder="Enter new username"
                />
                {usernameTouched && usernameError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{usernameError}</p>
                )}
                {usernameTouched && !usernameError && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{username.trim().length}/32</p>
                )}

                {avatarError && (
                  <div className="mt-4 px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 rounded-lg">
                    {avatarError}
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-2">
                  <button
                    onClick={onClose}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveUsername}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default ProfileModal;