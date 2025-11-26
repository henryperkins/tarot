import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach, afterEach, mock } from 'node:test';

import { getActingInstructions } from '../src/data/emotionMapping.js';
import { audioCache } from '../src/lib/audioCache.js';
import { speakWithHume, stopHumeAudio, resetGenerationId } from '../src/lib/audioHume.js';

// Shared fetch mock for both API and client tests
const mockFetch = mock.fn();
global.fetch = mockFetch;

// Simple Audio stub for client-side tests
const OriginalAudio = global.Audio;
class MockAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.onended = null;
    this.onerror = null;
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

function createMockRequest(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `https://example.com${url}`;
  const headers = new Map(Object.entries(options.headers || {}));

  return {
    url: fullUrl,
    method: options.method || 'GET',
    headers: {
      get: (key) => headers.get(key.toLowerCase()) || null,
      set: (key, value) => headers.set(key.toLowerCase(), value),
      has: (key) => headers.has(key.toLowerCase())
    },
    json: async () => options.body || {},
    text: async () => JSON.stringify(options.body || {})
  };
}

function createMockEnv(overrides = {}) {
  return {
    HUME_API_KEY: 'test-hume-key',
    ...overrides
  };
}

describe('Hume TTS API (functions/api/tts-hume.js)', () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    mockFetch.mock.resetCalls();
    console.error = () => {};
    console.warn = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('returns health status based on API key presence', async () => {
    const { onRequestGet } = await import('../functions/api/tts-hume.js');

    const responseWithKey = await onRequestGet({ env: createMockEnv() });
    const dataWithKey = await responseWithKey.json();
    assert.strictEqual(dataWithKey.provider, 'hume-ai');

    const responseNoKey = await onRequestGet({ env: createMockEnv({ HUME_API_KEY: undefined }) });
    const dataNoKey = await responseNoKey.json();
    assert.strictEqual(dataNoKey.provider, 'unavailable');
  });

  it('rejects requests without text', async () => {
    const { onRequestPost } = await import('../functions/api/tts-hume.js');

    const request = createMockRequest('/api/tts-hume', {
      method: 'POST',
      body: {}
    });

    const response = await onRequestPost({ request, env: createMockEnv() });
    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.match(data.error, /text.*required/i);
  });

  it('returns 503 when Hume is not configured', async () => {
    const { onRequestPost } = await import('../functions/api/tts-hume.js');

    const request = createMockRequest('/api/tts-hume', {
      method: 'POST',
      body: { text: 'Hello' }
    });

    const response = await onRequestPost({ request, env: createMockEnv({ HUME_API_KEY: undefined }) });
    const data = await response.json();

    assert.strictEqual(response.status, 503);
    assert.match(data.error, /not configured/i);
  });

  it('builds payload with acting instructions and clamps values', async () => {
    const actingInstructions = getActingInstructions('hopeful-transformative');

    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          generations: [
            {
              audio: 'YmFzZTY0LWF1ZGlv',
              context: { generationId: 'gen-xyz' }
            }
          ]
        })
      })
    );

    const { onRequestPost } = await import('../functions/api/tts-hume.js');

    const request = createMockRequest('/api/tts-hume', {
      method: 'POST',
      body: {
        text: 'Mystical guidance',
        context: 'synthesis',
        voiceName: 'KORA',
        emotion: 'hopeful-transformative',
        speed: 3.5,
        trailingSilence: 10,
        previousGenerationId: 'prev-123'
      }
    });

    const response = await onRequestPost({ request, env: createMockEnv() });
    const data = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.provider, 'hume-ai');
    assert.strictEqual(data.generationId, 'gen-xyz');

    const call = mockFetch.mock.calls[0];
    const options = call.arguments[1];
    const payload = JSON.parse(options.body);
    const utterance = payload.utterances[0];

    assert.strictEqual(payload.context.generationId, 'prev-123');
    assert.strictEqual(utterance.voice.name, 'KORA');
    assert.strictEqual(utterance.description, actingInstructions);
    assert.strictEqual(utterance.speed, 2); // clamped to max 2.0
    assert.strictEqual(utterance.trailing_silence, 5); // clamped to max 5 seconds
  });

  it('propagates rate limit errors from Hume', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: 'Rate limit' })
      })
    );

    const { onRequestPost } = await import('../functions/api/tts-hume.js');

    const request = createMockRequest('/api/tts-hume', {
      method: 'POST',
      body: { text: 'Too many requests' }
    });

    const response = await onRequestPost({ request, env: createMockEnv() });
    const data = await response.json();

    assert.strictEqual(response.status, 429);
    assert.match(data.error, /rate limit/i);
  });
});

describe('Hume TTS Client (audioHume.js)', () => {
  before(() => {
    global.Audio = MockAudio;
  });

  after(() => {
    global.Audio = OriginalAudio;
  });

  beforeEach(() => {
    audioCache.clear();
    resetGenerationId();
    stopHumeAudio();
    mockFetch.mock.resetCalls();
  });

  it('requests /api/tts-hume and returns generation info', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          audio: 'data:audio/mpeg;base64,AAA',
          generationId: 'gen-123',
          voiceUsed: 'ITO'
        })
      })
    );

    const result = await speakWithHume('Tarot reading time', {
      context: 'full-reading',
      voiceName: 'ITO',
      speed: 1.0
    });

    assert.strictEqual(mockFetch.mock.calls[0].arguments[0], '/api/tts-hume');
    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.strictEqual(body.text, 'Tarot reading time');
    assert.strictEqual(body.context, 'full-reading');
    assert.strictEqual(result.generationId, 'gen-123');
    assert.strictEqual(result.voiceUsed, 'ITO');
    await result.play();
  });

  it('uses cached audio for short repeated phrases', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          audio: 'data:audio/mpeg;base64,AAA',
          generationId: 'cache-gen'
        })
      })
    );

    await speakWithHume('Hi', { emotion: 'hopeful-transformative' });
    mockFetch.mock.resetCalls();

    const result = await speakWithHume('Hi', { emotion: 'hopeful-transformative' });

    assert.strictEqual(mockFetch.mock.calls.length, 0);
    assert.strictEqual(result.cached, true);
    await result.play();
  });

  it('sends previousGenerationId when continuing a voice', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          audio: 'data:audio/mpeg;base64,AAA',
          generationId: 'first-gen',
          voiceUsed: 'ITO'
        })
      })
    );

    await speakWithHume('First segment');

    mockFetch.mock.resetCalls();
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          audio: 'data:audio/mpeg;base64,BBB',
          generationId: 'second-gen',
          voiceUsed: 'ITO'
        })
      })
    );

    await speakWithHume('Second segment', { continuePrevious: true });

    const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
    assert.strictEqual(body.previousGenerationId, 'first-gen');
  });

  it('throws when the API responds with an error', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: async () => 'boom'
      })
    );

    await assert.rejects(() => speakWithHume('Failing request'), /TTS request failed/);
  });

  it('stops playback and resets the current audio', async () => {
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          audio: 'data:audio/mpeg;base64,AAA',
          generationId: 'gen-stop'
        })
      })
    );

    const result = await speakWithHume('Stop the audio');
    await result.play();

    stopHumeAudio();

    assert.strictEqual(result.audio.paused, true);
    assert.strictEqual(result.audio.currentTime, 0);
  });
});
