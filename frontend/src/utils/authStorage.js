import { isOfflineMode } from './offline';

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return isOfflineMode() ? window.sessionStorage : window.localStorage;
};

export const getAuthToken = () => {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem('token');
};

export const setAuthToken = (token) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem('token', token);
};

export const clearAuthToken = () => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem('token');
};
