import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySpacefastFeatureProfile } from '../spacefast/featureProfile.js';
import { createWebVisualCapability } from '../functions/lib/readingVisualWebAdmission.js';
import { getVisualCueReadiness } from '../functions/lib/visualCueProvider.js';

test('Spacefast explicitly disables model annotation dispatch even when deployment variables opt in', () => {
  const source = { DB: {}, READING_JOBS: {}, READING_VISUAL_JOBS: {}, VISUAL_CUE_PROVIDER: 'workers-ai',
    VISUAL_CUE_MODEL: 'offline-fixture', VISUAL_CUE_ALLOWED_TIERS: '["pro"]', AI: { run() { assert.fail('No provider probe'); } } };
  const env = applySpacefastFeatureProfile(source);
  assert.equal(env.DB, source.DB);
  assert.equal(env.READING_JOBS, source.READING_JOBS);
  assert.equal(env.READING_VISUAL_JOBS, undefined);
  assert.equal(getVisualCueReadiness(env).ready, false);
  assert.equal(createWebVisualCapability({ env,
    request: new Request('https://test.invalid/api/tarot-reading/jobs', { method: 'POST', headers: { 'X-Reading-Cue-Display': '1' } }),
    user: { id: 'owner', auth_provider: 'session', subscription_tier: 'pro', subscription_status: 'active' } }), null);
  assert.equal(source.VISUAL_CUE_ALLOWED_TIERS, '["pro"]', 'the original deployment environment is not mutated');
});
