import { createContext } from 'react';

export const LocalAdminAccessContext = createContext(null);
export const localAdminEndpoint = '/api/admin/local-access';
let setupToken = '';

// Read the launch proof before router initialization or error reporting can
// observe the URL. Keep it in memory only and preserve unrelated fragments.
export function captureLocalAdminLaunch() {
  if (typeof window === 'undefined' || window.location.pathname !== '/admin/ai-configuration') return;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has('setup')) return;
  setupToken = fragment.get('setup') || '';
  fragment.delete('setup');
  const url = new URL(window.location.href);
  url.hash = fragment.toString();
  window.history.replaceState(window.history.state, '', url);
}

export const getLocalAdminLaunch = () => setupToken;
export const clearLocalAdminLaunch = () => { setupToken = ''; };

export async function localAdminAction(body, token, signal) {
  const response = await fetch(localAdminEndpoint, {
    method: 'POST', cache: 'no-store', redirect: 'error', signal,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not complete local sign-in.');
  return result;
}
