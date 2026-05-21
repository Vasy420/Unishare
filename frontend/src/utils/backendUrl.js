const envBackend = process.env.REACT_APP_BACKEND_URL || '';

export const getBackendUrl = () => {
  if (envBackend) return envBackend;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const backendPort = port === '3001' ? '8001' : String(parseInt(port) + 5000);
  return `${protocol}//${hostname}:${backendPort}`;
};

export const getApiUrl = () => `${getBackendUrl()}/api`;