import { jsonResponse } from '../../functions/lib/utils.js';

export function isDebugRouteEnabled(env) {
  return env?.ENABLE_DEBUG_ROUTES === 'true';
}

export function hasValidDebugAdminKey(request, env) {
  const requestAdminKey = request?.headers?.get('x-admin-key');
  return Boolean(env?.ADMIN_API_KEY) && requestAdminKey === env.ADMIN_API_KEY;
}

export async function handleDebugSentryRoute({ request, env, captureMessage }) {
  if (!isDebugRouteEnabled(env) || !hasValidDebugAdminKey(request, env)) {
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }

  if (typeof captureMessage === 'function') {
    try {
      await captureMessage('Manual debug-sentry route invoked', 'info');
    } catch (err) {
      console.warn('Failed to emit debug Sentry message:', err?.message || err);
    }
  }

  return jsonResponse({ success: true, message: 'Sentry debug message submitted' });
}
