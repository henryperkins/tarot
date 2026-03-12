import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/tarot-reading.js';
import { LOCAL_COMPOSER_UNSUPPORTED_LANGUAGE_CODE } from '../functions/lib/narrativeBackends.js';

function makeRequest(payload) {
  return new Request('http://localhost/api/tarot-reading', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

const BASE_PAYLOAD = {
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

describe('local-composer language fallback', () => {
  it('continues to serve English questions when only the local composer is available', async () => {
    const request = makeRequest({
      ...BASE_PAYLOAD,
      userQuestion: 'How should I move forward?'
    });

    const response = await onRequestPost({ request, env: {} });
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.ok(typeof payload.reading === 'string' && payload.reading.startsWith('### Opening'));
  });

  it('keeps ambiguous English phrasing on the local-composer path', async () => {
    const request = makeRequest({
      ...BASE_PAYLOAD,
      userQuestion: 'Can you comment on this relation?'
    });

    const response = await onRequestPost({ request, env: {} });
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.provider, 'local-composer');
    assert.ok(typeof payload.reading === 'string' && payload.reading.startsWith('### Opening'));
  });

  it('continues to try AI backends for non-English prompts before failing closed', async () => {
    const request = makeRequest({
      ...BASE_PAYLOAD,
      userQuestion: '¿Cómo puedo avanzar en esta relación?'
    });
    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    await withMockedFetch(
      async () => new Response(
        JSON.stringify({
          output_text: [
            '### Apertura',
            '',
            '**The Fool** marca un umbral nuevo para ti.',
            '',
            '### Guidance',
            '',
            'Avanza con curiosidad y con un paso claro a la vez.',
            '',
            '- Confia en tu impulso inicial.',
            '- Elige una accion pequena hoy.',
            '',
            '### Closing',
            '',
            'Tu camino se aclara mientras avanzas.'
          ].join('\n'),
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      ),
      async () => {
        const response = await onRequestPost({ request, env });
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.provider, 'azure-gpt5');
        assert.match(payload.reading, /### Apertura/);
      }
    );
  });

  it('returns 503 for likely non-English questions instead of falling back to English locally', async () => {
    const request = makeRequest({
      ...BASE_PAYLOAD,
      userQuestion: '¿Cómo puedo avanzar en esta relación?'
    });

    const response = await onRequestPost({ request, env: {} });
    assert.equal(response.status, 503);

    const payload = await response.json();
    assert.equal(payload.code, LOCAL_COMPOSER_UNSUPPORTED_LANGUAGE_CODE);
    assert.equal(payload.detectedLanguage, 'es');
    assert.match(payload.error, /local fallback only supports English/i);
  });

  it('returns 503 for Cyrillic questions when only the local composer is available', async () => {
    const request = makeRequest({
      ...BASE_PAYLOAD,
      userQuestion: 'Как мне двигаться дальше?'
    });

    const response = await onRequestPost({ request, env: {} });
    assert.equal(response.status, 503);

    const payload = await response.json();
    assert.equal(payload.code, LOCAL_COMPOSER_UNSUPPORTED_LANGUAGE_CODE);
    assert.equal(payload.detectedLanguage, 'cyrillic');
    assert.match(payload.error, /local fallback only supports English/i);
  });

  it('returns 503 for Japanese questions when only the local composer is available', async () => {
    const request = makeRequest({
      ...BASE_PAYLOAD,
      userQuestion: 'どう進めばいいですか？'
    });

    const response = await onRequestPost({ request, env: {} });
    assert.equal(response.status, 503);

    const payload = await response.json();
    assert.equal(payload.code, LOCAL_COMPOSER_UNSUPPORTED_LANGUAGE_CODE);
    assert.equal(payload.detectedLanguage, 'ja');
    assert.match(payload.error, /local fallback only supports English/i);
  });
});
