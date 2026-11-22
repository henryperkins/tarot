import assert from 'node:assert/strict';
import test from 'node:test';
import { changePrimary, hasRetiredModel, policyKey, reapplyPolicyEdits } from '../src/lib/adminAiConfiguration.js';

const openai = { providerId: 'openai-native', modelId: 'gpt-6.1-sol', reasoningEffort: 'high' };
const claude = { providerId: 'claude-api', modelId: 'claude-opus-5-5', reasoningEffort: 'medium' };
const modal = { providerId: 'modal-qwen', modelId: 'qwen', reasoningEffort: 'high' };
const local = { providerId: 'local-composer' };
const original = { primary: openai, fallbacks: [claude, modal, local] };

test('sample freshness compares normalized values and ordered adapter settings', () => {
  const differentOrder = { ...original, fallbacks: [modal, claude, local] };
  assert.notEqual(policyKey(differentOrder), policyKey(original));
  assert.equal(policyKey(original), policyKey({
    primary: { reasoningEffort: 'high', modelId: openai.modelId, providerId: openai.providerId },
    fallbacks: [claude, modal, { ...local, reasoningEffort: null }]
  }));
});

test('reapplying a primary change retains concurrent fallback edits and inherited effort', () => {
  const edited = changePrimary(original, { id: claude.providerId });
  edited.primary = { providerId: claude.providerId, modelId: claude.modelId };
  const changedModal = { ...modal, reasoningEffort: 'low' };
  const latest = { ...original, fallbacks: [changedModal, claude, local] };
  const merged = reapplyPolicyEdits(original, edited, latest);
  assert.equal(merged.primary.providerId, claude.providerId);
  assert.equal(Object.hasOwn(merged.primary, 'reasoningEffort'), false);
  assert.deepEqual(merged.fallbacks, [changedModal, openai, local]);
});

test('a local fallback reorder retains a concurrent primary effort change', () => {
  const edited = { ...original, fallbacks: [modal, claude, local] };
  const primary = { ...openai, reasoningEffort: 'low' };
  const merged = reapplyPolicyEdits(original, edited, { ...original, primary });
  assert.deepEqual(merged, { ...edited, primary });
});

test('detects a retired model reintroduced only by rebasing an unsaved fallback edit', () => {
  const feature = { retiredModels: [], providers: [openai, claude, modal, local].map(step => ({
    id: step.providerId, models: step.modelId ? [{ id: step.modelId }] : []
  })) };
  const draft = changePrimary({ ...original, primary: { ...openai, modelId: 'old-custom' } }, { id: claude.providerId });
  const merged = reapplyPolicyEdits(original, draft, original);
  assert.equal(hasRetiredModel(feature, original), false);
  assert.equal(hasRetiredModel(feature, merged), true);
  merged.fallbacks[0] = openai;
  assert.equal(hasRetiredModel(feature, merged), false);
});

test('rebasing an old GLM draft applies the effective effort offered by the current catalog', () => {
  const primary = { providerId: 'workers-ai', modelId: 'glm', reasoningEffort: 'low' };
  const feature = { providers: [{ id: 'workers-ai', models: [{ id: 'glm', effortAliases: { medium: 'max' } }] }] };
  const baseline = { primary, fallbacks: [] };
  const draft = { primary: { ...primary, reasoningEffort: 'medium' }, fallbacks: [] };
  const merged = reapplyPolicyEdits(baseline, draft, baseline, feature);
  assert.equal(merged.primary.reasoningEffort, 'max');
});
