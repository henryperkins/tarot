import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const sourceRoot = new URL('../output/reading-motion/assets/rws-immanuelle/', import.meta.url);
const deliveryRoot = new URL('../public/images/cards/rws-vector/', import.meta.url);

test('all 78 delivery faces retain source identity, attribution, pixels and bounded download size', async () => {
  const originals = JSON.parse(await readFile(new URL('manifest.json', sourceRoot), 'utf8')).cards;
  const manifest = JSON.parse(await readFile(new URL('manifest.json', deliveryRoot), 'utf8'));
  assert.equal(manifest.edition, 'rws-immanuelle-vector');
  assert.equal(manifest.cards.length, 78);
  assert.equal(new Set(manifest.cards.map(card => card.filename)).size, 78);
  let delivered = 0;
  for (const card of manifest.cards) {
    const source = originals.find(original => original.filename === card.sourceFilename);
    assert.ok(source);
    assert.equal(card.name, source.name);
    assert.equal(card.sourceSha256, source.sha256);
    assert.equal(card.sourceBytes, source.bytes);
    assert.equal(card.artist, source.artist);
    assert.equal(card.vectorizationCredit, source.vectorization_credit);
    assert.equal(card.license, source.license);
    assert.equal(card.sourceUrl, source.description_url);
    const bytes = await readFile(new URL(card.filename, deliveryRoot));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), card.sha256);
    assert.equal(bytes.length, card.bytes);
    const image = await sharp(bytes).metadata();
    assert.equal(image.format, 'webp');
    assert.equal(image.width, 1086);
    assert.equal(image.height, card.height);
    assert.ok(Math.abs(image.width / image.height - source.width / source.height) < .002);
    assert.ok(card.bytes < source.bytes / 4);
    delivered += card.bytes;
  }
  assert.equal(delivered, manifest.totalBytes);
  assert.ok(manifest.totalBytes < manifest.totalSourceBytes / 8);
});
