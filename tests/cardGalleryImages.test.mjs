import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import sharp from 'sharp';
import { getAllCards, getCardGallerySrcSet, getCardImage, getCardPreviewImage } from '../src/lib/cardLookup.js';

test('Gallery source sets offer small WebP images without downloading the detail scan', () => {
  const card = getAllCards()[0];
  assert.equal(getCardGallerySrcSet(card.image),
    '/images/cards/w360/RWS1909_-_00_Fool.webp 360w, /images/cards/w720/RWS1909_-_00_Fool.webp 720w');
  assert.equal(getCardPreviewImage(card), '/images/cards/w360/RWS1909_-_00_Fool.webp');
  assert.equal(getCardImage(card), '/images/cards/RWS1909_-_00_Fool.jpeg', 'details still use the original');
});

test('every Gallery card has both renditions at their declared widths', async t => {
  let thumbnailBytes = 0;
  let originalBytes = 0;
  for (const card of getAllCards()) {
    originalBytes += (await stat(new URL(`../public${card.image}`, import.meta.url))).size;
    for (const source of getCardGallerySrcSet(card.image).split(', ')) {
      const [src, descriptor] = source.split(' ');
      const file = new URL(`../public${src}`, import.meta.url);
      await access(file);
      const metadata = await sharp(file.pathname).metadata();
      assert.equal(metadata.width, Number.parseInt(descriptor, 10), `${card.name} ${descriptor}`);
      assert.equal(metadata.format, 'webp');
      if (descriptor === '360w') thumbnailBytes += (await stat(file)).size;
    }
  }
  assert.ok(thumbnailBytes < originalBytes, 'thumbnail deck is smaller than the original scans');
  t.diagnostic(JSON.stringify({ cards: getAllCards().length, thumbnailBytes, originalBytes }));
});

test('Gallery leaves unsupported decks and unknown image paths alone', () => {
  for (const src of [undefined, null, '/images/cards/thoth/thoth_cups_01.png', '/images/cards/marseille/clubs01.jpg', '/images/card-back.png']) {
    assert.equal(getCardGallerySrcSet(src), undefined);
  }
});

test('the immutable offline validation build includes Gallery renditions and deferred Journal modules', async () => {
  const manifest = JSON.parse(await readFile(new URL('../scripts/lib/readingCueValidationSource.json', import.meta.url), 'utf8'));
  const paths = new Set(manifest.paths);
  for (const card of getAllCards()) {
    for (const source of getCardGallerySrcSet(card.image).split(', ')) {
      assert.ok(paths.has(`public${source.split(' ')[0]}`), `${card.name} has an allowlisted Gallery rendition`);
    }
  }
  for (const module of ['DeferredReadingContent', 'JournalMarkdown', 'RestoredReadingGestures', 'SavedVisualRecovery']) {
    assert.ok(paths.has(`src/components/journal/entry-card/${module}.jsx`), `${module} is captured for the offline build`);
  }
});
