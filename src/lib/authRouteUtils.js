const AUTH_OPTIONAL_PATHS = new Set(['/design']);

export function normalizeRoutePath(pathname = '/') {
  if (typeof pathname !== 'string') return '/';

  const trimmedPath = pathname.trim();
  if (!trimmedPath) return '/';

  const prefixedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  if (prefixedPath === '/') return prefixedPath;

  return prefixedPath.replace(/\/+$/, '') || '/';
}

export function shouldSkipAuthCheckForPath(pathname) {
  return AUTH_OPTIONAL_PATHS.has(normalizeRoutePath(pathname));
}

export function getCurrentPathname() {
  if (typeof window === 'undefined' || !window.location) return '/';
  return normalizeRoutePath(window.location.pathname);
}
