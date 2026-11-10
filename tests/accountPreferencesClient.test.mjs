import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accountPayloadKey,
  buildAccountPreferencesPayload,
  mergeAccountPersonalization
} from '../src/lib/accountPreferences.js';
import * as accountPreferences from '../src/lib/accountPreferences.js';

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

  it('refreshes an inherited account choice without replacing a local choice', () => {
    const result = mergeAccountPersonalization({
      explicitFields: ['displayName', 'readingTone'],
      inheritedFields: ['readingTone'],
      remote: {
        personalization: { displayName: 'Elsewhere', readingTone: 'blunt' },
        explicitFields: ['displayName', 'readingTone']
      }
    });
    assert.deepEqual(result.adopted, { readingTone: 'blunt' });
    assert.deepEqual(result.adoptedFields, ['readingTone']);
  });

  it('clears inherited choices removed on the account while retaining local overrides', () => {
    const result = mergeAccountPersonalization({
      explicitFields: ['displayName', 'readingTone', 'focusAreas'],
      inheritedFields: ['readingTone', 'focusAreas'],
      remote: { personalization: {}, explicitFields: [] }
    });
    assert.deepEqual(result.adopted, { readingTone: 'balanced', focusAreas: [] });
    assert.deepEqual(result.adoptedFields, []);
    assert.deepEqual(result.clearedFields, ['readingTone', 'focusAreas']);
  });

  it('keeps explicit default-valued account choices explicit for narrative requests', () => {
    const result = mergeAccountPersonalization({
      explicitFields: ['readingTone'],
      inheritedFields: ['readingTone'],
      remote: { personalization: { readingTone: 'balanced' }, explicitFields: ['readingTone'] }
    });
    assert.deepEqual(result.adopted, { readingTone: 'balanced' });
    assert.deepEqual(result.adoptedFields, ['readingTone']);
    assert.deepEqual(result.clearedFields, []);
  });

  it('keeps inherited provenance and a pending reset scoped to their account across reloads', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    assert.equal(typeof accountPreferences.saveAccountPreferenceOrigins, 'function');
    accountPreferences.saveAccountPreferenceOrigins('account-a', { inheritedFields: ['readingTone', 'bogus'], resetPending: true }, storage);
    assert.deepEqual(accountPreferences.loadAccountPreferenceOrigins('account-a', storage), { inheritedFields: ['readingTone'], resetPending: true });
    assert.deepEqual(accountPreferences.loadAccountPreferenceOrigins('account-b', storage), { inheritedFields: [], resetPending: false });
  });
});
