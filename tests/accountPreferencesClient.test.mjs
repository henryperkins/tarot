import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accountPayloadKey,
  buildAccountPreferencesPayload,
  mergeAccountPersonalization
} from '../src/lib/accountPreferences.js';

describe('account preferences client', () => {
  it('sends only the fields this device chose, and whether onboarding is done', () => {
    const payload = buildAccountPreferencesPayload({
      personalization: { displayName: 'Henry', readingTone: 'balanced', showRitualSteps: false, tarotExperience: 'experienced' },
      explicitFields: ['displayName', 'tarotExperience', 'showRitualSteps', 'displayName', 'spiritualFrame'],
      onboardingComplete: true
    });
    // showRitualSteps is a device preference; spiritualFrame was never set here.
    assert.deepEqual(payload, {
      personalization: { displayName: 'Henry', tarotExperience: 'experienced' },
      explicitFields: ['displayName', 'tarotExperience'],
      onboardingCompleted: true
    });
  });

  it('fills only what this device has not chosen', () => {
    const { adopted, adoptedFields } = mergeAccountPersonalization({
      explicitFields: ['readingTone'],
      remote: {
        personalization: { displayName: 'Henry', readingTone: 'blunt', tarotExperience: 'experienced', bogus: 'x' },
        explicitFields: ['displayName', 'readingTone', 'tarotExperience', 'bogus', 'preferredSpreadDepth']
      }
    });
    assert.deepEqual(adopted, { displayName: 'Henry', tarotExperience: 'experienced' });
    assert.deepEqual(adoptedFields, ['displayName', 'tarotExperience']);
    assert.deepEqual(mergeAccountPersonalization({ explicitFields: [], remote: null }).adoptedFields, []);
  });

  it('compares payloads regardless of field order', () => {
    const a = { personalization: { readingTone: 'gentle', displayName: 'A' }, explicitFields: ['readingTone', 'displayName'], onboardingCompleted: true };
    const b = { personalization: { displayName: 'A', readingTone: 'gentle' }, explicitFields: ['displayName', 'readingTone'], onboardingCompleted: true };
    assert.equal(accountPayloadKey(a), accountPayloadKey(b));
    assert.notEqual(accountPayloadKey(a), accountPayloadKey({ ...b, onboardingCompleted: false }));
  });
});
