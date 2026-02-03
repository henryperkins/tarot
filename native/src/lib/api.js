const DEFAULT_API_BASE = 'https://tarot.lakefrontdev.com';

export const getApiBaseUrl = () => {
  const envBase = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_BASE : '';
  const trimmed = typeof envBase === 'string' ? envBase.trim() : '';
  if (!trimmed) return DEFAULT_API_BASE;
  return trimmed.replace(/\/$/, '');
};

export const buildApiUrl = (path = '/') => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
};
