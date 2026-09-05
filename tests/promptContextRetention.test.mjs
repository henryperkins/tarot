import assert from 'node:assert/strict';
import { it } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { truncateUserPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';
import { estimateTokenCount } from '../functions/lib/narrative/prompts/budgeting.js';
import { stripUserPromptContent, stripResponseEchoContent } from '../functions/lib/promptEngineering.js';
import { onRequestPost } from '../functions/api/tarot-reading.js';

const question = 'I am preparing for a job interview. ' + 'I have been considering the details carefully. '.repeat(13) + 'Please keep the answer focused on the interview, without advice about quitting.';
const reflections = 'I am considering the sunlit path in the picture. '.repeat(15) + 'I cannot travel because I am caring for my father.';
const reflection = 'The golden colors remind me of a quiet afternoon at home. '.repeat(3) + 'The horse represents my daughter rather than a romantic partner.';
const card = { card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth and renewal.', userReflection: reflection };
const fixture = (overrides = {}) => ({ spreadInfo: { name: 'One-Card Insight', key: 'single' }, cardsInfo: [card], userQuestion: question, reflectionsText: reflections, context: 'general', budgetTarget: 'azure', ...overrides });

it('preserves accepted tail constraints in the real reading API request to Modal', async (t) => {
  const requests = [];
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'The Sun invites reflection. Your choices shape outcomes.' } }] });
  });
  const response = await onRequestPost({
    request: new Request('https://tableau.test/api/tarot-reading', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture()) }),
    env: { MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'test-token', MODAL_MODEL: 'test-qwen', GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' },
    waitUntil: (promise) => promise.catch(() => {})
  });
  assert.equal(response.status, 200);
  assert.equal(requests.length, 1);
  const prompt = requests[0].messages.find((message) => message.role === 'user').content;
  for (const tail of ['without advice about quitting', 'caring for my father', 'daughter rather than a romantic partner']) assert.ok(prompt.includes(tail), tail);
  const body = await response.json();
  const fields = body.sourceUsage.userContext.fields;
  for (const [key, originalLength] of [['question', question.length], ['reflections', reflections.length], ['card-0', reflection.length]]) {
    assert.equal(fields[key].originalLength, originalLength);
    assert.equal(fields[key].includedLength, originalLength);
    assert.equal(fields[key].budgetTruncated, false);
  }
});

it('does not deduplicate reflections with identical prefixes but different tail constraints', () => {
  const prefix = 'I noticed a warm and welcoming scene. '.repeat(5);
  const { userPrompt } = buildEnhancedClaudePrompt(fixture({ reflectionsText: prefix + 'I cannot travel.', cardsInfo: [{ ...card, userReflection: prefix + 'I can travel next month.' }] }));
  assert.match(userPrompt, /I cannot travel/);
  assert.match(userPrompt, /I can travel next month/);
});

it('budgets long reflections across cards, retains both ends and closes every data boundary', () => {
  const { userPrompt } = buildEnhancedClaudePrompt(fixture({ cardsInfo: Array.from({ length: 10 }, (_, index) => ({ ...card, position: `Focus ${index}`, userReflection: `Start ${index}. ` + '家族との時間を大切にします。'.repeat(80) + ` Tail constraint ${index}.` })), reflectionsText: reflections.repeat(4), spreadInfo: { name: 'Custom spread' } }));
  const result = truncateUserPromptSafely(userPrompt, 4000);
  assert.ok(estimateTokenCount(result.text) <= 4000);
  assert.match(result.text, /without advice about quitting/);
  assert.match(result.text, /Please now write the reading/);
  for (let index = 0; index < 10; index++) assert.ok(result.text.includes(`Tail constraint ${index}.`), `card ${index} receives context budget`);
  assert.equal((result.text.match(/<user_context /g) || []).length, (result.text.match(/<\/user_context>/g) || []).length);
  for (const match of result.text.matchAll(/<user_context source="[^"]+">([^\n]*?)<\/user_context>/g)) assert.doesNotThrow(() => JSON.parse(match[1]));
});

it('reports actual per-source losses after hard-cap truncation without exposing context in metadata', () => {
  const longReflection = '私の家族について考えています。'.repeat(80) + 'TAILCARE';
  const built = buildEnhancedClaudePrompt(fixture({ cardsInfo: Array.from({ length: 30 }, (_, index) => ({ ...card, position: `Focus ${index}`, userReflection: longReflection })), spreadInfo: { name: 'Custom spread' } }));
  const fields = built.promptMeta.sourceUsage.userContext.fields;
  assert.equal(fields.question.budgetTruncated, false);
  assert.equal(fields.question.includedLength, question.length);
  assert.equal(fields['card-29'].budgetTruncated, true);
  assert.ok(fields['card-29'].includedLength > 0);
  assert.ok(fields['card-29'].includedLength < longReflection.length);
  assert.equal(built.promptMeta.truncation.userContextTruncated, true);
  assert.doesNotMatch(JSON.stringify(fields), /TAILCARE|caring for my father/);
  const redacted = stripUserPromptContent(built.userPrompt);
  assert.doesNotMatch(redacted, /TAILCARE|私の家族|caring for my father/);
});

it('redacts serialized context before trajectory redaction can consume its closing tag, including response echoes', () => {
  const { userPrompt } = buildEnhancedClaudePrompt(fixture({ cardsInfo: [{ ...card, userReflection: 'My private note concerns GRANDORCHID. Outcome — likely path for a new job.' }] }));
  for (const redact of [stripUserPromptContent, stripResponseEchoContent]) {
    assert.doesNotMatch(redact(userPrompt), /GRANDORCHID/);
  }
});

it('counts per-card reflections as provided and used when they are the only personal context', () => {
  const { promptMeta } = buildEnhancedClaudePrompt(fixture({ userQuestion: '', reflectionsText: '' }));
  const usage = promptMeta.sourceUsage.userContext;
  assert.equal(usage.requested, true);
  assert.equal(usage.used, true);
  assert.equal(usage.cardReflectionsProvided, true);
  assert.equal(usage.cardReflectionsUsed, true);
  assert.ok(usage.usedInputs.includes('cardReflections'));
});

it('reports same-length sanitization and full-source deduplication without claiming complete duplicate retention', () => {
  const raw = 'A_B';
  const built = buildEnhancedClaudePrompt(fixture({ userQuestion: raw, reflectionsText: reflection }));
  const fields = built.promptMeta.sourceUsage.userContext.fields;
  assert.equal(fields.question.originalLength, 3);
  assert.equal(fields.question.sanitizedLength, 3);
  assert.equal(fields.question.sanitizationChanged, true);
  assert.equal(fields.reflections.reason, 'deduplicated');
  assert.equal(fields.reflections.duplicateOf, 'card-0');
  assert.equal(fields.reflections.includedLength, 0);
  assert.equal(fields.reflections.representedByDuplicate, true);
});

it('returns unused card-prose budget to personal context instead of stranding thousands of tokens', () => {
  const built = buildEnhancedClaudePrompt(fixture({ userQuestion: 'Q'.repeat(2000), reflectionsText: 'R'.repeat(5000), cardsInfo: Array.from({ length: 10 }, (_, index) => ({ ...card, position: `Focus ${index}`, userReflection: '家族'.repeat(998) + 'TAIL' })), spreadInfo: { name: 'Custom spread' } }));
  const tokens = estimateTokenCount(built.systemPrompt) + estimateTokenCount(built.userPrompt);
  assert.ok(tokens <= 20000);
  assert.ok(tokens > 18000, `unused budget should retain more context; got ${tokens}`);
  assert.ok(built.promptMeta.sourceUsage.userContext.fields['card-9'].includedLength > 1000);
});

it('reports partial effective retention when a deduplicated global reflection shares a budget-trimmed card', () => {
  const long = '家族の時間について考えています。'.repeat(80);
  const built = buildEnhancedClaudePrompt(fixture({ reflectionsText: long, cardsInfo: Array.from({ length: 30 }, (_, index) => ({ ...card, position: `Focus ${index}`, userReflection: long })), spreadInfo: { name: 'Custom spread' } }));
  const fields = built.promptMeta.sourceUsage.userContext.fields;
  assert.equal(fields.reflections.reason, 'deduplicated');
  assert.equal(fields.reflections.budgetTruncated, true);
  assert.equal(fields.reflections.representationTruncated, true);
  assert.equal(fields.reflections.representedLength, fields['card-0'].includedLength);
});
