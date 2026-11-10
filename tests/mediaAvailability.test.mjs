import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/generate-card-video.js';
import { deriveNarrativeVisibility } from '../src/hooks/narrativeReadingModelUtils.js';
import { useMediaAvailability } from '../src/hooks/useMediaAvailability.js';
import * as audio from '../src/lib/audio.js';

const capabilityRequest = () => new Request('https://example.test/api/generate-card-video?capabilities=true');

test('retired video capability discovery cannot offer new jobs', async () => {
  const env = new Proxy({}, { get() { throw new Error('Retired capability discovery must not inspect configuration'); } });
  const response = await onRequestGet({ request: capabilityRequest(), env });
  assert.equal(response.status, 410);
  assert.equal((await response.json()).cardVideo, false);
});

test('frontend media availability stays disabled without querying the retired route', t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('No capability request is allowed'); });
  assert.deepEqual(useMediaAvailability(), { cardVideo: false });
  assert.equal(fetch.mock.callCount(), 0);
});

test('a paid completed reading does not offer video when the server says unavailable', () => {
  const result = deriveNarrativeVisibility({ personalReading: { raw: 'Finished.' }, narrativePhase: 'complete', effectiveTier: 'pro', cinematicCard: { name: 'The Fool' }, cardVideoEnabled: false });
  assert.equal(result.shouldShowCinematicReveal, false);
});

test('missing and retired voice preferences use Deepgram while saved selections remain intact', () => {
  assert.equal(typeof audio.normalizeTtsProvider, 'function');
  for (const value of [undefined, null, '', 'unknown', 'hume', 'azure', 'azure-sdk', 'deepgram', 'workers-ai-aura-2']) {
    assert.equal(audio.normalizeTtsProvider(value), 'deepgram');
  }
  assert.equal(audio.normalizeTtsProvider('elevenlabs'), 'elevenlabs');
});
