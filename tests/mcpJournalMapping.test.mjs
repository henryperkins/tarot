import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildJournalEntryFromJob,
  buildJournalEntryFromPayload,
  JournalMappingError,
  toPublicCard
} from '../functions/lib/mcp/journalMapping.js';
import { FALLBACK_IMAGE, getCardImage } from '../src/lib/cardLookup.js';

const SPREAD = { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard' };

function job(overrides = {}, snapshotOverrides = {}) {
  return {
    jobId: 'job-1',
    status: 'complete',
    snapshot: {
      spreadInfo: SPREAD,
      cardsInfo: [
        { position: 'Past', card: 'The Hermit', orientation: 'Upright', meaning: 'Solitude', number: 9, suit: null, rank: null, rankValue: null },
        { position: 'Present', card: 'Three of Cups', orientation: 'reversed', meaning: 'Excess', number: null, suit: 'Cups', rank: 'Three', rankValue: 3 },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'Hope', number: 17, suit: null, rank: null, rankValue: null }
      ],
      userQuestion: 'What should I focus on?',
      deckStyle: 'rws-1909',
      personalization: { readingTone: 'gentle' },
      seed: '4242',
      ...snapshotOverrides
    },
    result: {
      reading: '  The Hermit asks for patience.\r\n\r\nThen hope.  ',
      provider: 'openai-native',
      requestId: 'req-1',
      gateBlocked: false,
      gateReason: null
    },
    error: null,
    meta: { themes: { dominantSuit: 'Cups' } },
    ...overrides
  };
}

const EXPECTED_CARDS = [
  { position: 'Past', name: 'The Hermit', orientation: 'Upright', number: 9 },
  { position: 'Present', name: 'Three of Cups', orientation: 'Reversed', suit: 'Cups', rank: 'Three', rankValue: 3 },
  { position: 'Future', name: 'The Star', orientation: 'Upright', number: 17 }
];

const PAYLOAD = {
  spread: SPREAD.name,
  spreadKey: 'threeCard',
  cards: [
    { position: 'Past', name: 'The Hermit', orientation: 'Upright', number: 9 },
    { position: 'Present', name: 'Three of Cups', orientation: 'Reversed', suit: 'Cups', rank: 'Three', rankValue: 3 },
    { position: 'Future', name: 'The Star', orientation: 'Upright', number: 17 }
  ],
  personalReading: 'The Hermit asks for patience.',
  requestId: 'req-1',
  deckId: 'rws-1909'
};

describe('buildJournalEntryFromJob', () => {
  it('maps every row of the audited field table', () => {
    const entry = buildJournalEntryFromJob(job(), { context: 'career' });
    assert.deepEqual(entry, {
      spread: SPREAD.name,
      spreadKey: 'threeCard',
      question: 'What should I focus on?',
      cards: EXPECTED_CARDS,
      personalReading: '  The Hermit asks for patience.\r\n\r\nThen hope.  ',
      themes: { dominantSuit: 'Cups' },
      context: 'career',
      provider: 'openai-native',
      sessionSeed: '4242',
      requestId: 'req-1',
      deckId: 'rws-1909',
      userPreferences: { readingTone: 'gentle' }
    });
  });

  it('takes context only from the tool input, never from the reading', () => {
    const withReadingContext = job({ meta: { themes: null, context: { primary: 'love', secret: 'x' } } });
    assert.equal(buildJournalEntryFromJob(withReadingContext).context, null);
  });

  it('stores Thoth deck labels under their canonical names', () => {
    const thoth = job({}, {
      deckStyle: 'thoth-a1',
      cardsInfo: [
        { position: 'Past', card: 'Prince of Wands', orientation: 'Upright', meaning: 'x' },
        { position: 'Present', card: 'Knight of Wands', orientation: 'Upright', meaning: 'y' },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'z' }
      ]
    });
    const { cards, deckId } = buildJournalEntryFromJob(thoth);

    assert.equal(deckId, 'thoth-a1');
    assert.deepEqual(cards.slice(0, 2), [
      { position: 'Past', name: 'Knight of Wands', displayName: 'Prince of Wands', orientation: 'Upright', suit: 'Wands', rank: 'Knight', rankValue: 12 },
      { position: 'Present', name: 'King of Wands', displayName: 'Knight of Wands', orientation: 'Upright', suit: 'Wands', rank: 'King', rankValue: 14 }
    ]);
    for (const card of cards) {
      assert.notEqual(getCardImage(card), FALLBACK_IMAGE, `${card.name} must resolve to a real card image`);
    }
    assert.equal(getCardImage({ name: 'Prince of Wands' }), FALLBACK_IMAGE, 'a stored deck label would show the card back');
  });

  it('stores Marseille labels, including the "(RWS: …)" form, canonically', () => {
    const marseille = job({}, {
      deckStyle: 'marseille-classic',
      cardsInfo: [
        { position: 'Past', card: 'Le Bateleur (RWS: The Magician)', orientation: 'Upright', meaning: 'x' },
        { position: 'Present', card: 'Chevalier of Batons (RWS: Knight of Wands)', orientation: 'Reversed', meaning: 'y' },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'z' }
      ]
    });
    const names = buildJournalEntryFromJob(marseille).cards.map((card) => card.name);
    assert.deepEqual(names.slice(0, 2), ['The Magician', 'Knight of Wands']);
  });

  it('refuses unfinished jobs, safety responses, and readings without identity', () => {
    const cases = [
      [job({ status: 'running' }), /not finished/],
      [job({ result: { reading: 'Please reach out…', provider: 'safety-gate', requestId: 'req-1', gateReason: 'crisis_gate' } }), /safety message/],
      [job({ result: { reading: 'Text', provider: 'x', requestId: null } }), /request ID/],
      [job({}, { spreadInfo: { name: 'Mine', key: 'custom' } }), /spread key/],
      [job({ snapshot: null }), /no saved reading details/]
    ];
    for (const [input, message] of cases) {
      assert.throws(() => buildJournalEntryFromJob(input), (error) => error instanceof JournalMappingError && message.test(error.message));
    }
  });

  it('refuses a label the deck does not know, naming its index', () => {
    const unknown = job({}, { cardsInfo: [{ position: 'Past', card: 'The Unicorn', orientation: 'Upright', meaning: 'x' }] });
    assert.throws(() => buildJournalEntryFromJob(unknown), (error) => error instanceof JournalMappingError && /cardsInfo\[0\]/.test(error.message));
  });
});

describe('buildJournalEntryFromPayload', () => {
  it('maps a payload save to the same canonical entry as the job would', () => {
    const entry = buildJournalEntryFromPayload(PAYLOAD);
    assert.deepEqual(entry.cards, EXPECTED_CARDS);
    assert.equal(entry.requestId, 'req-1');
    assert.equal(entry.sessionSeed, null);
    assert.equal(entry.context, null);
    assert.equal(entry.personalReading, PAYLOAD.personalReading);
  });

  it('requires identity metadata for every card', () => {
    const missing = { ...PAYLOAD, cards: [{ position: 'Past', name: 'The Hermit', orientation: 'Upright' }] };
    assert.throws(() => buildJournalEntryFromPayload(missing), /needs its number/);
    const minor = { ...PAYLOAD, cards: [{ position: 'Past', name: 'Three of Cups', orientation: 'Upright', suit: 'Cups' }] };
    assert.throws(() => buildJournalEntryFromPayload(minor), /needs its suit and rankValue/);
  });

  it('refuses a canonical name sent for a non-RWS deck', () => {
    const confused = {
      ...PAYLOAD,
      deckId: 'thoth-a1',
      cards: [{ position: 'Past', name: 'Knight of Wands', orientation: 'Upright', suit: 'Wands', rankValue: 12 }]
    };
    assert.throws(() => buildJournalEntryFromPayload(confused), /King of Wands/);
  });

  it('accepts the Thoth label with its catalog metadata', () => {
    const thoth = {
      ...PAYLOAD,
      deckId: 'thoth-a1',
      cards: [{ position: 'Past', name: 'Prince of Wands', orientation: 'upright', suit: 'Wands', rankValue: 12 }]
    };
    assert.deepEqual(buildJournalEntryFromPayload(thoth).cards, [
      { position: 'Past', name: 'Knight of Wands', displayName: 'Prince of Wands', orientation: 'Upright', suit: 'Wands', rank: 'Knight', rankValue: 12 }
    ]);
  });

  it('requires the narrative, the request ID and a known spread key', () => {
    assert.throws(() => buildJournalEntryFromPayload({ ...PAYLOAD, personalReading: '' }), /personalReading is required/);
    assert.throws(() => buildJournalEntryFromPayload({ ...PAYLOAD, requestId: undefined }), /requestId is required/);
    assert.throws(() => buildJournalEntryFromPayload({ ...PAYLOAD, spreadKey: 'three-card' }), /spreadKey must be one of/);
  });
});

describe('toPublicCard', () => {
  it('exposes the deck label with catalog metadata and nothing canonical-only', () => {
    const drawn = {
      position: 'Past', card: 'Prince of Wands', canonicalName: 'Knight of Wands', canonicalKey: 'knight of wands',
      aliases: ['Knight of Wands'], orientation: 'Upright', meaning: 'Momentum', number: null,
      suit: 'Wands', rank: 'Knight', rankValue: 12, userReflection: null
    };
    assert.deepEqual(toPublicCard(drawn), {
      position: 'Past', card: 'Prince of Wands', orientation: 'Upright', meaning: 'Momentum',
      number: null, suit: 'Wands', rank: 'Knight', rankValue: 12
    });
  });
});
