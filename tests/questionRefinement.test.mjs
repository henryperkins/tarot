import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkQuestionRefinement } from '../shared/coach/questionRefinement.js';

const original = 'What can help me speak more openly with my sister this week?';

test('narrow wording edits may preserve the current concern', () => {
  for (const candidate of [original, 'How can I speak more honestly with my sister this week?', 'What can help me speak more openly and honestly with my sister this week?']) {
    assert.deepEqual(checkQuestionRefinement(original, candidate), { valid: true, issues: [] });
  }
});

test('a same-time unsupported silence premise and dropped concern are rejected', () => {
  for (const candidate of ['What can help me understand the silence between my sister and me this week?', 'What can help me speak openly this week?', 'How can I heal my trauma with my sister this week?']) {
    assert.equal(checkQuestionRefinement(original, candidate).valid, false, candidate);
  }
});

test('roles, perspective, goals and negation cannot move while vocabulary survives', () => {
  const pairs = [
    ['How can I help my sister speak to my mother this week?', 'How can I help my mother speak to my sister this week?'],
    ['How can I understand my sister this week?', 'How can my sister understand me this week?'],
    ['How can I stop contacting my sister this week?', 'How can I contact my sister this week?'],
    ['How can I ask my sister not to contact me this week?', 'How can I not ask my sister to contact me this week?']
  ];
  for (const [source, candidate] of pairs) assert.equal(checkQuestionRefinement(source, candidate).valid, false, source);
});

test('the supported self-doubt reframe retains its concern without a promise', () => {
  assert.equal(checkQuestionRefinement('Will I ever stop doubting myself in my career?', 'What can help me understand and work with self-doubt in my career?').valid, true);
});

test('the presence of a word in an optional detail does not affirm it as a fact', () => {
  assert.equal(checkQuestionRefinement(original, 'What can help with the silence between my sister and me this week?', { detail: 'I do not want to assume there is silence' }).valid, false);
});

test('exact quantities and punctuation-bearing subjects cannot silently change', () => {
  for (const [source, candidate] of [
    ['How can I prepare for a C# interview this week?', 'How can I prepare for a C++ interview this week?'],
    ['What can help me repay $1,200 this week?', 'What can help me repay $200 this week?'],
    ['What can help Alex support Sam this week?', 'What can help Sam support Alex this week?']
  ]) assert.equal(checkQuestionRefinement(source, candidate).valid, false, source);
});

test('uncertain language may stay unchanged and cannot acquire English framing', () => {
  const source = '¿Cómo puedo cuidar mi relación con mi hermana esta semana?';
  assert.deepEqual(checkQuestionRefinement(source, source), { valid: true, issues: [] });
  assert.equal(checkQuestionRefinement(source, `What can help me ${source}`).valid, false);
});

test('a copied negative preference may move as a whole without changing its scope', () => {
  assert.equal(checkQuestionRefinement(
    'I do not want to contact my sister this week. What can help me consider my choices?',
    'What can help me consider my choices if I do not want to contact my sister this week?'
  ).valid, true);
});

test('a collective reader question cannot quietly become an individual one', () => {
  assert.equal(checkQuestionRefinement(
    'How can we support our sister this week?',
    'How can I support our sister this week?'
  ).valid, false);
});

test('self-doubt editing does not remove an independent stopping goal', () => {
  for (const [source, candidate] of [
    ['Will I ever stop doubting myself in my career? I want to stop contacting my sister this week.', 'What can help me understand and work with self-doubt in my career? I want to contact my sister this week.'],
    ['Will I stop doubting myself in my career and stop contacting my sister this week?', 'What can help me understand and work with self-doubt in my career and contact my sister this week?']
  ]) assert.equal(checkQuestionRefinement(source, candidate).valid, false);
});

test('a later question cannot conceal a changed declarative fact or role', () => {
  assert.equal(checkQuestionRefinement(
    'I can help my sister. What can help my sister this week?',
    'My sister can help me. What can help my sister this week?'
  ).valid, false);
});

test('body names and factual tense are protected rather than treated as framing', () => {
  for (const [source, candidate] of [
    ['How can I support May this week?', 'How can I support this week?'],
    ['How can I work with Will this week?', 'How can I work with this week?'],
    ['How can I support May this week?', 'How can I support may this week?'],
    ['How can I understand why my sister was hurt this week?', 'How can I understand why my sister is hurt this week?']
  ]) assert.equal(checkQuestionRefinement(source, candidate).valid, false, source);
});

test('keeping a concrete entity does not authorize adding a second one', () => {
  for (const [source, candidate] of [
    ['How can I prepare for my C# interview this week?', 'How can I prepare for my C# and C++ interview this week?'],
    ['How can I prepare for my $50 interview this week?', 'How can I prepare for my $50 and €50 interview this week?']
  ]) assert.equal(checkQuestionRefinement(source, candidate).valid, false, source);
});

test('editing equivalences cannot turn a reported past action into a present one', () => {
  for (const [source, candidate] of [
    ['What can help me reflect on what I spoke about with my sister this week?', 'What can help me reflect on what I speak about with my sister this week?'],
    ['How can I understand why I contacted my sister this week?', 'How can I understand why I contact my sister this week?'],
    ['What can help me understand what I prepared for my interview this week?', 'What can help me understand what I prepare for my interview this week?']
  ]) assert.equal(checkQuestionRefinement(source, candidate).valid, false, source);
});
