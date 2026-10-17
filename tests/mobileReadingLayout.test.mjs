import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

import { shouldPin } from '../src/hooks/useResponsiveSticky.js';
import { getCardImage, getCardThumbnailSrcSet } from '../src/lib/cardLookup.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

describe('pinned header on phones', () => {
  it('pins a header that leaves most of the screen free', () => {
    assert.equal(shouldPin(185, 664), true); // 390x664 portrait, no keyboard
    assert.equal(shouldPin(185, 839), true);
  });

  it('lets the header scroll away over an open keyboard or in short landscape', () => {
    assert.equal(shouldPin(185, 364), false); // ~300 px keyboard on a 664 px view
    assert.equal(shouldPin(128, 340), false); // 750x340 landscape
    assert.equal(shouldPin(66, 340), true); // the compact reading header still fits
  });
});

describe('card thumbnails', () => {
  it('offers the 360 px WebP beside each Rider-Waite-Smith scan', () => {
    assert.equal(
      getCardThumbnailSrcSet('/images/cards/RWS1909_-_00_Fool.jpeg'),
      '/images/cards/w360/RWS1909_-_00_Fool.webp 360w, /images/cards/RWS1909_-_00_Fool.jpeg 825w'
    );
  });

  it('leaves other decks and unknown paths alone', () => {
    assert.equal(getCardThumbnailSrcSet('/images/cards/thoth/thoth_cups_01.png'), undefined);
    assert.equal(getCardThumbnailSrcSet('/images/cards/marseille/clubs01.jpg'), undefined);
    assert.equal(getCardThumbnailSrcSet(undefined), undefined);
  });

  it('has a thumbnail file for every card and a real fallback image', () => {
    const missing = [...MAJOR_ARCANA, ...MINOR_ARCANA]
      .map(card => getCardThumbnailSrcSet(getCardImage(card)))
      .filter(Boolean)
      .map(srcset => srcset.split(' ')[0])
      .filter(path => !existsSync(new URL(`../public${path}`, import.meta.url)));
    assert.deepEqual(missing, []);
    assert.ok(existsSync(new URL('../public/images/cards/card-back.jpeg', import.meta.url)));
  });
});
