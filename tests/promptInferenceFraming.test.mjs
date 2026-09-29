import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';

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
