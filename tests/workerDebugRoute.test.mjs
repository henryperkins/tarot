import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  handleDebugSentryRoute,
  isDebugRouteEnabled,
  hasValidDebugAdminKey
} from '../src/worker/debugSentryRoute.js';

function createRequest(headers = {}) {
  const map = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    headers: {
      get(name) {
        return map.get(String(name).toLowerCase()) || null;
      }
    }
  };
}

test('isDebugRouteEnabled returns true only when explicitly set', () => {
  assert.equal(isDebugRouteEnabled({ ENABLE_DEBUG_ROUTES: 'true' }), true);
  assert.equal(isDebugRouteEnabled({ ENABLE_DEBUG_ROUTES: 'false' }), false);
  assert.equal(isDebugRouteEnabled({}), false);
});

test('hasValidDebugAdminKey requires matching x-admin-key and ADMIN_API_KEY', () => {
  const request = createRequest({ 'x-admin-key': 'secret-1' });
  assert.equal(hasValidDebugAdminKey(request, { ADMIN_API_KEY: 'secret-1' }), true);
  assert.equal(hasValidDebugAdminKey(request, { ADMIN_API_KEY: 'secret-2' }), false);
  assert.equal(hasValidDebugAdminKey(createRequest(), { ADMIN_API_KEY: 'secret-1' }), false);
});

test('handleDebugSentryRoute returns 404 when debug routes are disabled', async () => {
  const response = await handleDebugSentryRoute({
    request: createRequest({ 'x-admin-key': 'secret-1' }),
    env: { ENABLE_DEBUG_ROUTES: 'false', ADMIN_API_KEY: 'secret-1' }
  });
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.error, 'Not found');
});

test('handleDebugSentryRoute returns 404 when admin key is missing or invalid', async () => {
  const missingKeyResponse = await handleDebugSentryRoute({
    request: createRequest(),
    env: { ENABLE_DEBUG_ROUTES: 'true', ADMIN_API_KEY: 'secret-1' }
  });
  const invalidKeyResponse = await handleDebugSentryRoute({
    request: createRequest({ 'x-admin-key': 'secret-2' }),
    env: { ENABLE_DEBUG_ROUTES: 'true', ADMIN_API_KEY: 'secret-1' }
  });

  assert.equal(missingKeyResponse.status, 404);
  assert.equal(invalidKeyResponse.status, 404);
});

test('handleDebugSentryRoute emits capture message and returns success when enabled + authorized', async () => {
  const captureMessage = mock.fn();
  const response = await handleDebugSentryRoute({
    request: createRequest({ 'x-admin-key': 'secret-1' }),
    env: { ENABLE_DEBUG_ROUTES: 'true', ADMIN_API_KEY: 'secret-1' },
    captureMessage
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(captureMessage.mock.calls.length, 1);
  assert.deepEqual(captureMessage.mock.calls[0].arguments, ['Manual debug-sentry route invoked', 'info']);
});
