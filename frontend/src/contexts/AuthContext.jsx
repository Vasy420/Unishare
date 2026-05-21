import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/authStorage';
import { isOfflineMode } from '../utils/offline';
import { getApiUrl } from '../utils/backendUrl';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const API = getApiUrl();

function generateLocalToken() {
  return 'local-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function createOfflineUser(username, emoji) {
  const now = new Date().toISOString();
  return {
    id: 'local-' + Math.random().toString(36).substring(2, 15),
    username: username || 'Guest',
    email: null,
    is_guest: true,
    emoji: emoji || '👤',
    total_data_shared: 0,
    google_drive_connected: false,
    created_date: now
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getAuthToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    if (token && token.startsWith('local-')) {
      try {
        const saved = getAuthToken();
        const userData = JSON.parse(saved ? saved.split('|')[1] || '{}' : '{}');
        setUser(userData);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const loginAsGuest = async (username, emoji) => {
    try {
      const response = await axios.post(`${API}/auth/guest`, {
        username,
        emoji
      });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      setAuthToken(access_token);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Guest login failed:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Is offline mode:', isOfflineMode());
      const status = error.response?.status;
      if (isOfflineMode() && (status === 0 || status === undefined || status === 429)) {
        const offlineToken = generateLocalToken();
        const offlineUser = createOfflineUser(username, emoji);
        setToken(offlineToken);
        setUser(offlineUser);
        setAuthToken(`${offlineToken}|${JSON.stringify(offlineUser)}`);
        console.info('Offline mode: created synthetic guest user', offlineUser.id);
        return { success: true, user: offlineUser };
      }
      return { success: false, error: error.response?.data?.detail || 'Failed to create guest account' };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await axios.post(`${API}/auth/register`, {
        username,
        email,
        password
      });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      setAuthToken(access_token);
      return { success: true };
    } catch (error) {
      console.error('Registration failed:', error);
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      setAuthToken(access_token);
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const logout = async () => {
    const currentToken = token;
    const wasGuest = !!(user && user.is_guest);
    const isLocal = currentToken && currentToken.startsWith('local-');

    if (wasGuest && currentToken && !isLocal) {
      try {
        await axios.post(`${API}/auth/logout`, null, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
      } catch (err) {
        console.warn('Server-side guest cleanup failed:', err);
      }
    }

    setToken(null);
    setUser(null);
    clearAuthToken();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      loginAsGuest,
      register,
      login,
      logout,
      setToken,
      setUser,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};
