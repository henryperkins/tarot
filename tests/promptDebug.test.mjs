import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  onRequestPost,
  resolvePromptDebugAccess,
  buildPromptDebugPayload
} from '../functions/api/tarot-reading.js';
import { onRequestPost as drawTarotReading } from '../functions/api/tarot-reading-draw.js';
import { safeParseReadingRequest } from '../shared/contracts/readingSchema.js';
import { READING_PROMPT_VERSION } from '../functions/lib/promptVersioning.js';
import { drawSpread } from '../src/lib/deck.js';
import { hashString } from '../shared/utils.js';

// A 24+ char token so isServiceAuthConfigured accepts it (MIN_SERVICE_TOKEN_LENGTH).
const SERVICE_TOKEN = 'svc-tok-0123456789abcdef012345';
// promptDebug is owner-gated, so the end-to-end cases authenticate with the
// separate owner token rather than the shared service token.
const OWNER_TOKEN = 'own-tok-0123456789abcdef012345';

const SINGLE_CARD_PAYLOAD = {
  spreadInfo: { name: 'One-Card Insight' },
  cardsInfo: [
    {
      position: 'One-Card Insight',
      card: 'The Fool',
      orientation: 'Upright',
      meaning: 'New beginnings'
    }
  ],
  reflectionsText: ''
};

// English narrative mentioning the drawn card so the quality gate accepts it.
const MOCK_READING = [
  '### Opening',
  '',
  '**The Fool** marks a fresh threshold for you.',
  '',
  '### Guidance',
  '',
  'Move with curiosity and one clear step at a time.',
  '',
  '- Trust your first impulse.',
  '- Choose one small action today.',
  '',
  '### Closing',
  '',
  'Your path clarifies as you move forward.'
].join('\n');

function makeRequest(payload, { authorization } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (authorization) headers.authorization = authorization;
  return new Request('http://localhost/api/tarot-reading', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
}

async function withMockedFetch(mockFetch, fn) {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

function mockAzureFetch() {
  return async () => new Response(
    JSON.stringify({
      output_text: MOCK_READING,
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

// Build a mock narrative that names the given cards, so a backend-drawn hand
// clears the card-coverage quality gate and the azure-gpt5 backend is accepted.
function mockAzureFetchCovering(cardNames) {
  const body = [
    '### Opening',
    '',
    ...cardNames.map((name) => `**${name}** speaks to a fresh threshold for you.`),
    '',
    '### Guidance',
    '',
    'Move with curiosity and one clear step at a time.',
    '',
    '### Closing',
    '',
    'Your path clarifies as you move forward.'
  ].join('\n');
  return async () => new Response(
    JSON.stringify({
      output_text: body,
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

const AZURE_ENV = {
  AZURE_OPENAI_API_KEY: 'test-key',
  AZURE_OPENAI_ENDPOINT: 'https://example.com',
  AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
  EVAL_ENABLED: 'false',
  EVAL_GATE_ENABLED: 'false',
  GRAPHRAG_ENABLED: 'false'
};

// ---------------------------------------------------------------------------
// Unit: resolvePromptDebugAccess gate
// ---------------------------------------------------------------------------

describe('resolvePromptDebugAccess', () => {
  // The owner credential, not the shared service token — see
  // tests/promptDebugHardening.test.mjs for why the two differ.
  const serviceUser = { auth_provider: 'service', is_owner: true };
  const enabledEnv = { PROMPT_DEBUG_ENABLED: 'true' };

  it('denies when the request did not opt in', () => {
    const result = resolvePromptDebugAccess({ env: enabledEnv, user: serviceUser, requested: false });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'not_requested');
  });

  it('denies when the env flag is off (even for the service account)', () => {
    const result = resolvePromptDebugAccess({ env: {}, user: serviceUser, requested: true });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'disabled');
  });

  it('denies anonymous callers when enabled + requested', () => {
    const result = resolvePromptDebugAccess({ env: enabledEnv, user: null, requested: true });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'unauthorized');
  });

  it('denies API-key and session callers when enabled + requested', () => {
    for (const provider of ['api_key', 'session']) {
      const result = resolvePromptDebugAccess({
        env: enabledEnv,
        user: { auth_provider: provider },
        requested: true
      });
      assert.equal(result.allowed, false, `${provider} should be denied`);
      assert.equal(result.reason, 'unauthorized');
    }
  });

  it('allows only the owner with flag on and opt-in', () => {
    const result = resolvePromptDebugAccess({ env: enabledEnv, user: serviceUser, requested: true });
    assert.equal(result.allowed, true);
    assert.equal(result.reason, 'owner');
  });

  it('accepts truthy string forms of the flag', () => {
    for (const value of ['true', '1', 'yes', 'on']) {
      const result = resolvePromptDebugAccess({
        env: { PROMPT_DEBUG_ENABLED: value },
        user: serviceUser,
        requested: true
      });
      assert.equal(result.allowed, true, `flag="${value}" should enable`);
    }
  });
});

// ---------------------------------------------------------------------------
// Unit: buildPromptDebugPayload
// ---------------------------------------------------------------------------

describe('buildPromptDebugPayload', () => {
  it('returns null when there are no captured prompts (e.g. local composer)', () => {
    assert.equal(buildPromptDebugPayload({ capturedPrompts: null }), null);
    assert.equal(buildPromptDebugPayload({ capturedPrompts: { system: '', user: '' } }), null);
    assert.equal(buildPromptDebugPayload({}), null);
  });

  it('returns raw prompts verbatim with provider and version', () => {
    const payload = buildPromptDebugPayload({
      capturedPrompts: { system: 'SYS-PROMPT', user: 'USER-PROMPT' },
      provider: 'azure-gpt5'
    });
    assert.equal(payload.systemPrompt, 'SYS-PROMPT');
    assert.equal(payload.userPrompt, 'USER-PROMPT');
    assert.equal(payload.provider, 'azure-gpt5');
    assert.equal(payload.templateVersion, READING_PROMPT_VERSION);
  });

  it('prefers promptMeta.readingPromptVersion when present', () => {
    const payload = buildPromptDebugPayload({
      capturedPrompts: { system: 'S', user: 'U' },
      promptMeta: { readingPromptVersion: '9.9.9' }
    });
    assert.equal(payload.templateVersion, '9.9.9');
  });
});

// ---------------------------------------------------------------------------
// Schema: includePromptDebug round-trips through the request contract
// ---------------------------------------------------------------------------

describe('readingRequestSchema includePromptDebug', () => {
  it('accepts includePromptDebug boolean', () => {
    const result = safeParseReadingRequest({ ...SINGLE_CARD_PAYLOAD, includePromptDebug: true });
    assert.equal(result.success, true, result.error);
    assert.equal(result.data.includePromptDebug, true);
  });

  it('omits the field when not provided', () => {
    const result = safeParseReadingRequest({ ...SINGLE_CARD_PAYLOAD });
    assert.equal(result.success, true, result.error);
    assert.equal(result.data.includePromptDebug, undefined);
  });

  it('rejects a non-boolean includePromptDebug', () => {
    const result = safeParseReadingRequest({ ...SINGLE_CARD_PAYLOAD, includePromptDebug: 'yes' });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// Integration: end-to-end promptDebug behavior through onRequestPost
// ---------------------------------------------------------------------------

describe('tarot-reading promptDebug response', () => {
  it('returns the verbatim assembled prompt for the owner when enabled + opted in', async () => {
    const request = makeRequest(
      {
        ...SINGLE_CARD_PAYLOAD,
        userQuestion: 'How can I support my friend Zephyrina?',
        includePromptDebug: true
      },
      { authorization: `Bearer ${OWNER_TOKEN}` }
    );
    const env = {
      ...AZURE_ENV,
      PROMPT_DEBUG_ENABLED: 'true',
      GPT_SERVICE_TOKEN: SERVICE_TOKEN,
      GPT_OWNER_TOKEN: OWNER_TOKEN
    };

    await withMockedFetch(mockAzureFetch(), async () => {
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);

      const payload = await response.json();
      assert.equal(payload.provider, 'azure-gpt5');
      assert.ok(payload.promptDebug, 'promptDebug should be present');
      assert.equal(payload.promptDebug.provider, 'azure-gpt5');
      assert.equal(payload.promptDebug.templateVersion, READING_PROMPT_VERSION);
      assert.ok(
        typeof payload.promptDebug.systemPrompt === 'string' && payload.promptDebug.systemPrompt.length > 0,
        'systemPrompt should be a non-empty string'
      );
      // The user prompt is the real assembled prompt: it references the drawn
      // card and echoes the raw (unredacted) question.
      assert.match(payload.promptDebug.userPrompt, /Fool/);
      assert.match(payload.promptDebug.userPrompt, /Zephyrina/);
    });
  });

  it('omits promptDebug when the request did not opt in', async () => {
    const request = makeRequest(
      { ...SINGLE_CARD_PAYLOAD, userQuestion: 'How can I move forward?' },
      { authorization: `Bearer ${SERVICE_TOKEN}` }
    );
    const env = {
      ...AZURE_ENV,
      PROMPT_DEBUG_ENABLED: 'true',
      GPT_SERVICE_TOKEN: SERVICE_TOKEN
    };

    await withMockedFetch(mockAzureFetch(), async () => {
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.provider, 'azure-gpt5');
      assert.equal(payload.promptDebug, undefined);
    });
  });

  it('omits promptDebug when PROMPT_DEBUG_ENABLED is off', async () => {
    const request = makeRequest(
      { ...SINGLE_CARD_PAYLOAD, userQuestion: 'How can I move forward?', includePromptDebug: true },
      { authorization: `Bearer ${SERVICE_TOKEN}` }
    );
    const env = {
      ...AZURE_ENV,
      GPT_SERVICE_TOKEN: SERVICE_TOKEN
      // PROMPT_DEBUG_ENABLED intentionally unset
    };

    await withMockedFetch(mockAzureFetch(), async () => {
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.promptDebug, undefined);
    });
  });

  it('omits promptDebug for the shared service token even when enabled + opted in', async () => {
    // The service token ships inside a Custom GPT that may be published, so any
    // of that GPT's users could ask it to set includePromptDebug. Only the
    // separate owner token unlocks the prompt.
    const request = makeRequest(
      { ...SINGLE_CARD_PAYLOAD, userQuestion: 'How can I move forward?', includePromptDebug: true },
      { authorization: `Bearer ${SERVICE_TOKEN}` }
    );
    const env = {
      ...AZURE_ENV,
      PROMPT_DEBUG_ENABLED: 'true',
      GPT_SERVICE_TOKEN: SERVICE_TOKEN,
      GPT_OWNER_TOKEN: OWNER_TOKEN
    };

    await withMockedFetch(mockAzureFetch(), async () => {
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.promptDebug, undefined, 'the shared token must not expose the system prompt');
    });
  });

  it('omits promptDebug for non-service (anonymous) callers even when enabled + opted in', async () => {
    const request = makeRequest({
      ...SINGLE_CARD_PAYLOAD,
      userQuestion: 'How can I move forward?',
      includePromptDebug: true
    });
    const env = {
      ...AZURE_ENV,
      PROMPT_DEBUG_ENABLED: 'true'
      // No GPT_SERVICE_TOKEN and no auth header -> anonymous caller.
    };

    await withMockedFetch(mockAzureFetch(), async () => {
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.promptDebug, undefined);
    });
  });

  it('omits promptDebug for the local composer (no LLM prompt) even when authorized', async () => {
    const request = makeRequest(
      { ...SINGLE_CARD_PAYLOAD, userQuestion: 'How can I move forward?', includePromptDebug: true },
      { authorization: `Bearer ${SERVICE_TOKEN}` }
    );
    // No AI backend configured -> local-composer serves the reading.
    const env = {
      PROMPT_DEBUG_ENABLED: 'true',
      GPT_SERVICE_TOKEN: SERVICE_TOKEN
    };

    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.provider, 'local-composer');
    assert.equal(payload.promptDebug, undefined);
  });
});

describe('drawTarotReading promptDebug passthrough', () => {
  it('forwards includePromptDebug and preserves promptDebug for the owner', async () => {
    // The draw handler forwards the whole payload (incl. includePromptDebug)
    // and the original auth header to the /api/tarot-reading pipeline, then
    // spreads the inner response back out — so promptDebug must survive.
    const seedStr = 'promptdebug-draw-seed';
    const seed = (hashString(seedStr) >>> 0) || 0x9e3779b9; // mirror coerceSeed
    const drawn = drawSpread({ spreadKey: 'single', useSeed: true, seed, includeMinors: true });
    const cardNames = drawn.map((c) => c.name);

    const request = makeRequest(
      {
        spreadInfo: { name: 'One-Card Insight', key: 'single' },
        userQuestion: 'How can I support my friend Zephyrina?',
        allowReversals: false,
        seed: seedStr,
        includePromptDebug: true
      },
      { authorization: `Bearer ${OWNER_TOKEN}` }
    );
    const env = {
      ...AZURE_ENV,
      PROMPT_DEBUG_ENABLED: 'true',
      GPT_SERVICE_TOKEN: SERVICE_TOKEN,
      GPT_OWNER_TOKEN: OWNER_TOKEN
    };

    await withMockedFetch(mockAzureFetchCovering(cardNames), async () => {
      const response = await drawTarotReading({ request, env });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.ok(Array.isArray(payload.cardsInfo) && payload.cardsInfo.length === 1);
      assert.equal(payload.provider, 'azure-gpt5');
      assert.ok(payload.promptDebug, 'draw response should carry promptDebug');
      assert.equal(payload.promptDebug.provider, 'azure-gpt5');
      assert.match(payload.promptDebug.userPrompt, /Zephyrina/);
    });
  });

  it('omits promptDebug on the draw path for anonymous callers', async () => {
    const seedStr = 'promptdebug-draw-seed-anon';
    const seed = (hashString(seedStr) >>> 0) || 0x9e3779b9;
    const drawn = drawSpread({ spreadKey: 'single', useSeed: true, seed, includeMinors: true });
    const cardNames = drawn.map((c) => c.name);

    const request = makeRequest({
      spreadInfo: { name: 'One-Card Insight', key: 'single' },
      userQuestion: 'How can I move forward?',
      allowReversals: false,
      seed: seedStr,
      includePromptDebug: true
    });
    const env = { ...AZURE_ENV, PROMPT_DEBUG_ENABLED: 'true' }; // no service token

    await withMockedFetch(mockAzureFetchCovering(cardNames), async () => {
      const response = await drawTarotReading({ request, env });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.provider, 'azure-gpt5');
      assert.equal(payload.promptDebug, undefined);
    });
  });
});
