import assert from 'assert';
import { describe, it } from 'node:test';
import { estimateTokenCount, truncateSystemPromptSafely } from '../functions/lib/narrative/prompts.js';
import * as budgeting from '../functions/lib/narrative/prompts/budgeting.js';
import { truncateToTokenBudget, truncateUserPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { buildSystemPrompt } from '../functions/lib/narrative/prompts/systemPrompt.js';
import { fitUserContext, parseUserContext, renderUserContext } from '../functions/lib/narrative/prompts/userContext.js';
import { collectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { parseMemoryBlocks } from '../functions/lib/userMemory.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';

const promptFixture = (overrides = {}) => ({
  spreadInfo: { key: 'single', name: 'One-Card Insight' },
  cardsInfo: [{ card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth and renewal.' }],
  userQuestion: 'What can I consider this week?',
  budgetTarget: 'openai',
  ...overrides
});

function scopedProcessDivisor(t, value) {
  const before = process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE;
  if (value === undefined) delete process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE;
  else process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE = value;
  t.after(() => {
    if (before === undefined) delete process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE;
    else process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE = before;
  });
}

describe('request-local token calibration', () => {
  it('uses Worker-only calibration for construction and the final reported estimate', t => {
    scopedProcessDivisor(t, undefined);
    const env = { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1', ENABLE_PROMPT_SLIMMING: 'true', GRAPHRAG_ENABLED: 'false' };
    const built = buildEnhancedClaudePrompt(promptFixture({ promptBudgetEnv: env }));
    const expected = estimateTokenCount(built.systemPrompt, { env }) + estimateTokenCount(built.userPrompt, { env });
    assert.equal(built.promptMeta.estimatedTokens.total, expected);
    assert.equal(built.promptMeta.estimatedTokens.divisorUsed, 1.1);
  });

  it('captures valid configuration without sharing later environment mutations', t => {
    scopedProcessDivisor(t, '1.2');
    const env = { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1' };
    const worker = budgeting.createTokenEstimator({ env });
    const emptyWorker = budgeting.createTokenEstimator({ env: {} });
    const processOnly = budgeting.createTokenEstimator();
    env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE = '9';
    process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE = '9';
    assert.equal(worker.estimate('A'.repeat(110)), 108);
    assert.equal(emptyWorker.estimate('A'.repeat(110)), 40);
    assert.equal(processOnly.divisor, 1.2);
    assert.equal(worker.divisor, 1.1);
    assert.equal(worker.estimate('A'.repeat(110), { detailed: true }).breakdown.divisorUsed, 1.1);
    assert.ok(Object.isFrozen(worker));
    assert.throws(() => { worker.divisor = 9; }, TypeError);
  });

  it('keeps explicit Worker defaults independent of a conflicting process override', t => {
    scopedProcessDivisor(t, '1.1');
    for (const raw of [undefined, '', 'bad', 'Infinity', '1', '10', '0', '-3']) {
      const estimator = budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: raw } });
      assert.equal(estimator.divisor, 3.25, `invalid override ${raw}`);
      assert.equal(estimator.estimate('A'.repeat(110)), 40);
    }
    assert.equal(budgeting.createTokenEstimator({ env: {} }).divisor, 3.25);
    assert.equal(budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '2.5' } }).divisor, 2.5);
    assert.equal(budgeting.createTokenEstimator().divisor, 1.1);
    assert.equal(estimateTokenCount('A'.repeat(110)), 108, 'compatibility API keeps process fallback');
  });

  it('does not leak calibration between interleaved builds', async t => {
    scopedProcessDivisor(t, '1.2');
    const [conservative, defaults] = await Promise.all([1.1, 3.25].map(async divisor => {
      const env = { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: String(divisor), ENABLE_PROMPT_SLIMMING: 'true', GRAPHRAG_ENABLED: 'false' };
      const built = buildEnhancedClaudePrompt(promptFixture({ promptBudgetEnv: env }));
      return { built, divisor, expected: estimateTokenCount(built.systemPrompt, { env }) + estimateTokenCount(built.userPrompt, { env }) };
    }));
    for (const { built, divisor, expected } of [conservative, defaults]) {
      assert.equal(built.promptMeta.estimatedTokens.total, expected);
      assert.equal(built.promptMeta.estimatedTokens.divisorUsed, divisor);
    }
    assert.ok(conservative.expected > defaults.expected);
    assert.equal(process.env.TOKEN_ESTIMATE_DIVISOR_OVERRIDE, '1.2');
  });

  it('uses the captured estimator in prefix, suffix and protected system fitting', t => {
    scopedProcessDivisor(t, '9');
    const estimator = budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1' } });
    const text = 'HEAD ' + 'A'.repeat(1200) + ' TAIL';
    for (const tailTokens of [0, 90, 300]) {
      const result = truncateToTokenBudget(text, 300, { estimator, tailTokens });
      assert.equal(result.originalTokens, estimator.estimate(text));
      assert.ok(estimator.estimate(result.text) <= 300);
      if (tailTokens) assert.match(result.text, /TAIL$/);
    }
    const system = 'Optional intro. '.repeat(100) + '\n## ETHICS\nPreserve agency.\n## CORE PRINCIPLES\nUse only drawn cards.\n## MODEL DIRECTIVES:\nFinish the reading.';
    const result = truncateSystemPromptSafely(system, 180, { estimator });
    assert.equal(result.originalTokens, estimator.estimate(system));
    assert.ok(estimator.estimate(result.text) <= 180);
    assert.match(result.text, /ETHICS/);
    assert.match(result.text, /CORE PRINCIPLES/);
  });

  it('applies calibration when fitting recursive Unicode and literal-timing context excerpts', t => {
    scopedProcessDivisor(t, '9');
    const estimator = budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1' } });
    const question = 'Do not suggest leaving my job before November. ' + 'A careful practical detail. '.repeat(8) + 'I cannot travel until next March.';
    const reflection = '家族と時間を過ごします。🌙 '.repeat(40) + 'I will be 40 next year, not now.';
    const field = fitUserContext('question', question, 300, { estimator });
    assert.ok(estimator.estimate(field) <= 300);
    assert.match(field, /before November/);
    assert.match(field, /next March/);
    const prompt = `**Question**: ${renderUserContext('question', question)}\n\n**Querent's Reflections**: ${renderUserContext('reflections', reflection)}\n\n### CARD\nTheme: The Sun — Upright.\n\nPlease now write the reading\n- Use only the drawn cards.\n- Honor agency and choice.`;
    const result = truncateUserPromptSafely(prompt, 1600, { spreadKey: 'single', estimator });
    assert.equal(result.originalTokens, estimator.estimate(prompt));
    assert.ok(estimator.estimate(result.text) <= 1600);
    const retained = parseUserContext(result.text);
    assert.equal(retained.size, 2);
    assert.match(JSON.stringify(retained.get('question')), /next March/);
    assert.match(JSON.stringify(retained.get('reflections')), /not now/);
    assert.match(result.text, /Please now write the reading/);
    assert.equal((result.text.match(/<user_context /g) || []).length, (result.text.match(/<\/user_context>/g) || []).length);
  });

  it('uses selected calibration when deciding whether tone and frame fit during construction', t => {
    scopedProcessDivisor(t, undefined);
    const estimator = budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1' } });
    const prompt = buildSystemPrompt('single', {}, 'general', 'rws-1909', '', {
      personalization: { readingTone: 'gentle', spiritualFrame: 'secular' }, maxTokenBudget: 6000, estimator
    });
    assert.doesNotMatch(prompt, /## Reading Tone|## Interpretive Frame/);
  });

  it('calibrates against the selected divisor rather than the default', () => {
    const estimator = budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1' } });
    const compared = budgeting.compareEstimateWithActual(1200, 1000, { estimator });
    assert.equal(compared.currentDivisor, 1.1);
    assert.equal(compared.impliedDivisor, 1.32);
  });

  it('fails with a stable code when complete protected safety sections cannot fit', t => {
    scopedProcessDivisor(t, undefined);
    t.mock.method(console, 'warn', () => {});
    assert.throws(() => buildEnhancedClaudePrompt(promptFixture({
      promptBudgetEnv: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1', GRAPHRAG_ENABLED: 'false' },
      variantOverrides: { toneEmphasis: 'A'.repeat(50000) }
    })), error => error.code === 'PROMPT_BUILD_BUDGET_EXCEEDED' && !error.message.includes('AAAA'));
  });
});

describe('calibrated hard-cap and retained-content boundaries', () => {
  // ASCII fixtures hand-calculated from ceil(bytes / 3), ceil(chars / divisor)
  // and the eight-percent buffer. Each triple is exactly cap - 1, cap, cap + 1.
  for (const { divisor, target, cap, lengths } of [
    { divisor: 3.25, target: 'openai', cap: 20000, lengths: [55549, 55552, 55555] },
    { divisor: 1.1, target: 'openai', cap: 20000, lengths: [20368, 20369, 20370] },
    { divisor: 3.25, target: 'claude', cap: 25000, lengths: [69439, 69442, 69445] },
    { divisor: 1.1, target: 'claude', cap: 25000, lengths: [25461, 25462, 25463] }
  ]) {
    it(`fits below, equal and above the ${target} hard cap with divisor ${divisor}`, () => {
      const estimator = budgeting.createTokenEstimator({ env: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: String(divisor) } });
      assert.equal(budgeting.getHardCapBudget(target), cap);
      for (const [index, length] of lengths.entries()) {
        const text = 'A'.repeat(length);
        const result = truncateToTokenBudget(text, cap, { estimator });
        assert.equal(result.originalTokens, cap + index - 1);
        assert.equal(result.truncated, index === 2);
        assert.ok(estimator.estimate(result.text) <= cap);
        if (index < 2) assert.equal(result.text, text);
      }
    });
  }

  it('preserves default prompt arithmetic and null-estimate policy with an explicit empty Worker environment', t => {
    scopedProcessDivisor(t, undefined);
    const baseline = buildEnhancedClaudePrompt(promptFixture());
    const explicitDefault = buildEnhancedClaudePrompt(promptFixture({ promptBudgetEnv: {} }));
    assert.equal(explicitDefault.systemPrompt, baseline.systemPrompt);
    assert.equal(explicitDefault.userPrompt, baseline.userPrompt);
    assert.equal(explicitDefault.promptMeta.estimatedTokens, null);
    assert.deepEqual(explicitDefault.promptMeta.slimmingSteps, []);
    assert.equal(budgeting.getPromptBudgetForTarget('claude', { env: {} }), 16000);
    assert.equal(budgeting.getPromptBudgetForTarget('openai', { env: {} }), 12000);
  });

  for (const slimming of [false, true]) {
    it(`keeps final calibrated accounting and complete data blocks under caps with soft slimming ${slimming ? 'on' : 'off'}`, t => {
      scopedProcessDivisor(t, undefined);
      t.mock.method(console, 'warn', () => {});
      t.mock.method(console, 'log', () => {});
      const cardsInfo = resolveReadingCards(['The Moon', 'The Star', 'Death', 'Temperance', 'The Tower', 'Wheel of Fortune', 'The Hermit', 'Judgement', 'The World', 'The Sun'].map((card, index) => ({
        card, position: `Position ${index + 1}`, orientation: index % 2 ? 'Reversed' : 'Upright',
        userReflection: (`Beginning ${index}. ` + 'I am considering a practical detail at work. '.repeat(50)).slice(0, 1950) + ` I cannot travel before November ${index}.`
      })));
      const args = promptFixture({
        cardsInfo, spreadInfo: { key: 'celtic', name: 'Celtic Cross (Classic 10-Card)' },
        userQuestion: 'I need to review my workplace choices. ' + 'A relevant practical detail. '.repeat(50) + 'Do not suggest quitting before March.',
        reflectionsText: ('家族 🌙 '.repeat(60) + 'I am thinking carefully about work. '.repeat(150)).slice(0, 4950) + 'I cannot move this year.',
        memories: [{ id: 'private-budget-memory', category: 'communication', text: 'Prefers concise practical advice.' }]
      });
      const retainedLengths = [];
      for (const divisor of [3.25, 1.1]) {
        const env = { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: String(divisor), ENABLE_PROMPT_SLIMMING: String(slimming), GRAPHRAG_ENABLED: 'false' };
        const estimator = budgeting.createTokenEstimator({ env });
        const built = buildEnhancedClaudePrompt({ ...args, promptBudgetEnv: env });
        const total = estimator.estimate(built.systemPrompt) + estimator.estimate(built.userPrompt);
        assert.ok(total <= 20000, `${divisor}: ${total}`);
        if (built.promptMeta.estimatedTokens) {
          assert.equal(built.promptMeta.estimatedTokens.total, total);
          assert.equal(built.promptMeta.estimatedTokens.divisorUsed, divisor);
        }
        for (const name of ['user_context', 'reading_context', 'reading_memory', 'reference']) {
          assert.equal((built.userPrompt.match(new RegExp(`<${name}(?: |>)`, 'g')) || []).length, (built.userPrompt.match(new RegExp(`</${name}>`, 'g')) || []).length, name);
        }
        const retained = parseUserContext(built.userPrompt);
        const fields = built.promptMeta.sourceUsage.userContext.fields;
        for (const [source, value] of retained) {
          assert.equal(fields[source].includedLength, typeof value === 'string' ? value.length : value.head.length + value.tail.length);
        }
        assert.deepEqual(built.memoryRetention.retainedSlots, [...parseMemoryBlocks(built.userPrompt).keys()]);
        assert.equal(built.promptMeta.memories.retainedCount, built.memoryRetention.retainedSlots.length);
        assert.doesNotMatch(JSON.stringify(built.promptMeta), /private-budget-memory|before November/);
        retainedLengths.push(Object.values(fields).reduce((sum, field) => sum + field.includedLength, 0));
      }
      assert.ok(retainedLengths[0] > retainedLengths[1], `calibration reduction is observable: ${retainedLengths}`);
      t.diagnostic(`Included user-context characters: default=${retainedLengths[0]}, divisor 1.1=${retainedLengths[1]}`);
    });
  }

  it('derives full, summary and removed reference receipts from the calibrated final prompt', t => {
    t.mock.method(console, 'log', () => {});
    const cardsInfo = resolveReadingCards(['The Fool', 'Death', 'The Star', 'The Sun', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant', 'The Lovers'].map((card, index) => ({ card, position: `Position ${index + 1}`, orientation: 'Upright' })));
    const passages = [0, 13, 17, 19].map((number, index) => ({ ...collectPassageCandidates({ singleMajorNumber: number, totalMajors: 1 })[0], relevanceScore: [0.1, 0.9, 0.3, 0.8][index] }));
    const graphRAGPayload = { passages, maxPassages: 4 };
    const themes = { knowledgeGraph: { ...buildGraphContext(cardsInfo), graphRAGPayload } };
    const modes = new Set();
    for (const budget of [20000, 16000, 15000, 6000]) {
      const built = buildEnhancedClaudePrompt(promptFixture({
        cardsInfo, themes, graphRAGPayload, subscriptionTier: 'pro', spreadInfo: { key: 'celtic', name: 'Celtic Cross (Classic 10-Card)' },
        promptBudgetEnv: { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1', ENABLE_PROMPT_SLIMMING: 'true', GRAPHRAG_ENABLED: 'true', PROMPT_BUDGET_OPENAI: String(budget) }
      }));
      const graph = built.promptMeta.sourceUsage.graphRAG;
      modes.add(graph.mode);
      assert.equal(built.promptMeta.graphRAG.retainedPassageCount, graph.passageIndices.length);
      assert.equal(graph.mode === 'full', built.userPrompt.includes('<reference>'));
      for (const index of graph.passageIndices) assert.ok(built.userPrompt.includes(passages[index].promptText));
      if (graph.mode !== 'full') assert.deepEqual(graph.passageIndices, []);
      assert.equal(built.promptMeta.sourceUsage.patterns.used, built.userPrompt.includes('**Archetypal Patterns**'));
    }
    assert.deepEqual([...modes].sort(), ['full', 'none', 'summary']);
  });

  it('keeps Modal application caps null and accepted context complete under conservative calibration', () => {
    const reflectionsText = 'A practical reflection. '.repeat(190) + 'I cannot move this year.';
    const env = { TOKEN_ESTIMATE_DIVISOR_OVERRIDE: '1.1', ENABLE_PROMPT_SLIMMING: 'true', PROMPT_BUDGET_DEFAULT: '10', GRAPHRAG_ENABLED: 'false' };
    const built = buildEnhancedClaudePrompt(promptFixture({ budgetTarget: 'modal', reflectionsText, promptBudgetEnv: env }));
    assert.equal(budgeting.getPromptBudgetForTarget('modal', { env }), null);
    assert.equal(budgeting.getHardCapBudget('modal'), null);
    assert.equal(built.promptMeta.estimatedTokens, null);
    assert.deepEqual(built.promptMeta.slimmingSteps, []);
    assert.equal(parseUserContext(built.userPrompt).get('reflections'), reflectionsText);
    assert.equal(built.promptMeta.sourceUsage.userContext.fields.reflections.budgetTruncated, false);
  });
});

describe('Token Budgeting', () => {
  it('estimates tokens for plain text', () => {
    const text = 'This is a simple test string.';
    const tokens = estimateTokenCount(text);
    assert(tokens > 0, 'Token count should be positive');
  });

  it('estimates tokens for emoji-heavy text', () => {
    const text = 'Hello 🌍! This is a test with 😀😂👍 emojis.';
    const tokens = estimateTokenCount(text);
    assert(tokens > estimateTokenCount('Hello world! This is a test without emojis.'));
  });

  it('estimates tokens for markdown-heavy text', () => {
    const text = '# Header\n\n**Bold** *italic* [link](url) ```code```';
    const tokens = estimateTokenCount(text);
    assert(tokens > estimateTokenCount('Header Bold italic link code'));
  });

  it('estimates tokens for Unicode text', () => {
    const text = 'こんにちは世界！这是一个测试。Это тест.';
    const tokens = estimateTokenCount(text);
    assert(tokens > 0);
  });

  it('preserves critical sections during truncation', () => {
    const longText = 'Long intro text\n## ETHICS\nImportant ethics content\n## CORE PRINCIPLES\nCore principles\n## OTHER\nTruncatable content';
    const truncated = truncateSystemPromptSafely(longText, 50);
    assert(truncated.text.includes('ETHICS') && truncated.text.includes('CORE PRINCIPLES'));
    assert(truncated.truncated);
  });

  it('handles multi-pass truncation', () => {
    // Test repeated truncation
    let text = 'A'.repeat(1000);
    text = truncateSystemPromptSafely(text, 200).text;
    text = truncateSystemPromptSafely(text, 100).text;
    assert(estimateTokenCount(text) <= 100);
  });

  it('returns minimal critical prompt when budget is exceeded', () => {
    const criticalHeavy = '## ETHICS\n' + 'X'.repeat(1000) + '\n## CORE PRINCIPLES\n' + 'Y'.repeat(1000);
    const truncated = truncateSystemPromptSafely(criticalHeavy, 100);
    assert(truncated.truncated, 'Should report truncation');
    assert(estimateTokenCount(truncated.text) <= 100, 'Should stay within budget');
    assert(truncated.text.includes('ETHICS'), 'Should preserve critical header');
  });

  it('handles edge cases', () => {
    assert.strictEqual(estimateTokenCount(''), 0);
    assert.strictEqual(estimateTokenCount(null), 0);
    const veryLong = 'A'.repeat(10000);
    const truncated = truncateSystemPromptSafely(veryLong, 100);
    assert(truncated.truncated);
    assert(estimateTokenCount(truncated.text) <= 100);
  });
});
