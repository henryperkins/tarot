import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSelectiveEvalGatePolicy } from '../functions/lib/evalGatePolicy.js';

describe('selective evaluation gate policy', () => {
  it('does not force the gate for ordinary English readings when the global gate is off', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'What opens next?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, false);
    assert.equal(policy.forced, false);
    assert.equal(policy.effectiveEnv.EVAL_GATE_ENABLED, 'false');
  });

  it('forces the gate for non-English readings when evaluation is enabled', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: false, language: 'es' },
      userQuestion: 'Como puedo avanzar?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, true);
    assert.equal(policy.forced, true);
    assert.deepEqual(policy.reasons, ['language_es']);
    assert.equal(policy.effectiveEnv.EVAL_GATE_ENABLED, 'true');
  });

  it('forces the gate for restricted wellbeing readings when evaluation is enabled', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'wellbeing',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How should I think about anxiety and sleep?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, true);
    assert.equal(policy.forced, true);
    assert.ok(policy.reasons.includes('context_wellbeing'));
    assert.ok(policy.reasons.includes('restricted_medical'));
    assert.equal(policy.effectiveEnv.EVAL_GATE_ENABLED, 'true');
    assert.equal(policy.effectiveEvalGateEnabled, true);
    assert.equal(policy.effectiveEnv.EVAL_GATE_FAILURE_MODE, 'closed');
  });

  it('does not pretend to force the gate when evaluation is disabled', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' },
      context: 'wellbeing',
      languageSupport: { supported: false, language: 'fr' },
      userQuestion: 'Comment comprendre mon anxiete?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, true);
    assert.equal(policy.forced, false);
    assert.equal(policy.effectiveEvalGateEnabled, false);
    assert.equal(policy.effectiveEnv.EVAL_GATE_ENABLED, 'false');
  });

  // --- #1: restricted patterns narrowed so everyday questions don't force a sync gate ---
  it('does not force the gate for an everyday purchase question', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'Should I buy a gift for my friend?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, false);
    assert.equal(policy.forced, false);
  });

  it('does not force the gate for selling yourself in an interview', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How do I sell myself in the interview?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, false);
  });

  it('does not force the gate for sleeping on a decision', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How can I sleep on this decision before committing?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, false);
  });

  it('does not force the gate for escaping a rut at work', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How do I escape this rut at work?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, false);
  });

  it('does not force the gate for being in danger of falling behind', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'Am I in danger of falling behind at work?',
      reflectionsText: ''
    });

    assert.equal(policy.requested, false);
  });

  // --- #1 guards: genuinely sensitive questions must still force the gate ---
  it('still forces the gate for genuine financial distress', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How do I handle my crushing debt and possible bankruptcy?',
      reflectionsText: ''
    });

    assert.equal(policy.forced, true);
    assert.ok(policy.reasons.includes('restricted_financial'));
  });

  it('still forces the gate for a medical diagnosis question', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How do I cope with my recent anxiety diagnosis?',
      reflectionsText: ''
    });

    assert.equal(policy.forced, true);
    assert.ok(policy.reasons.includes('restricted_medical'));
  });

  it('still forces the gate for an abusive-relationship question', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How do I find the strength to leave my abusive partner?',
      reflectionsText: ''
    });

    assert.equal(policy.forced, true);
    assert.ok(policy.reasons.includes('restricted_abuse_safety'));
  });

  // --- #2: language-only forcing fails OPEN so an eval outage doesn't black-hole non-English readers ---
  it('fails open when a reading is forced solely by non-English detection', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'general',
      languageSupport: { supported: false, language: 'es' },
      userQuestion: 'Que me depara el futuro?',
      reflectionsText: ''
    });

    assert.equal(policy.forced, true);
    assert.deepEqual(policy.reasons, ['language_es']);
    assert.equal(policy.effectiveEnv.EVAL_GATE_ENABLED, 'true');
    assert.equal(policy.effectiveEnv.EVAL_GATE_FAILURE_MODE, 'open');
  });

  it('keeps failing closed when a non-English reading also has a safety reason', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' },
      context: 'wellbeing',
      languageSupport: { supported: false, language: 'es' },
      userQuestion: 'Que me depara el futuro?',
      reflectionsText: ''
    });

    assert.equal(policy.forced, true);
    assert.ok(policy.reasons.includes('language_es'));
    assert.ok(policy.reasons.includes('context_wellbeing'));
    assert.equal(policy.effectiveEnv.EVAL_GATE_FAILURE_MODE, 'closed');
  });

  it('honors an explicitly configured open failure mode for safety-forced readings', () => {
    const policy = buildSelectiveEvalGatePolicy({
      env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false', EVAL_GATE_FAILURE_MODE: 'open' },
      context: 'wellbeing',
      languageSupport: { supported: true, language: 'en' },
      userQuestion: 'How do I cope with my anxiety?',
      reflectionsText: ''
    });

    assert.equal(policy.forced, true);
    assert.equal(policy.effectiveEnv.EVAL_GATE_FAILURE_MODE, 'open');
  });

  // --- #4: effectiveEnv is always a usable object, even when env is absent ---
  it('returns a usable effectiveEnv object when called with no arguments', () => {
    const policy = buildSelectiveEvalGatePolicy();

    assert.equal(policy.requested, false);
    assert.equal(policy.forced, false);
    assert.ok(policy.effectiveEnv && typeof policy.effectiveEnv === 'object');
  });
});
