const PROD_API_BASE = 'https://tableu.xyz';
const DEV_API_BASE = 'http://localhost:8787';

export const API_BASE_URL = __DEV__ ? DEV_API_BASE : PROD_API_BASE;

export function buildApiUrl(path: string) {
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}

export async function apiFetch(input: string, init?: RequestInit) {
  const url = buildApiUrl(input);
  return fetch(url, init);
}
