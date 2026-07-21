/**
 * Hardening tests for the promptDebug diagnostic channel and its blast radius.
 *
 *  #1 Service authentication was treated as owner authorization. The GPT service
 *     token is a *shared* secret: anyone who can talk to the published GPT can
 *     ask it to send includePromptDebug=true and read back the verbatim system
 *     prompt. Ownership now needs its own credential.
 *  #4 promptDebug had no response-size budget, so a large hand could push the
 *     response past the 100,000-character GPT Actions ceiling.
 *  #5 The buffered SSE path silently dropped promptDebug, because
 *     createReadingStream copies a fixed metadata allowlist.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { webcrypto } from 'node:crypto';

import {
  onRequestPost,
  resolvePromptDebugAccess,
  buildPromptDebugPayload,
  PROMPT_DEBUG_MAX_PROMPT_CHARS
} from '../functions/api/tarot-reading.js';
import { createReadingStream } from '../functions/lib/readingStream.js';
import { resolveServiceUser } from '../functions/lib/serviceAuth.js';
import {
  safeParseReadingRequest,
  CARD_MEANING_MAX_LENGTH,
  CARD_REFLECTION_MAX_LENGTH,
  USER_QUESTION_MAX_LENGTH,
  REFLECTIONS_TEXT_MAX_LENGTH
} from '../shared/contracts/readingSchema.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const SERVICE_TOKEN = 'svc_0123456789abcdef0123456789abcdef01234567';
const OWNER_TOKEN = 'own_fedcba9876543210fedcba9876543210fedcba98';

const SINGLE_CARD_PAYLOAD = {
  spreadInfo: { name: 'One-Card Insight' },
  cardsInfo: [
    {
      position: 'One-Card Insight',
      card: 'The Fool',
      orientation: 'Upright',
      meaning: 'New beginnings'
    }
  ]
};

async function readSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  const events = [];
  for (const block of raw.split('\n\n')) {
    const nameLine = block.match(/^event:\s*(.+)$/m);
    const dataLine = block.match(/^data:\s*(.+)$/m);
    if (nameLine && dataLine) {
      events.push({ event: nameLine[1].trim(), data: JSON.parse(dataLine[1]) });
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// #1 — owner-scoped authorization
// ---------------------------------------------------------------------------

describe('promptDebug requires owner authorization, not just service auth', () => {
  const enabledEnv = { PROMPT_DEBUG_ENABLED: 'true' };

  it('denies an ordinary service caller (the shared GPT token)', () => {
    const result = resolvePromptDebugAccess({
      env: enabledEnv,
      user: { auth_provider: 'service', is_owner: false },
      requested: true
    });
    assert.equal(result.allowed, false, 'a shared service token must not unlock the system prompt');
    assert.equal(result.reason, 'not_owner');
  });

  it('denies a service caller with no ownership marker at all', () => {
    const result = resolvePromptDebugAccess({
      env: enabledEnv,
      user: { auth_provider: 'service' },
      requested: true
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'not_owner');
  });

  it('allows the owner credential', () => {
    const result = resolvePromptDebugAccess({
      env: enabledEnv,
      user: { auth_provider: 'service', is_owner: true },
      requested: true
    });
    assert.equal(result.allowed, true);
    assert.equal(result.reason, 'owner');
  });

  it('still denies non-service callers even if marked owner', () => {
    const result = resolvePromptDebugAccess({
      env: enabledEnv,
      user: { auth_provider: 'api_key', is_owner: true },
      requested: true
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'unauthorized');
  });
});

describe('owner token resolution', () => {
  it('marks the owner token as owner and the service token as not', async () => {
    const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_OWNER_TOKEN: OWNER_TOKEN };

    const owner = await resolveServiceUser(OWNER_TOKEN, env);
    assert.ok(owner, 'the owner token must authenticate');
    assert.equal(owner.auth_provider, 'service');
    assert.equal(owner.is_owner, true);

    const service = await resolveServiceUser(SERVICE_TOKEN, env);
    assert.ok(service, 'the ordinary service token must still authenticate');
    assert.equal(service.is_owner, false);
  });

  it('grants nobody ownership when GPT_OWNER_TOKEN is unset (fail closed)', async () => {
    const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
    const user = await resolveServiceUser(SERVICE_TOKEN, env);
    assert.equal(user.is_owner, false, 'ownership must never be implied by the shared token');
  });

  it('does not authenticate an owner token that is not configured', async () => {
    const env = { GPT_SERVICE_TOKEN: SERVICE_TOKEN };
    assert.equal(await resolveServiceUser(OWNER_TOKEN, env), null);
  });
});

// ---------------------------------------------------------------------------
// #4 — response size budget
// ---------------------------------------------------------------------------

describe('promptDebug size budget', () => {
  it('truncates an oversized system prompt and flags it', () => {
    const huge = 'S'.repeat(PROMPT_DEBUG_MAX_PROMPT_CHARS + 5000);
    const payload = buildPromptDebugPayload({
      capturedPrompts: { system: huge, user: 'short' },
      provider: 'azure-gpt5'
    });

    assert.ok(payload.systemPrompt.length <= PROMPT_DEBUG_MAX_PROMPT_CHARS);
    assert.equal(payload.truncated, true);
    assert.match(payload.systemPrompt, /\[truncated/i);
  });

  it('truncates an oversized user prompt and flags it', () => {
    const huge = 'U'.repeat(PROMPT_DEBUG_MAX_PROMPT_CHARS + 1);
    const payload = buildPromptDebugPayload({
      capturedPrompts: { system: 'short', user: huge },
      provider: 'azure-gpt5'
    });

    assert.ok(payload.userPrompt.length <= PROMPT_DEBUG_MAX_PROMPT_CHARS);
    assert.equal(payload.truncated, true);
  });

  it('keeps normal prompts verbatim and reports no truncation', () => {
    const payload = buildPromptDebugPayload({
      capturedPrompts: { system: 'SYS', user: 'USER' },
      provider: 'azure-gpt5'
    });
    assert.equal(payload.systemPrompt, 'SYS');
    assert.equal(payload.userPrompt, 'USER');
    assert.equal(payload.truncated, false);
  });

  it('keeps the whole payload under the 100k GPT Actions ceiling', () => {
    const huge = 'X'.repeat(500_000);
    const payload = buildPromptDebugPayload({
      capturedPrompts: { system: huge, user: huge },
      provider: 'azure-gpt5'
    });
    assert.ok(
      JSON.stringify(payload).length < 100_000,
      `promptDebug serialized to ${JSON.stringify(payload).length} chars`
    );
  });
});

describe('reading request card bounds', () => {
  it('rejects an absurdly long card meaning', () => {
    const result = safeParseReadingRequest({
      ...SINGLE_CARD_PAYLOAD,
      cardsInfo: [{ ...SINGLE_CARD_PAYLOAD.cardsInfo[0], meaning: 'm'.repeat(50_000) }]
    });
    assert.equal(result.success, false);
    assert.match(result.error, /meaning/i);
  });

  it('rejects more cards than exist in a deck', () => {
    const result = safeParseReadingRequest({
      ...SINGLE_CARD_PAYLOAD,
      cardsInfo: Array.from({ length: 79 }, () => ({ ...SINGLE_CARD_PAYLOAD.cardsInfo[0] }))
    });
    assert.equal(result.success, false);
    assert.match(result.error, /cardsInfo/i);
  });

  it('still accepts a normal ten-card Celtic Cross', () => {
    const result = safeParseReadingRequest({
      ...SINGLE_CARD_PAYLOAD,
      cardsInfo: Array.from({ length: 10 }, () => ({ ...SINGLE_CARD_PAYLOAD.cardsInfo[0] }))
    });
    assert.equal(result.success, true, result.error);
  });
});

describe('worst-case response stays under the GPT Actions ceiling', () => {
  it('serves a maxed-out ten-card reading with promptDebug in under 100k chars', async () => {
    // Every bounded field at its maximum, on the largest spread, with the
    // owner's promptDebug attached. This is the exact shape that produced a
    // 110,106-character response before the bounds existed.
    const positions = [
      'Present', 'Challenge', 'Past', 'Near Future', 'Conscious',
      'Subconscious', 'Self/Advice', 'External', 'Hopes/Fears', 'Outcome'
    ];
    const names = [
      'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
      'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit'
    ];
    const cardsInfo = positions.map((position, i) => ({
      position,
      card: names[i],
      orientation: i % 2 ? 'Reversed' : 'Upright',
      meaning: 'M'.repeat(CARD_MEANING_MAX_LENGTH),
      userReflection: 'R'.repeat(CARD_REFLECTION_MAX_LENGTH)
    }));

    const reading = [
      '### Opening', '',
      ...names.map((n) => `**${n}** speaks clearly.`), '',
      '### Guidance', '', 'Move with care.', '',
      '### Closing', '', 'The path clarifies.'
    ].join('\n');

    const request = new Request('http://localhost/api/tarot-reading', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${OWNER_TOKEN}` },
      body: JSON.stringify({
        spreadInfo: { name: 'Celtic Cross', key: 'celtic' },
        cardsInfo,
        userQuestion: 'Q'.repeat(USER_QUESTION_MAX_LENGTH),
        reflectionsText: 'T'.repeat(REFLECTIONS_TEXT_MAX_LENGTH),
        includePromptDebug: true
      })
    });

    const env = {
      AZURE_OPENAI_API_KEY: 'k',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false',
      PROMPT_DEBUG_ENABLED: 'true',
      GPT_SERVICE_TOKEN: SERVICE_TOKEN,
      GPT_OWNER_TOKEN: OWNER_TOKEN
    };

    const originalFetch = global.fetch;
    global.fetch = async () => new Response(
      JSON.stringify({ output_text: reading, usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
    let text;
    try {
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);
      text = await response.text();
    } finally {
      global.fetch = originalFetch;
    }

    assert.ok(JSON.parse(text).promptDebug, 'the owner should still get promptDebug');
    assert.ok(
      text.length < 100_000,
      `response was ${text.length} chars, over the 100,000 GPT Actions ceiling`
    );
  });
});

// ---------------------------------------------------------------------------
// #5 — buffered SSE must not silently drop promptDebug
// ---------------------------------------------------------------------------

describe('createReadingStream promptDebug passthrough', () => {
  it('carries promptDebug through the buffered SSE meta event', async () => {
    const promptDebug = {
      templateVersion: '1.0.0',
      provider: 'local-composer',
      systemPrompt: 'SYS',
      userPrompt: 'USER',
      truncated: false
    };
    const events = await readSSE(
      createReadingStream({ reading: 'A short reading.', provider: 'claude', promptDebug })
    );

    const meta = events.find((e) => e.event === 'meta');
    assert.ok(meta, 'a meta event should be emitted');
    assert.deepEqual(
      meta.data.promptDebug,
      promptDebug,
      'buffered streaming must expose promptDebug like the live path does'
    );
  });

  it('omits promptDebug when the payload has none', async () => {
    const events = await readSSE(createReadingStream({ reading: 'A short reading.' }));
    const meta = events.find((e) => e.event === 'meta');
    assert.ok(meta);
    assert.equal(meta.data.promptDebug, undefined);
  });
});
