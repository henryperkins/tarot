import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { onRequestGet as onStreamGet } from '../functions/api/tarot-reading-job-stream.js';
import { onRequestGet as onStatusGet } from '../functions/api/tarot-reading-job-status.js';
import { onRequestPost as onCancelPost } from '../functions/api/tarot-reading-job-cancel.js';

function createEnvironment() {
  let fetchArgs = null;

  const stub = {
    async fetch(url, init = {}) {
      fetchArgs = { url, init };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  };

  return {
    env: {
      READING_JOBS: {
        idFromName(jobId) {
          return `durable-${jobId}`;
        },
        get() {
          return stub;
        }
      }
    },
    getFetchArgs() {
      return fetchArgs;
    }
  };
}

describe('tarot reading job token forwarding', () => {
  test('status endpoint ignores token query param', async () => {
    const { env, getFetchArgs } = createEnvironment();
    const request = new Request('https://example.com/api/tarot-reading/jobs/job-1/status?token=query-token');

    await onStatusGet({ request, env, params: { id: 'job-1' } });

    const forwarded = getFetchArgs();
    assert.equal(forwarded.url, 'https://reading-jobs/status');
    const headers = new Headers(forwarded.init.headers);
    assert.equal(headers.get('X-Job-Token'), null);
  });

  test('status endpoint forwards X-Job-Token header', async () => {
    const { env, getFetchArgs } = createEnvironment();
    const request = new Request('https://example.com/api/tarot-reading/jobs/job-1/status?token=query-token', {
      headers: { 'X-Job-Token': 'header-token' }
    });

    await onStatusGet({ request, env, params: { id: 'job-1' } });

    const forwarded = getFetchArgs();
    const headers = new Headers(forwarded.init.headers);
    assert.equal(headers.get('X-Job-Token'), 'header-token');
  });

  test('cancel endpoint ignores token query param', async () => {
    const { env, getFetchArgs } = createEnvironment();
    const request = new Request('https://example.com/api/tarot-reading/jobs/job-1/cancel?token=query-token', {
      method: 'POST'
    });

    await onCancelPost({ request, env, params: { id: 'job-1' } });

    const forwarded = getFetchArgs();
    assert.equal(forwarded.url, 'https://reading-jobs/cancel');
    assert.equal(forwarded.init.method, 'POST');
    const headers = new Headers(forwarded.init.headers);
    assert.equal(headers.get('X-Job-Token'), null);
  });

  test('stream endpoint still allows query token fallback', async () => {
    const { env, getFetchArgs } = createEnvironment();
    const request = new Request('https://example.com/api/tarot-reading/jobs/job-1/stream?token=query-token&cursor=7');

    await onStreamGet({ request, env, params: { id: 'job-1' } });

    const forwarded = getFetchArgs();
    assert.equal(forwarded.url, 'https://reading-jobs/stream?cursor=7');
    const headers = new Headers(forwarded.init.headers);
    assert.equal(headers.get('X-Job-Token'), 'query-token');
  });
});
