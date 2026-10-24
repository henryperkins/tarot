import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { detectAllPatterns, getPriorityPatternNarratives } from '../functions/lib/knowledgeGraph.js';

const forbiddenLayout = /crossed stems|stable lattice|quadrants built|hexagonal arrangement|asymmetry appears|emblem misaligned|three triads stacked|four pairs framing|double loops suggesting infinity|central flower pierced/i;
const env = { GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false' };
const minor = name => ({ ...MINOR_ARCANA.find(card => card.name === name), card: name, orientation: 'Upright', position: 'Consideration' });
const sun = { ...MAJOR_ARCANA.find(card => card.number === 19), card: 'The Sun', orientation: 'Upright', position: 'Guidance' };
function build(cardsInfo, options = {}) {
  cardsInfo = cardsInfo.map(card => ({ ...card, meaning: card.meaning || card.upright || '' }));
  return buildEnhancedClaudePrompt({ spreadInfo: { name: 'General Reading' }, cardsInfo, userQuestion: 'What might help me reflect?', deckStyle: 'marseille-classic', promptBudgetEnv: env, ...options });
}

test('Marseille Cup rank themes do not supply unverified physical layouts to final provider prompts', () => {
  const cards = ['Four of Cups', 'Six of Cups', 'Seven of Cups'].map(minor);
  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    const built = build(cards, { budgetTarget });
    assert.doesNotMatch(built.userPrompt, forbiddenLayout);
    assert.match(built.userPrompt, /Structure/);
    assert.match(built.userPrompt, /Harmony/);
    assert.match(built.userPrompt, /Challenge/);
    assert.match(built.userPrompt, /Four of Coupes/);
    assert.match(built.userPrompt, /Six of Coupes/);
    assert.match(built.userPrompt, /Seven of Coupes/);
  }
});

test('Marseille equal-rank graph highlights retain actual cards without generic artwork claims', () => {
  const cards = ['Seven of Cups', 'Seven of Swords', 'Seven of Wands'].map(minor);
  const patterns = detectAllPatterns(cards, { deckStyle: 'marseille-classic' });
  const lines = getPriorityPatternNarratives(patterns, 'marseille-classic');
  const text = lines.filter(row => row.type === 'marseille-numerology').map(row => row.text).join('\n');
  assert.match(text, /Challenge/);
  assert.match(text, /Seven of Coupes/);
  assert.match(text, /Seven of Epees/);
  assert.match(text, /Seven of Batons/);
  assert.doesNotMatch(text, forbiddenLayout);
});

test('all forty Marseille pip cards retain rank meaning without invented layout evidence', () => {
  const cards = MINOR_ARCANA.filter(card => card.rankValue >= 1 && card.rankValue <= 10);
  assert.equal(cards.length, 40);
  for (const card of cards) {
    const built = build([minor(card.name)]);
    assert.doesNotMatch(built.userPrompt, forbiddenLayout, card.name);
    assert.match(built.userPrompt, new RegExp(`Pip ${card.rankValue}\\b`));
    assert.equal(built.promptMeta.sourceUsage.spreadCards.used, true);
  }
});

test('nonpresent ages receive explicit qualifier guidance without changing the accepted question', () => {
  for (const userQuestion of [
    'My daughter will be 8 this year. How can I support her at school?',
    'My daughter was 8 in 2024. How can I support her at school?',
    'My daughter will be 8 next year. How can I support her at school?'
  ]) {
    for (const budgetTarget of ['claude', 'openai', 'modal']) {
      const built = build([sun], { deckStyle: 'rws-1909', userQuestion, budgetTarget });
      assert.match(built.systemPrompt, /AGE AND TIME/);
      assert.match(built.systemPrompt, /do not calculate|do not derive/i);
      assert.match(built.systemPrompt, /next steps/i);
      assert.ok(built.userPrompt.includes(userQuestion));
    }
  }
});

test('nonpresent ages in overall and card reflections receive the same final guidance', () => {
  for (const extra of [
    { reflectionsText: 'My daughter was 8 in 2024.' },
    { cardsInfo: [{ ...sun, userReflection: 'My daughter will be 8 next year.' }] }
  ]) {
    const built = build(extra.cardsInfo || [sun], { deckStyle: 'rws-1909', userQuestion: 'How can I support my daughter at school?', ...extra });
    assert.match(built.systemPrompt, /AGE AND TIME/);
    assert.match(built.systemPrompt, /do not calculate|do not derive/i);
  }
});

test('explicit present-age authority stays usable without the nonpresent-age instruction', () => {
  const built = build([sun], { deckStyle: 'rws-1909', userQuestion: 'My daughter is 8. How can I support her at school?', memories: [{ id: 'present-eight', text: 'My daughter is 8', category: 'life_context' }] });
  assert.doesNotMatch(built.systemPrompt, /AGE AND TIME/);
  assert.equal(built.promptMeta.memories.retainedCount, 1);
  assert.ok(built.userPrompt.includes('My daughter is 8'));
});

test('RWS Chariot sensory context does not supply physical reins absent from its art', () => {
  const chariot = { ...MAJOR_ARCANA.find(card => card.number === 7), card: 'The Chariot', orientation: 'Upright', position: 'Guidance' };
  const built = build([chariot], { deckStyle: 'rws-1909' });
  assert.doesNotMatch(built.userPrompt, /Sensory: Reins taut/i);
  assert.match(built.userPrompt, /The Chariot/);
  assert.match(built.userPrompt, /willpower|determination|direction/i);
});

test('calibrated fitting keeps every drawn card and the literal long-input constraints', async () => {
  const { readFile } = await import('node:fs/promises');
  const { prepareNarrativeSamplePayload } = await import('../scripts/evaluation/runNarrativeSamples.js');
  const { buildOpenAIResponsesPrompts } = await import('../functions/lib/narrativeBackends.js');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/reading-pipeline-comparison-cases.json', import.meta.url), 'utf8'));
  const input = fixture.cases.find(row => row.id === 'P17');
  const workerEnv = { ...env, ...input.flags };
  const payload = await prepareNarrativeSamplePayload(input, { env: workerEnv, referenceTime: fixture.referenceTime });
  for (const [budgetTarget, cap] of [['claude', 25000], ['openai', 20000], ['modal', null]]) {
    const built = buildOpenAIResponsesPrompts(workerEnv, structuredClone(payload), 'test-protected-spread', { budgetTarget });
    for (const name of ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant', 'The Lovers', 'The Chariot', 'The Hermit', 'The Sun']) {
      assert.ok(built.userPrompt.includes(name), `${budgetTarget}: missing drawn card ${name}`);
    }
    for (const card of payload.cardsInfo) {
      assert.ok(built.userPrompt.includes(card.position), `${budgetTarget}: missing position ${card.position}`);
    }
    assert.match(built.userPrompt, /studio contract/);
    assert.match(built.userPrompt, /evenings-only/);
    assert.match(built.userPrompt, /school pickup/);
    assert.match(built.userPrompt, /after 18:00 on weekdays/);
    assert.match(built.userPrompt, /Never promise a promotion/);
    if (cap) {
      assert.ok(built.promptMeta.estimatedTokens.total <= cap);
      assert.equal(built.promptMeta.sourceUsage.graphRAG.passagesUsedInPrompt, 0);
      assert.equal(built.promptMeta.memories.retainedCount, 0);
    }
  }
});

test('an impossible complete-card inventory is rejected rather than partially delivered', async () => {
  const { truncateUserPromptSafely } = await import('../functions/lib/narrative/prompts/truncation.js');
  assert.throws(() => truncateUserPromptSafely('Verbose derived card context. '.repeat(100), 10, {
    cardInventory: '**Complete Drawn Spread**\n1. The Lovers: Self / Advice, Upright\n2. The Chariot: External Influences, Reversed'
  }), error => error.code === 'PROMPT_BUILD_BUDGET_EXCEEDED');
});

test('protected decision inventory cannot revive cleared or replaced legacy path labels', () => {
  const names = ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor'];
  const cardsInfo = names.map((name, index) => {
    const card = MAJOR_ARCANA.find(row => row.name === name);
    return { ...card, card: name, meaning: card.upright, orientation: 'Upright',
      position: index === 1 ? 'Path A: Old Orchard Office' : index === 2 ? 'Path B: Former Harbor Contract' : `Focus ${index}`,
      userReflection: 'Career planning and reflection. '.repeat(60) };
  });
  const built = buildEnhancedClaudePrompt({ spreadInfo: { name: 'Decision Spread', key: 'decision' }, cardsInfo,
    decisionPaths: { a: '', b: 'Studio contract' }, userQuestion: 'I want a practical comparison. ' + 'Careful planning. '.repeat(100),
    reflectionsText: 'Career planning with practical constraints. '.repeat(118),
    promptBudgetEnv: { ...env, TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1' }, budgetTarget: 'claude' });
  assert.equal(built.promptMeta.truncation?.userTruncated, true);
  assert.equal(built.userPrompt.includes('Old Orchard Office'), false);
  assert.equal(built.userPrompt.includes('Former Harbor Contract'), false);
  assert.match(built.userPrompt, /Studio contract/);
  assert.equal(cardsInfo[1].position, 'Path A: Old Orchard Office');
});
