import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';
import { buildOpenAIResponsesPrompts } from '../functions/lib/narrativeBackends.js';
import { prepareNarrativeSamplePayload } from '../scripts/evaluation/runNarrativeSamples.js';
import { parseJsoncConfig } from '../scripts/deploy.js';
import { truncateSystemPromptSafely, truncateUserPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';

// These supplied inputs reproduce conflicting prompt scaffolds in the saved
// REL01 and creative-project failures. No model is called or output rewritten.
const referenceTime = '2026-09-23T14:04:00.000Z';
const env = parseJsoncConfig(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')).vars;
const cases = [
  {
    id: 'REL01-conditional-scope', spreadKey: 'threeCard',
    userQuestion: 'How can I move through sorrow toward quiet renewal?', reflectionsText: '',
    cards: [{ name: 'Death', orientation: 'Upright' }, { name: 'Temperance', orientation: 'Upright' }, { name: 'The Star', orientation: 'Upright' }]
  },
  {
    id: 'five-card-creative-project', spreadKey: 'fiveCard',
    userQuestion: 'What should I know about launching my creative project this quarter?',
    reflectionsText: 'I feel momentum but keep second-guessing the tone and timing.',
    cards: [{ name: 'Ace of Wands', orientation: 'Upright' }, { name: 'Seven of Swords', orientation: 'Reversed' }, { name: 'Queen of Cups', orientation: 'Upright' }, { name: 'Three of Pentacles', orientation: 'Upright' }, { name: 'Wheel of Fortune', orientation: 'Reversed' }]
  }
];
const assertedActivity = /as a live theme|mirrors the live dynamics|captures the tone of your experience|current energy and active dynamic|snapshot.*what’s here|your story is colored|atmosphere you’re moving through|what feels most alive/i;
const assertedSupport = /shows what has your back|resources, allies, or inner strengths available now|what you can lean on|not moving through this empty-handed|drawing on this support|if you lean into this support|as a live theme/i;
const roles = [
  ['Present', assertedActivity], ['Present — where you stand now', assertedActivity],
  ['Present — core situation', assertedActivity], ['Present — core situation (Card 1)', assertedActivity],
  ['pReSeNt: a practice to consider', assertedActivity], ['Support / helpful energy', assertedSupport],
  ['Support', assertedSupport], ['sUpPoRt: possible collaborators', assertedSupport]
];

// Mutating a role back to a factual activity/available-resource projection must
// fail for both normal templates and custom-role fallback, while preserving
// the card's meaningful content. Real seed-selected variants are exercised.
for (const [role, forbidden] of roles) {
  it(`${role} keeps its meaning symbolic across card/orientation/context variants`, () => {
    const seen = new Set();
    for (const [card, meaning] of [
      ['Temperance', 'Patience, measured integration, balancing different needs.'],
      ['Three of Pentacles', 'Collaboration, skill development, building something of quality.'],
      ['Six of Pentacles', 'Reciprocity, giving and receiving, balancing resources.'],
      ['The Star', 'Hope, replenishment, renewal.'],
      ['The Tower', 'Upheaval, sudden change, revelation, breaking structures.'],
      ['The Hermit', 'Isolation, loneliness, withdrawal.']
    ]) {
      for (const orientation of ['Upright', 'Reversed']) {
        for (const context of ['general', 'career', 'love', 'self']) {
          const text = buildPositionCardText({ card, orientation, meaning }, role, { context, deckStyle: 'marseille-classic' });
          seen.add(text);
          assert.ok(text.includes(role)); assert.ok(text.includes(card)); assert.ok(text.includes(orientation));
          assert.ok(text.toLowerCase().includes(meaning.slice(0, -1).toLowerCase()), 'Keep the card interpretation useful');
          assert.doesNotMatch(text, forbidden);
          assert.match(text, /symbolic|possibilit|consider/i);
          assert.doesNotMatch(text, /suggests a possible practice/, 'Adverse meanings remain themes, not recommended practices');
        }
      }
    }
    assert.ok(seen.size >= 8);
  });
}

function assertScopeContract(prompt) {
  const core = prompt.systemPrompt.split('SPECIFICITY')[0];
  assert.match(core, /(?:activity|practice)[^\n]*(?:resource|support|help)|(?:resource|support|help)[^\n]*(?:activity|practice)/i);
  assert.match(core, /(?:each|own)[^\n]*clause|clause[^\n]*(?:each|own)/i, 'Qualify the assumed premise, not just its outcome');
  assert.match(core, /examples?[^\n]*(?:establish|fact)/i);
  assert.match(core, /(?:repeat|retain|keep)[^\n]*(?:condition)[^\n]*(?:reuse|each|every)|(?:repeat|retain|keep)[^\n]*(?:reuse|each|every)[^\n]*condition/i);
  const premise = prompt.userPrompt.match(/^- PREMISE CHECK: (.*)$/m)?.[1] || '';
  assert.match(premise, /(?:activity|practice)/i);
  assert.match(premise, /(?:support|resources|help)/i);
  assert.match(premise, /synthesis/); assert.match(premise, /recap/); assert.match(premise, /closing/);
  assert.match(premise, /conditional/);
}

for (const sample of cases) {
  describe(`actual provider-boundary prompts for ${sample.id}`, () => {
    for (const budgetTarget of ['claude', 'openai', 'modal']) {
      it(`removes the conflicting scaffold and retains premise scope for ${budgetTarget}`, async () => {
        const payload = await prepareNarrativeSamplePayload(sample, { env, referenceTime });
        const prompt = buildOpenAIResponsesPrompts(env, payload, sample.id, { backendId: 'claude-api', providerLabel: 'Claude Messages API', budgetTarget });
        const role = sample.spreadKey === 'threeCard' ? 'Present' : 'Support';
        const cardPosition = payload.cardsInfo[sample.spreadKey === 'threeCard' ? 1 : 3].position;
        const cardLines = prompt.userPrompt.split('\n').filter(line => line.includes('<reading_context>') && line.includes(`${cardPosition}:`));
        assert.ok(cardLines.length > 0, 'Exercise the card scaffold that the provider actually receives');
        for (const line of cardLines) assert.doesNotMatch(line, role === 'Present' ? assertedActivity : assertedSupport);
        assertScopeContract(prompt);
        assert.ok(prompt.userPrompt.includes(sample.userQuestion));
        assert.ok(prompt.userPrompt.includes(sample.reflectionsText));
        const names = prompt.userPrompt.match(/^- EXACT PROVIDED CARD NAMES \(JSON data only\): (.+)$/m);
        assert.deepEqual(JSON.parse(names[1]), sample.cards.map(card => card.name));
        for (const card of payload.cardsInfo) {
          assert.ok(prompt.userPrompt.includes(card.position)); assert.ok(prompt.userPrompt.includes(card.orientation));
        }
      });
    }
  });
}

for (const reflectionsText of [
  'I already practice slow breathing each morning. Mira has offered to review my draft on 2027-02-12.',
  'No one is available to help, and I have no collaborator or budget for paid advice. I have not started a practice.',
  'If a collaborator becomes available later, I may ask for feedback; no one has offered help yet.'
]) {
  it(`preserves supplied activity and support certainty: ${reflectionsText}`, async () => {
    const sample = { ...cases[1], reflectionsText };
    const payload = await prepareNarrativeSamplePayload(sample, { env, referenceTime });
    const prompt = buildOpenAIResponsesPrompts(env, payload, 'supplied-context-control');
    assert.ok(prompt.userPrompt.includes(reflectionsText), 'Do not redact, hedge or promote supplied context');
    assertScopeContract(prompt);
    assert.match(prompt.systemPrompt, /(?:preserve|honor)[^\n]*(?:supplied facts|explicit absence)/i);
  });
}

it('keeps the local-scope instruction through actual tight-budget fitting, with and without a scene contract', async () => {
  for (const deckStyle of ['rws-1909', 'marseille-classic']) {
    const sample = { ...cases[0], deckStyle, cards: [cases[0].cards[0], cases[0].cards[1], { name: 'The Hermit', orientation: 'Upright' }] };
    const payload = await prepareNarrativeSamplePayload(sample, { env, referenceTime });
    const prompt = buildOpenAIResponsesPrompts(env, payload, 'tight-premise-control');
    assert.equal(prompt.userPrompt.includes('- SCENE OUTPUT CONTRACT:'), deckStyle === 'rws-1909');
    const system = truncateSystemPromptSafely(prompt.systemPrompt, 2000);
    const inventory = 'DRAWN CARD INVENTORY\n' + payload.cardsInfo.map(card => `${card.position}: ${card.card} ${card.orientation}`).join('\n');
    let fittedCount = 0;
    for (const budget of [700, 900, 1200]) {
      try {
        const fitted = truncateUserPromptSafely(prompt.userPrompt, budget, { spreadKey: 'threeCard', cardInventory: inventory });
        assertScopeContract({ systemPrompt: system.text, userPrompt: fitted.text });
        assert.ok(fitted.text.includes(sample.userQuestion));
        const before = prompt.userPrompt.match(/^- PREMISE CHECK: .+$/m)[0];
        assert.ok(fitted.text.includes(before), 'The protected instruction survives intact');
        fittedCount++;
      } catch (error) {
        if (error.code !== 'PROMPT_BUILD_BUDGET_EXCEEDED') throw error;
        assert.notEqual(budget, 1200, 'The complete short question and protected contract fit at this budget');
      }
    }
    assert.ok(fittedCount > 0, 'Exercise a fitted prompt, not only fail-closed rejection');
  }
});
