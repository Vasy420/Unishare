const isPrivateIp = (hostname) => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((value) => Number(value));
  if (octets.some((value) => Number.isNaN(value))) return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isLocalHostname = (hostname) => {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.endsWith('.local')) return true;
  return isPrivateIp(hostname);
};

export const isOfflineMode = () => {
  if (process.env.REACT_APP_OFFLINE_MODE === 'true') return true;
  if (process.env.REACT_APP_OFFLINE_MODE === 'false') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (typeof window !== 'undefined' && window.__UNISHARE_OFFLINE__ === true) return true;
  return false;
};

export const getWebRtcIceServers = () => {
  const rawServers = process.env.REACT_APP_WEBRTC_ICE_SERVERS || '';
  const customServers = rawServers
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));

  if (customServers.length > 0) return customServers;

  // Public STUN servers — provide srflx candidates so peers behind NAT can find each other.
  // Same-browser tabs use BroadcastChannel instead (no internet needed).
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
};
