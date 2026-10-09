import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeDeliveredReading } from '../functions/lib/visualCueObserver.js';

const visualConfig = { VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/zai-org/glm-5.3-flash',
  AI: { run: async () => { throw new Error('Observer must not perform inference directly'); } } };

for (const [name, overrides] of [
  ['missing provider', { VISUAL_CUE_PROVIDER: undefined }],
  ['blank provider', { VISUAL_CUE_PROVIDER: '  ' }],
  ['missing model', { VISUAL_CUE_MODEL: undefined }],
  ['blank model', { VISUAL_CUE_MODEL: '  ' }],
  ['unsupported provider', { VISUAL_CUE_PROVIDER: 'narrative' }],
  ['missing AI binding', { AI: undefined }],
  ['non-callable AI binding', { AI: { run: true } }],
  ['invalid GLM effort', { VISUAL_CUE_REASONING_EFFORT: 'medium' }],
  ['missing DO binding', { READING_VISUAL_JOBS: undefined }]
]) {
  test(`unavailable visual observation does no work: ${name}`, async () => {
    let lookups = 0;
    let fetches = 0;
    let inferenceCalls = 0;
    const binding = createBinding();
    const env = { ...visualConfig, AI: { run: () => { inferenceCalls++; } },
      READING_VISUAL_JOBS: { idFromName: id => { lookups++; return id; }, get: () => ({ fetch: async () => {
        fetches++; return Response.json({ ok: true });
      } }) }, ...overrides };
    const result = await observeDeliveredReading({ env, binding, raw: 'Accepted prose.', deliveredEventId: 1,
      init: { binding, visualToken: 'controlled', validationContext: { cards: [] } } });
    assert.deepEqual(result, { ok: false, ignored: true });
    assert.equal(lookups, 0);
    assert.equal(fetches, 0, 'Neither initialization nor observation is dispatched');
    assert.equal(inferenceCalls, 0);
  });
}

function createBinding(readingResultId = 'res-1', sourceRevision = 0) {
  return {
    readingResultId,
    sourceRevision,
    spreadHash: '0000000000000000000000000000000000000000000000000000000000000001',
    contextHash: '0000000000000000000000000000000000000000000000000000000000000002',
    artworkEdition: 'rws-immanuelle-vector',
    catalogVersion: 'v1'
  };
}

test('observeDeliveredReading dispatches snapshot to visual job', async () => {
  const binding = createBinding();
  const observations = [];

  const fakeStub = {
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      observations.push(body);
      return new Response(JSON.stringify({ ok: true, status: 'accepted' }), { status: 202 });
    }
  };

  const env = {
    ...visualConfig,
    READING_VISUAL_JOBS: {
      get: () => fakeStub,
      idFromName: () => 'stub-id'
    }
  };

  const result = await observeDeliveredReading({
    env,
    binding,
    raw: 'First sentence of tarot reading.',
    deliveredEventId: 1,
    complete: false,
    availableAt: 1000
  });

  assert.equal(result.ok, true);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].raw, 'First sentence of tarot reading.');
  assert.equal(observations[0].deliveredEventId, 1);
  assert.equal(observations[0].complete, false);
});

test('burst-SSE and final-only JSON submit complete snapshot and coalesce', async () => {
  const binding = createBinding();
  const observations = [];

  const fakeStub = {
    fetch: async (url, options) => {
      observations.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true }));
    }
  };

  const env = {
    ...visualConfig,
    READING_VISUAL_JOBS: {
      get: () => fakeStub,
      idFromName: () => 'stub-id'
    }
  };

  // Burst: multiple deltas in quick succession
  await observeDeliveredReading({ env, binding, raw: 'Word 1', deliveredEventId: 1, complete: false, availableAt: 100 });
  await observeDeliveredReading({ env, binding, raw: 'Word 1 Word 2', deliveredEventId: 2, complete: false, availableAt: 110 });
  await observeDeliveredReading({ env, binding, raw: 'Word 1 Word 2 Word 3.', deliveredEventId: 3, complete: true, availableAt: 120 });

  assert.equal(observations.length, 3);
  assert.equal(observations[2].raw, 'Word 1 Word 2 Word 3.');
  assert.equal(observations[2].complete, true);
});

test('non-prefix final replacement invalidates previous binding', async () => {
  const bindingV0 = createBinding('res-1', 0);
  const bindingV1 = createBinding('res-1', 1);
  const observations = [];

  const fakeStub = {
    fetch: async (url, options) => {
      observations.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true }));
    }
  };

  const env = {
    ...visualConfig,
    READING_VISUAL_JOBS: {
      get: () => fakeStub,
      idFromName: () => 'stub-id'
    }
  };

  await observeDeliveredReading({ env, binding: bindingV0, raw: 'Partial text that gets replaced.', deliveredEventId: 1, complete: false, availableAt: 100 });
  // Final replacement with safe-fallback or rewritten prose
  await observeDeliveredReading({ env, binding: bindingV1, raw: 'Safe fallback text.', deliveredEventId: 2, complete: true, availableAt: 200 });

  assert.equal(observations.length, 2);
  assert.equal(observations[0].binding.sourceRevision, 0);
  assert.equal(observations[1].binding.sourceRevision, 1);
  assert.equal(observations[1].raw, 'Safe fallback text.');
});

test('observeDeliveredReading is a safe no-op if READING_VISUAL_JOBS is absent', async () => {
  const binding = createBinding();
  const result = await observeDeliveredReading({
    env: {},
    binding,
    raw: 'Some text',
    deliveredEventId: 1
  });

  assert.equal(result.ok, false);
  assert.equal(result.ignored, true);
});

test('observation initializes idempotently before delivery without exposing source in transport errors', async () => {
  const binding = createBinding();
  const paths = [];
  const env = { ...visualConfig, READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async url => {
    paths.push(new URL(url).pathname);
    return Response.json({ ok: true });
  } }) } };
  const result = await observeDeliveredReading({ env, binding,
    init: { binding, visualToken: 'controlled', validationContext: { cards: [] } }, raw: 'Private prose', deliveredEventId: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(paths, ['/init', '/observe']);
  env.READING_VISUAL_JOBS.get = () => ({ fetch() { throw new Error('Private prose in an upstream error'); } });
  const failed = await observeDeliveredReading({ env, binding, raw: 'Private prose', deliveredEventId: 2 });
  assert.equal(failed.ok, false);
  assert.doesNotMatch(failed.error, /Private prose/);
});
