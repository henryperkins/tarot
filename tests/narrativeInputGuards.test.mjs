import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCelticCrossReading,
  buildDecisionReading,
  buildFiveCardReading,
  buildRelationshipReading,
  buildSingleCardReading,
  buildThreeCardReading
} from '../functions/lib/narrativeBuilder.js';

const baseCard = (card, position) => ({
  card,
  position,
  orientation: 'Upright',
  meaning: 'Meaningful guidance.'
});

const makeCards = (count) =>
  Array.from({ length: count }, (_, index) => baseCard(`Card ${index + 1}`, `Position ${index + 1}`));

describe('spread builder input guards', () => {
  it('single card throws on empty cardsInfo', () => {
    assert.throws(
      () => buildSingleCardReading({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });

  it('single card throws on wrong card count', () => {
    assert.throws(
      () => buildSingleCardReading({ cardsInfo: makeCards(2) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('single card throws on invalid card data', () => {
    assert.throws(
      () => buildSingleCardReading({ cardsInfo: [{ position: 'Single' }] }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });

  it('three card throws on empty cardsInfo', async () => {
    await assert.rejects(
      buildThreeCardReading({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });

  it('three card throws on wrong card count', async () => {
    await assert.rejects(
      buildThreeCardReading({ cardsInfo: makeCards(2) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('three card throws on invalid card data', async () => {
    const cards = makeCards(3);
    cards[1] = { card: 'The Fool' };
    await assert.rejects(
      buildThreeCardReading({ cardsInfo: cards }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });

  it('five card throws on empty cardsInfo', async () => {
    await assert.rejects(
      buildFiveCardReading({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });

  it('five card throws on wrong card count', async () => {
    await assert.rejects(
      buildFiveCardReading({ cardsInfo: makeCards(4) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('five card throws on invalid card data', async () => {
    const cards = makeCards(5);
    cards[2] = { position: 'Hidden Influence' };
    await assert.rejects(
      buildFiveCardReading({ cardsInfo: cards }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });

  it('decision spread throws on empty cardsInfo', async () => {
    await assert.rejects(
      buildDecisionReading({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });

  it('decision spread throws on wrong card count', async () => {
    await assert.rejects(
      buildDecisionReading({ cardsInfo: makeCards(4) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('decision spread throws on invalid card data', async () => {
    const cards = makeCards(5);
    cards[4] = { card: 'The Star' };
    await assert.rejects(
      buildDecisionReading({ cardsInfo: cards }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });

  it('relationship spread throws on empty cardsInfo', async () => {
    await assert.rejects(
      buildRelationshipReading({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });

  it('relationship spread throws on wrong card count', async () => {
    await assert.rejects(
      buildRelationshipReading({ cardsInfo: makeCards(2) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('relationship spread accepts clarifier cards beyond the core three', async () => {
    await assert.doesNotReject(
      buildRelationshipReading({ cardsInfo: makeCards(4) })
    );
  });

  it('relationship spread accepts up to two clarifier cards', async () => {
    await assert.doesNotReject(
      buildRelationshipReading({ cardsInfo: makeCards(5) })
    );
  });

  it('relationship spread rejects more than two clarifier cards', async () => {
    await assert.rejects(
      buildRelationshipReading({ cardsInfo: makeCards(6) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('relationship spread throws on invalid card data', async () => {
    const cards = makeCards(3);
    cards[0] = { position: 'You' };
    await assert.rejects(
      buildRelationshipReading({ cardsInfo: cards }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });

  it('celtic cross throws on empty cardsInfo', async () => {
    await assert.rejects(
      buildCelticCrossReading({ cardsInfo: [] }),
      /NARRATIVE_NO_CARDS/
    );
  });

  it('celtic cross throws on wrong card count', async () => {
    await assert.rejects(
      buildCelticCrossReading({ cardsInfo: makeCards(9) }),
      /NARRATIVE_CARD_COUNT_MISMATCH/
    );
  });

  it('celtic cross throws on invalid card data', async () => {
    const cards = makeCards(10);
    cards[7] = { card: 'The Tower' };
    await assert.rejects(
      buildCelticCrossReading({ cardsInfo: cards }),
      /NARRATIVE_INVALID_CARD_AT_INDEX/
    );
  });
});
