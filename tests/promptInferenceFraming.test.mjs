import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';
import { truncateSystemPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';
import { USER_PROMPT_INSTRUCTION_HEADER } from '../functions/lib/narrative/prompts/constants.js';

// The 2026-09-29 connected-tool audit (F03) saw readings state a querent's
// grief, and two hypothetical collaborators' private behavior, as fact. These
// checks keep the instructions that ask for possibility language in place;
// only a live provider run shows whether a model follows them.
const QUESTION =
  'Two hypothetical collaborators are planning a project. What could help them communicate well? Please do not guess at hidden feelings or private behavior.';
const RELATIONSHIP_CARDS = [
  { card: 'Page of Swords', name: 'Page of Swords', suit: 'Swords', rank: 'Page', rankValue: 11, position: 'You / your energy', orientation: 'Upright', meaning: 'Curiosity and fresh questions.' },
  { card: 'Five of Cups', name: 'Five of Cups', suit: 'Cups', rank: 'Five', rankValue: 5, position: 'Them / their energy', orientation: 'Reversed', meaning: 'Moving past disappointment.' },
  { card: 'Two of Pentacles', name: 'Two of Pentacles', suit: 'Pentacles', rank: 'Two', rankValue: 2, position: 'The connection / shared lesson', orientation: 'Upright', meaning: 'Balancing priorities.' }
];

async function relationshipSystemPrompt() {
  const themes = await analyzeSpreadThemes(RELATIONSHIP_CARDS, { userQuestion: QUESTION });
  return buildEnhancedClaudePrompt({
    spreadInfo: { name: 'Relationship Snapshot', key: 'relationship' },
    cardsInfo: RELATIONSHIP_CARDS,
    userQuestion: QUESTION,
    reflectionsText: '',
    themes
  }).systemPrompt;
}

describe('inference framing in the system prompt', () => {
  it('asks for possibilities, not facts, about feelings, history and other people', async () => {
    const systemPrompt = await relationshipSystemPrompt();
    const corePrinciples = systemPrompt.slice(systemPrompt.indexOf('CORE PRINCIPLES'), systemPrompt.indexOf('SPECIFICITY'));

    assert.match(corePrinciples, /as possibility, not fact/);
    assert.match(corePrinciples, /never reveal another person’s feelings, intentions, or private actions/);
    assert.match(corePrinciples, /hypothetical or about someone who is not present, keep it that way/);
    assert.match(corePrinciples, /as something the querent may recognize rather than a fact about them/);
    assert.match(systemPrompt, /present it as an illustration .*never as something that has happened/);
  });

  it('reads the relationship "Them" card as the querent’s experience, not the other person’s mind', async () => {
    const systemPrompt = await relationshipSystemPrompt();
    const flow = systemPrompt.match(/RELATIONSHIP FLOW:[^\n]*/)?.[0] || '';

    assert.match(flow, /querent’s experience of the other person/);
    assert.match(flow, /not as knowledge of that person’s feelings, intentions, or private actions/);
  });
});

// These are provider-input contract regressions, not a claim that prose rules
// prove model obedience. Fresh subscription outputs qualify the latter.
describe('personal history and symbolic pacing at the provider boundary', () => {
  const cardsInfo = [
    { card: 'The Star', name: 'The Star', number: 17, position: 'Past', orientation: 'Upright' },
    { card: 'Four of Pentacles', name: 'Four of Pentacles', suit: 'Pentacles', rank: 'Four', rankValue: 4, position: 'Present', orientation: 'Upright' },
    { card: 'The Sun', name: 'The Sun', number: 19, position: 'Future', orientation: 'Upright' }
  ];
  function build({ budgetTarget = 'claude', timingProfile = 'developing-arc', reflectionsText = '' } = {}) {
    return buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard' },
      cardsInfo,
      userQuestion: 'How can I trust a slow, steady recovery?',
      reflectionsText,
      themes: { timingProfile },
      budgetTarget,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
  }

  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    it(`keeps Past-position interpretations conditional through the closing for ${budgetTarget}`, () => {
      const { systemPrompt, userPrompt } = build({ budgetTarget });
      assert.match(systemPrompt, /Past[^\n]*(?:not|never)[^\n]*(?:event|history|achievement)/i);
      assert.match(systemPrompt, /(?:conditional|possibilit)[^\n]*(?:recap|closing)/i);
      assert.match(systemPrompt, /(?:recovery duration|recovery timescale|prognosis)/i);
      const footer = userPrompt.slice(userPrompt.indexOf(USER_PROMPT_INSTRUCTION_HEADER));
      assert.match(footer, /(?:personal facts|personal history)[^\n]*(?:supplied|provided)[^\n]*conditional/i);
      assert.match(userPrompt, /How can I trust a slow, steady recovery\?/);
    });
  }

  for (const timingProfile of ['near-term-tilt', 'longer-arc-tilt', 'developing-arc']) {
    it(`labels ${timingProfile} as symbolic while preserving a supplied recovery timeline`, () => {
      const { systemPrompt, userPrompt } = build({ timingProfile, reflectionsText: 'My clinician expects recovery to take three months. I do not want a new prognosis.' });
      assert.match(userPrompt, /Symbolic pacing:/);
      assert.doesNotMatch(userPrompt, /Timing: (?:Expect this|This reading leans toward near-term shifts|This pattern unfolds across)/);
      assert.match(userPrompt, /My clinician expects recovery to take three months/);
      assert.match(systemPrompt, /(?:literal|supplied)[^\n]*timing|timing[^\n]*(?:literal|supplied)/i);
      assert.match(systemPrompt, /(?:optional|suggested)[^\n]*(?:schedules|actions)[^\n]*(?:not forecasts|not predictions)/i);
    });
  }

  it('retains history and recovery limits in the critical system sections after budget fitting', () => {
    const result = truncateSystemPromptSafely(build().systemPrompt, 2000);
    assert.match(result.text, /Past[^\n]*(?:not|never)[^\n]*(?:event|history|achievement)/i);
    assert.match(result.text, /(?:recovery duration|recovery timescale|prognosis)/i);
    assert.match(result.text, /conditional[^\n]*(?:recap|closing)/i);
  });
});
