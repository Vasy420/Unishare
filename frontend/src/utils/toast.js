// Global toast dispatcher. App.js installs a listener and renders the toast UI.
// Components anywhere can call toast(message, kind?) without prop drilling.

export function toast(message, kind = 'info') {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('app-toast', { detail: { message: String(message ?? ''), kind } })
    );
  } catch (e) {
    console.warn('toast dispatch failed', e);
  }
}

export const toastSuccess = (m) => toast(m, 'success');
export const toastError = (m) => toast(m, 'error');
export const toastInfo = (m) => toast(m, 'info');
