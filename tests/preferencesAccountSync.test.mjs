import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preferencesAccountHarness } from './helpers/preferencesAccountHarness.mjs';

const record = personalization => ({ preferences: { personalization, explicitFields: Object.keys(personalization), onboardingCompletedAt: 1_700_000_000 }, available: true });

test('choosing the same inherited default makes it a durable local override', async () => {
  const first = await preferencesAccountHarness();
  first.render();
  first.reads[0].resolve(record({ readingTone: 'balanced' }));
  let state = await first.settle();
  state.setReadingTone('balanced');
  await first.settle();
  assert.deepEqual(first.origins().inheritedFields, []);

  const reloaded = await preferencesAccountHarness({ values: first.values });
  reloaded.render();
  reloaded.reads[0].resolve(record({ readingTone: 'blunt' }));
  state = await reloaded.settle();
  assert.equal(state.personalization.readingTone, 'balanced');
  assert.deepEqual(state.personalizationExplicitFields, ['readingTone']);
  reloaded.flushPush();
  assert.deepEqual(reloaded.writes[0].payload.personalization, { readingTone: 'balanced' });
});

test('a successful reset acknowledges another identical reset made while its PUT was pending', async () => {
  const harness = await preferencesAccountHarness();
  harness.render();
  harness.reads[0].resolve(record({ displayName: 'Henry' }));
  let state = await harness.settle();
  state.resetPersonalization();
  state = harness.render();
  harness.flushPush();
  state.resetPersonalization();
  harness.render();
  harness.flushPush();
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.origins().resetPending, true);
  harness.writes[0].resolve(record({}));
  await harness.settle();
  assert.equal(harness.origins().resetPending, false);
});

test('an older account GET cannot replace a newer copy after logout and login to the same owner', async () => {
  const harness = await preferencesAccountHarness();
  harness.render();
  harness.setOwner(null);
  harness.setOwner('owner-a');
  assert.equal(harness.reads.length, 2);
  harness.reads[1].resolve(record({ displayName: 'Mira' }));
  await harness.settle();
  harness.reads[0].resolve(record({ displayName: 'Henry' }));
  const state = await harness.settle();
  assert.equal(state.personalization.displayName, 'Mira');
  assert.equal(state.accountPreferencesStatus, 'ready');
});

test('an old owner PUT failure cannot change the new owner account status', async () => {
  const harness = await preferencesAccountHarness();
  harness.render();
  harness.reads[0].resolve(record({ displayName: 'Henry' }));
  let state = await harness.settle();
  state.setDisplayName('Ann');
  harness.render();
  harness.flushPush();
  harness.setOwner('owner-b');
  harness.reads[1].resolve(record({ displayName: 'Mira' }));
  await harness.settle();
  harness.writes[0].reject(Object.assign(new Error('Not available'), { code: 'preferences_unavailable' }));
  state = await harness.settle();
  assert.equal(state.personalization.displayName, 'Mira');
  assert.equal(state.accountPreferencesStatus, 'ready');
  assert.deepEqual(harness.origins('owner-b').inheritedFields, ['displayName']);
});
