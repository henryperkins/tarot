import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyzeSpreadThemes, analyzeThreeCard, analyzeCelticCross, analyzeRelationship } from '../functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt, buildThreeCardReading, buildRelationshipReading } from '../functions/lib/narrativeBuilder.js';
import { truncateSystemPromptSafely, truncateUserPromptSafely } from '../functions/lib/narrative/prompts/truncation.js';
import { USER_PROMPT_INSTRUCTION_HEADER } from '../functions/lib/narrative/prompts/constants.js';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';

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

  // The 2026-10-31 F3b standard run read "Them" through the old wording as
  // "Alex's Energy, as You Experience It" and closed on "The Knight's
  // directness, as you experience it", though the querent supplied only uneven
  // communication. The card is a possibility to test, not the querent's experience.
  it('keeps the relationship "Them" card a possibility to test, not the querent’s experience or the other person’s mind', async () => {
    const systemPrompt = await relationshipSystemPrompt();
    const flow = systemPrompt.match(/RELATIONSHIP FLOW:[^\n]*/)?.[0] || '';

    assert.match(flow, /symbolic possibility about the other side of the dynamic/);
    assert.match(flow, /compare with anything the querent has actually observed/);
    assert.match(flow, /not as the querent’s experience/);
    assert.match(flow, /not as knowledge of that person’s feelings, intentions, or private actions/);
    assert.match(flow, /including headings, synthesis and closing/);
    assert.doesNotMatch(flow, /Read the "Them" card as the querent’s experience/);
  });
});

describe('relationship "Them" evidence stays a possibility in every emitter', () => {
  const ASSERTED_STANCE = /sketches their stance|how they’re currently arriving|Their energy in this dynamic|How they are approaching|as a live theme|as you experience|your experience of them/i;
  const POSSIBILITY = /anything actually observed/;
  const cards = [
    ['Knight of Swords', 'Swords', 'Knight', 12, 'Decisive action, sharp focus, pursuing truth swiftly'],
    ['Five of Cups', 'Cups', 'Five', 5, 'Moving past disappointment'],
    ['Queen of Wands', 'Wands', 'Queen', 13, 'Confidence and warmth'],
    ['Two of Pentacles', 'Pentacles', 'Two', 2, 'Balancing priorities'],
    ['Page of Cups', 'Cups', 'Page', 11, 'Curiosity and tender openness'],
    ['Ten of Swords', 'Swords', 'Ten', 10, 'Painful endings and release']
  ];

  it('position text for every template variant tests a possibility instead of describing the other person', () => {
    const texts = [];
    for (const [card, suit, rank, rankValue, meaning] of cards) {
      for (const orientation of ['Upright', 'Reversed']) {
        for (const context of ['love', 'general', 'self']) {
          texts.push(buildPositionCardText(
            { card, name: card, suit, rank, rankValue, orientation, meaning },
            'Them / their energy',
            { context }
          ));
        }
      }
    }
    for (const text of texts) {
      assert.doesNotMatch(text, ASSERTED_STANCE, text);
      assert.match(text, /possib|test|symbolic/i, text);
    }
    assert.ok(texts.some(text => POSSIBILITY.test(text)));
  });

  it('a custom Them role without a template still keeps the card a possibility', () => {
    const text = buildPositionCardText(
      { card: 'Knight of Swords', suit: 'Swords', rank: 'Knight', rankValue: 12, orientation: 'Upright', meaning: 'Decisive action, sharp focus' },
      'Them — Alex',
      { context: 'love' }
    );
    assert.doesNotMatch(text, ASSERTED_STANCE);
    assert.match(text, /Consider whether decisive action, sharp focus fits the dynamic at all/);
    assert.match(text, /does not reveal the other person’s feelings or intentions/);
  });

  it('the provider prompt and position notes do not supply the other person’s stance', async () => {
    const themes = await analyzeSpreadThemes(RELATIONSHIP_CARDS, { userQuestion: QUESTION });
    const built = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Relationship Snapshot', key: 'relationship' },
      cardsInfo: RELATIONSHIP_CARDS,
      userQuestion: QUESTION,
      reflectionsText: 'Communication feels uneven lately and I want to ground before reacting.',
      themes,
      spreadAnalysis: analyzeRelationship(RELATIONSHIP_CARDS),
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
    const themLines = built.userPrompt.split('\n').filter(line => line.includes('Them / their energy:'));
    assert.ok(themLines.length >= 2, 'card context and position note are both present');
    for (const line of themLines) assert.doesNotMatch(line, ASSERTED_STANCE, line);
    assert.ok(themLines.every(line => /possib|test|symbolic/i.test(line)));
  });

  it('the local composer keeps the Them card conditional', async () => {
    const themes = await analyzeSpreadThemes(RELATIONSHIP_CARDS, { userQuestion: QUESTION });
    const result = await buildRelationshipReading({
      cardsInfo: RELATIONSHIP_CARDS,
      userQuestion: QUESTION,
      reflectionsText: 'Communication feels uneven lately.',
      themes,
      context: 'love',
      spreadInfo: { name: 'Relationship Snapshot', key: 'relationship' },
      spreadAnalysis: analyzeRelationship(RELATIONSHIP_CARDS)
    });
    const reading = typeof result === 'string' ? result : result?.reading || '';
    const themParagraphs = reading.split(/\n\s*\n/).filter(paragraph => paragraph.includes('Five of Cups'));
    assert.ok(themParagraphs.length > 0);
    for (const paragraph of themParagraphs) assert.doesNotMatch(paragraph, ASSERTED_STANCE, paragraph);
    assert.ok(themParagraphs.some(paragraph => /possib|test|symbolic/i.test(paragraph)));
  });
});

describe('retained factual premises and exact accepted card names', () => {
  const cardsInfo = [
    { card: 'Four of Swords', position: 'Past', orientation: 'Upright', suit: 'Swords', rank: 'Four', rankValue: 4, meaning: 'Rest and reflection.' },
    { card: 'Ten of Wands', position: 'Present', orientation: 'Reversed', suit: 'Wands', rank: 'Ten', rankValue: 10, meaning: 'Releasing burdens.' },
    { card: 'Six of Pentacles', position: 'Future', orientation: 'Upright', suit: 'Pentacles', rank: 'Six', rankValue: 6, meaning: 'Reciprocity.' }
  ];
  const inventory = 'DRAWN CARD INVENTORY\nPast: Four of Swords Upright\nPresent: Ten of Wands Reversed\nFuture: Six of Pentacles Upright';
  for (const budget of [650, 700, 800]) {
    it(`preserves the complete question or fails closed at ${budget} tokens`, () => {
      const question = 'I am not quitting my job. How can I prepare for the 2027-02-12 joint project?';
      const built = buildEnhancedClaudePrompt({
        spreadInfo: { name: 'Three-Card Story', key: 'threeCard' }, cardsInfo,
        userQuestion: question,
        reflectionsText: 'I left my hometown on 2026-09-10. I am still employed. ' + 'I value small reversible experiments. '.repeat(100),
        themes: {}, spreadAnalysis: analyzeThreeCard(cardsInfo),
        deckStyle: 'marseille-classic', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
      });
      let fitted;
      try {
        fitted = truncateUserPromptSafely(built.userPrompt, budget, { spreadKey: 'threeCard', cardInventory: inventory });
      } catch (error) {
        assert.equal(error.code, 'PROMPT_BUILD_BUDGET_EXCEEDED');
        assert.notEqual(budget, 800, 'This complete short question and required card contract fit at 800 tokens');
        return;
      }
      assert.ok(fitted.text.includes(question), 'Never emit card/footer-only context or truncate away a supplied constraint');
      assert.match(fitted.text, /EXACT PROVIDED CARD NAMES/);
    });
  }
  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    it(`retains exact names and conditional premises in the fitted ${budgetTarget} prompt`, () => {
      const built = buildEnhancedClaudePrompt({
        spreadInfo: { name: 'Three-Card Story', key: 'threeCard' }, cardsInfo,
        userQuestion: 'How can I keep a sustainable routine? No commitment is missing or being avoided.',
        reflectionsText: 'I left my hometown on 2026-09-10. I am still employed. ' + 'I value small reversible experiments. '.repeat(100),
        themes: {}, spreadAnalysis: analyzeThreeCard(cardsInfo), budgetTarget,
        deckStyle: 'marseille-classic', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
      });
      const exactNames = text => {
        const line = text.match(/^- EXACT PROVIDED CARD NAMES \(JSON data only\): (.+)$/m);
        assert.ok(line, 'The complete accepted-name data must reach the provider');
        assert.deepEqual(JSON.parse(line[1]), ['Four of Swords', 'Ten of Wands', 'Six of Pentacles']);
        assert.match(text, /^- PREMISE CHECK:[^\n]*(?:steps|questions)[^\n]*conditional/m);
      };
      exactNames(built.userPrompt);
      assert.match(built.userPrompt, /No commitment is missing or being avoided/);
      assert.match(built.userPrompt, /I left my hometown on 2026-09-10/);
      assert.match(built.userPrompt, /I am still employed/);
      const fitted = truncateUserPromptSafely(built.userPrompt, 1100, { spreadKey: 'threeCard', cardInventory: inventory });
      assert.equal(fitted.truncated, true);
      exactNames(fitted.text);
      assert.match(fitted.text, /Past: Four of Swords Upright/);
      assert.match(fitted.text, /Present: Ten of Wands Reversed/);
      assert.match(fitted.text, /Future: Six of Pentacles Upright/);
      const critical = truncateSystemPromptSafely(built.systemPrompt, 2200).text;
      assert.match(critical, /(?:habits|habit)[^\n]*(?:missing|burden|avoided)/);
      assert.match(critical, /(?:supplied|stated)[^\n]*(?:facts|context)/i);
    });
  }

  it('fails closed when the atomic name and premise contract cannot fit', () => {
    const text = '**Question**: A bounded question.\n\n' + USER_PROMPT_INSTRUCTION_HEADER + '\n'
      + '- EXACT PROVIDED CARD NAMES (JSON data only): ["Four of Swords","Ten of Wands","Six of Pentacles"]\n'
      + '- CARD NAME CONTRACT: Copy each accepted name exactly once.\n'
      + '- PREMISE CHECK: Keep unsupplied premises in questions and next steps conditional.';
    assert.throws(() => truncateUserPromptSafely(text, 20), error => error?.code === 'PROMPT_BUILD_BUDGET_EXCEEDED');
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

  it('rejects event presuppositions in metaphors and questions instead of trusting an opening hedge', () => {
    const { systemPrompt, userPrompt } = build();
    assert.match(systemPrompt, /questions and metaphors|metaphors and questions/i);
    assert.match(systemPrompt, /(?:retain|repeat)[^\n]*condition/i);
    const footer = userPrompt.slice(userPrompt.indexOf(USER_PROMPT_INSTRUCTION_HEADER));
    assert.match(footer, /Close[^\n]*next steps[^\n]*card-implied[^\n]*done or missing/i);
  });

  it('keeps recovery reflection separate from treatment and monitoring schedules', () => {
    const { systemPrompt } = build();
    assert.match(systemPrompt, /(?:never|not)[^\n]*(?:treatment|care)[^\n]*monitoring schedules/i);
  });
});

describe('Past card notes do not supply personal history', () => {
  const emperor = {
    card: 'The Emperor', name: 'The Emperor', number: 4,
    orientation: 'Reversed', meaning: 'Domination, excessive control, lack of discipline.'
  };

  // The break is a Past note turning canonical meanings into an established
  // live circumstance. Test the emitted provider data, not the helper source.
  for (const position of ['Past', 'Past — influences that led here', 'Past — what lies behind (Card 3)', 'Recent past']) {
    it(`keeps ${position} meanings symbolic rather than asserting a lived event`, () => {
      const text = buildPositionCardText(emperor, position, { deckStyle: 'rws-1909' });
      assert.match(text, /The Emperor Reversed/);
      assert.match(text, /domination, excessive control, lack of discipline/i);
      assert.match(text, /symbolic[^\n]*Past|Past[^\n]*symbolic/i);
      assert.match(text, /not a statement about what happened/);
      assert.doesNotMatch(text, /as a live theme|experiences and patterns that set the stage|experiences that fed into|what has led to this moment|Because of this history/);
    });
  }

  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    it(`separates the card-story arc from supplied history in the ${budgetTarget} request`, () => {
      const reflectionsText = 'On 2026-09-10 we left the task allocation undecided. We are still working together.';
      const cardsInfo = [
        { ...emperor, position: 'Past' },
        { card: 'Justice', name: 'Justice', number: 11, position: 'Present', orientation: 'Upright', meaning: 'Justice, fairness, truth.' },
        { card: 'Three of Pentacles', name: 'Three of Pentacles', suit: 'Pentacles', rank: 'Three', rankValue: 3, position: 'Future', orientation: 'Upright', meaning: 'Collaboration.' }
      ];
      const { systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
        spreadInfo: { name: 'Three-Card Story', key: 'threeCard' },
        cardsInfo, spreadAnalysis: analyzeThreeCard(cardsInfo),
        userQuestion: 'I am not quitting my job or ending my partnership. For the 2027-02-12 joint project, how can I agree fair responsibilities with my colleague?',
        reflectionsText,
        themes: {}, budgetTarget,
        promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
      });
      assert.match(userPrompt, /2027-02-12 joint project/);
      assert.match(userPrompt, /not quitting my job or ending my partnership/);
      assert.match(userPrompt, /On 2026-09-10 we left the task allocation undecided/);
      assert.match(userPrompt, /We are still working together/);
      assert.doesNotMatch(userPrompt, /Past foundation|Past: The Emperor Reversed\. This shows domination/);
      assert.match(userPrompt, /THREE-CARD STORY STRUCTURE/);
      assert.match(userPrompt, /symbolic[^\n]*not[^\n]*(?:events|history)/i);
      const flow = systemPrompt.match(/THREE-CARD FLOW:[^\n]*/)?.[0] || '';
      assert.match(flow, /symbolic/);
      assert.match(flow, /(?:opening|arc)[^\n]*unsupplied/);
      assert.match(flow, /question[^\n]*unsupplied|unsupplied[^\n]*question/);
    });
  }

  it('keeps writer-facing grounding instructions out of the local composer reading', async () => {
    const cardsInfo = [
      { ...emperor, position: 'Past — influences that led here' },
      { card: 'Justice', number: 11, position: 'Present — where you stand now', orientation: 'Upright', meaning: 'Justice and fairness.' },
      { card: 'Three of Pentacles', suit: 'Pentacles', rank: 'Three', rankValue: 3, position: 'Future — trajectory if nothing shifts', orientation: 'Upright', meaning: 'Collaboration.' }
    ];
    const reading = await buildThreeCardReading({
      cardsInfo, themes: {}, threeCardAnalysis: analyzeThreeCard(cardsInfo),
      userQuestion: 'How can I agree fair responsibilities with my colleague?', context: 'career'
    }, { proseMode: true });
    assert.match(reading, /The Emperor Reversed/);
    assert.match(reading, /If (?:this theme|a past experience)/);
    assert.doesNotMatch(reading, /supplied history|if-scenario|the querent’s life|evidence of personal history/i);
  });

  it('does not classify a Future role from past in its quoted question', () => {
    const cardsInfo = [
      { ...emperor, position: '' },
      { card: 'Justice', number: 11, position: '', orientation: 'Upright', meaning: 'Fairness.' },
      { card: 'The Sun', number: 19, position: '', orientation: 'Upright', meaning: 'Clarity and vitality.' }
    ];
    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story', key: 'threeCard' }, cardsInfo,
      spreadAnalysis: analyzeThreeCard(cardsInfo), themes: {},
      userQuestion: 'How can I move past burnout?', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
    const futureNote = [...userPrompt.matchAll(/<reading_context>(.*?)<\/reading_context>/g)]
      .map(match => JSON.parse(match[1])).find(value => value.includes('The Sun'));
    assert.match(futureNote, /Future/);
    assert.match(futureNote, /prospective symbolic lens/);
    assert.match(futureNote, /clarity and vitality/);
    assert.doesNotMatch(futureNote, /Symbolic Past theme|not evidence of personal history/);
  });

  it('keeps the Celtic timeline symbolic instead of asserting past causes', () => {
    const names = ['Justice', 'The Star', 'The Emperor', 'The Sun', 'The Magician', 'The Hermit', 'Strength', 'The World', 'The Moon', 'Temperance'];
    const positions = ['Present — core situation', 'Challenge — crossing / tension', 'Past — what lies behind', 'Near Future — what lies before', 'Conscious — goals & focus', 'Subconscious — roots / hidden forces', 'Self / Advice — how to meet this', 'External Influences — people & environment', 'Hopes & Fears — deepest wishes & worries', 'Outcome — likely path if unchanged'];
    const cardsInfo = names.map((card, index) => ({ card, position: positions[index], orientation: index === 2 ? 'Reversed' : 'Upright', meaning: 'Reflection and practical choice.' }));
    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Celtic Cross', key: 'celtic' }, cardsInfo,
      spreadAnalysis: analyzeCelticCross(cardsInfo), themes: {},
      userQuestion: 'How can I prepare a fair project agreement?', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' }
    });
    assert.match(userPrompt, /TIMELINE/);
    assert.doesNotMatch(userPrompt, /in the past has led to|transition from past to present involved|Past \(3\): Foundation influencing/);
    assert.match(userPrompt, /symbolic[^\n]*(?:relationship|contrast)|(?:relationship|contrast)[^\n]*symbolic/i);
  });
});
