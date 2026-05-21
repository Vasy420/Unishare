import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { X, Sparkles, Check } from 'lucide-react';
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

const AvatarPickerModal = ({ open, onClose, token, currentAvatar, onSaved }) => {
  const [seed, setSeed] = useState(() => randomSeed());
  const [selected, setSelected] = useState(currentAvatar || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const grid = useMemo(() => {
    return STYLES.map((style) => ({
      style,
      url: buildDicebearUrl(style, seed),
    }));
  }, [seed]);

  if (!open) return null;

  const save = async (url) => {
    setBusy(true);
    setError(null);
    try {
      const r = await axios.patch(
        `${API}/auth/me/avatar`,
        { avatar_url: url },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onSaved) onSaved(r.data.avatar_url || null);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save avatar');
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pick an avatar</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Avatars powered by DiceBear. Each style uses the same seed; reroll to try a different identity.
          </div>
          <button
            onClick={() => setSeed(randomSeed())}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50"
          >
            Reroll seed
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {grid.map(({ style, url }) => {
            const isSelected = selected === url;
            return (
              <button
                key={style}
                onClick={() => setSelected(url)}
                disabled={busy}
                className={`relative aspect-square rounded-xl border-2 transition-colors flex flex-col items-center justify-center p-2 ${
                  isSelected
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

        {error && (
          <div className="px-6 py-2 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
          <button
            onClick={() => save(null)}
            disabled={busy}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
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
              onClick={() => selected && save(selected)}
              disabled={busy || !selected}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarPickerModal;
