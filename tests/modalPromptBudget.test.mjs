import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { safeParseReadingRequest } from '../shared/contracts/readingSchema.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import {
  estimateTokenCount,
  getHardCapBudget,
  getPromptBudgetForTarget
} from '../functions/lib/narrative/prompts/budgeting.js';
import { parseUserContext } from '../functions/lib/narrative/prompts/userContext.js';
import { runNarrativeBackend } from '../functions/lib/narrativeBackends.js';

const constrainedEnv = {
  ENABLE_PROMPT_SLIMMING: 'true',
  PROMPT_BUDGET_DEFAULT: '300',
  PROMPT_BUDGET_AZURE: '400',
  PROMPT_BUDGET_CLAUDE: '500',
  GRAPHRAG_ENABLED: 'false'
};

function acceptedLongContext() {
  const parsed = safeParseReadingRequest({
    spreadInfo: { name: 'Custom spread', key: 'custom' },
    cardsInfo: MAJOR_ARCANA.slice(0, 15).map((card, index) => ({
      card: card.name,
      number: card.number,
      position: `Focus ${index + 1}`,
      orientation: 'Upright',
      meaning: card.upright,
      userReflection: '家族'.repeat(900) + ` Reflection tail ${index}.`
    })),
    userQuestion: '家族'.repeat(850) + ' Please keep the question tail.',
    reflectionsText: '日々の出来事'.repeat(600) + ' Please retain the global reflection tail.',
    personalization: { readingTone: 'gentle', spiritualFrame: 'psychological' }
  });
  assert.equal(parsed.success, true, parsed.error);
  return parsed.data;
}

describe('Modal prompt budgeting', () => {
  it('sends all accepted long context through the actual Modal backend without output or prompt token caps', async (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    let body;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      body = JSON.parse(options.body);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'A complete reading.' } }] });
    });
    const input = acceptedLongContext();
    const result = await runNarrativeBackend('modal-qwen', {
      ...constrainedEnv,
      MODAL_ENDPOINT_URL: 'https://example.modal.direct',
      MODAL_PROXY_TOKEN: 'wk-test.ws-test',
      MODAL_MAX_TOKENS: '8192'
    }, { ...input, analysis: { themes: {}, spreadAnalysis: null }, context: 'general' });
    assert.equal(Object.hasOwn(body, 'max_tokens'), false);
    assert.equal(body.chat_template_kwargs.enable_thinking, true);
    const user = body.messages.find((message) => message.role === 'user').content;
    const retained = parseUserContext(user);
    for (const [index, card] of input.cardsInfo.entries()) assert.equal(retained.get(`card-${index}`), card.userReflection);
    assert.equal(retained.get('question'), input.userQuestion);
    assert.equal(retained.get('reflections'), input.reflectionsText);
    assert.equal(result.promptMeta.truncation, null);
  });

  it('has no application soft or hard token budget despite other provider settings', () => {
    assert.equal(getPromptBudgetForTarget('modal', { env: constrainedEnv }), null);
    assert.equal(getHardCapBudget('modal'), null);
  });

  it('retains complete accepted Unicode context above prior caps without slimming or budget-loss metadata', () => {
    const input = acceptedLongContext();
    const built = buildEnhancedClaudePrompt({
      ...input,
      context: 'general',
      budgetTarget: 'modal',
      promptBudgetEnv: constrainedEnv
    });
    const tokens = estimateTokenCount(built.systemPrompt) + estimateTokenCount(built.userPrompt);
    assert.ok(tokens > 25000, `fixture must exceed both previous provider caps; got ${tokens}`);

    const retained = parseUserContext(built.userPrompt);
    const expectedFields = [
      ['question', input.userQuestion],
      ['reflections', input.reflectionsText],
      ...input.cardsInfo.map((card, index) => [`card-${index}`, card.userReflection])
    ];
    for (const [source, text] of expectedFields) {
      assert.equal(retained.get(source), text, `${source} should retain its full accepted context`);
      const usage = built.promptMeta.sourceUsage.userContext.fields[source];
      assert.equal(usage.includedLength, text.length, source);
      assert.equal(usage.budgetTruncated, false, source);
      assert.equal(usage.reason, null, source);
    }
    assert.equal(built.promptMeta.slimmingEnabled, false);
    assert.deepEqual(built.promptMeta.slimmingSteps, []);
    assert.equal(built.promptMeta.hardCap, null);
    assert.equal(built.promptMeta.truncation, null);
    assert.equal(built.promptMeta.sourceUsage.userContext.toneUsed, true);
    assert.equal(built.promptMeta.sourceUsage.userContext.frameUsed, true);
    assert.match(built.systemPrompt, /user_context blocks/);
    assert.deepEqual(JSON.parse(JSON.stringify(built.promptMeta)), built.promptMeta);
  });

  for (const [target, hardCap, softBudget] of [['azure', 20000, 400], ['claude', 25000, 500]]) {
    it(`continues to enforce ${target} budgets for the same long context`, (t) => {
      t.mock.method(console, 'warn', () => {});
      const built = buildEnhancedClaudePrompt({
        ...acceptedLongContext(),
        context: 'general',
        budgetTarget: target,
        promptBudgetEnv: constrainedEnv
      });
      const tokens = estimateTokenCount(built.systemPrompt) + estimateTokenCount(built.userPrompt);
      assert.ok(tokens <= hardCap, `${target} must stay within ${hardCap}, got ${tokens}`);
      assert.equal(built.promptMeta.slimmingEnabled, true);
      assert.equal(built.promptMeta.estimatedTokens.budget, softBudget);
      assert.equal(built.promptMeta.estimatedTokens.hardCap, hardCap);
      assert.ok(Object.values(built.promptMeta.sourceUsage.userContext.fields).some((field) => field.budgetTruncated));
    });
  }
});
