import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/generate-card-video.js';
import { deriveNarrativeVisibility } from '../src/hooks/narrativeReadingModelUtils.js';
import * as audio from '../src/lib/audio.js';

const capabilityRequest = () => new Request('https://example.test/api/generate-card-video?capabilities=true');

test('disabled or incompletely configured video is unavailable without creating a job', async () => {
  for (const env of [{ FEATURE_CARD_VIDEO: 'false' }, { FEATURE_CARD_VIDEO: 'true', METRICS_DB: {} }]) {
    const response = await onRequestGet({ request: capabilityRequest(), env });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { cardVideo: false });
  }
});

test('server video availability requires its flag, tracker and both provider configurations', async () => {
  const env = { FEATURE_CARD_VIDEO: 'true', METRICS_DB: {}, AZURE_OPENAI_ENDPOINT: 'https://example.test', AZURE_OPENAI_API_KEY: 'test-only' };
  const response = await onRequestGet({ request: capabilityRequest(), env });
  assert.deepEqual(await response.json(), { cardVideo: true });
});

test('a paid completed reading does not offer video when the server says unavailable', () => {
  const result = deriveNarrativeVisibility({ personalReading: { raw: 'Finished.' }, narrativePhase: 'complete', effectiveTier: 'pro', cinematicCard: { name: 'The Fool' }, cardVideoAvailable: false });
  assert.equal(result.shouldShowCinematicReveal, false);
});

test('saved retired voice preferences migrate to ElevenLabs and Deepgram remains selectable', () => {
  assert.equal(typeof audio.normalizeTtsProvider, 'function');
  for (const value of [null, 'hume', 'azure', 'azure-sdk', 'elevenlabs']) {
    assert.equal(audio.normalizeTtsProvider(value), 'elevenlabs');
  }
  for (const value of ['deepgram', 'workers-ai-aura-2']) {
    assert.equal(audio.normalizeTtsProvider(value), 'deepgram');
  }
});
