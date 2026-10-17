#!/usr/bin/env node
/**
 * Writes the small card images phones use in spreads and reading rows.
 *
 * The Rider-Waite-Smith scans are ~825 px wide and ~277 KB each, but spreads
 * show them about 80–110 CSS px wide. `public/images/cards/w360/*.webp` holds a
 * 360 px WebP of each (~55 KB), enough for a 3x phone screen;
 * `getCardThumbnailSrcSet` in src/lib/cardLookup.js offers it through srcset.
 * Also writes `public/images/cards/card-back.jpeg`, the neutral image shown
 * when a card image cannot load (FALLBACK_IMAGE and the service worker).
 *
 * Usage: node scripts/assets/generate-card-thumbnails.mjs [--force]
 * Outputs are committed; rerun after replacing a card scan.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CARDS_DIR = path.join(ROOT, 'public/images/cards');
const THUMB_DIR = path.join(CARDS_DIR, 'w360');
const CARD_BACK_SOURCE = path.join(ROOT, 'public/images/card-back.png');
const CARD_BACK_OUTPUT = path.join(CARDS_DIR, 'card-back.jpeg');
const THUMB_WIDTH = 360;
const force = process.argv.includes('--force');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp is not installed. Run `npm install` first.');
  process.exit(1);
}

async function isFresh(output, source) {
  if (force) return false;
  try {
    const [out, src] = await Promise.all([stat(output), stat(source)]);
    return out.mtimeMs >= src.mtimeMs;
  } catch {
    return false;
  }
}

await mkdir(THUMB_DIR, { recursive: true });
const scans = (await readdir(CARDS_DIR)).filter(name => /^RWS1909_-_.+\.jpe?g$/i.test(name)).sort();
let written = 0;
for (const name of scans) {
  const source = path.join(CARDS_DIR, name);
  const output = path.join(THUMB_DIR, name.replace(/\.jpe?g$/i, '.webp'));
  if (await isFresh(output, source)) continue;
  await sharp(source).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toFile(output);
  written += 1;
}

if (!(await isFresh(CARD_BACK_OUTPUT, CARD_BACK_SOURCE))) {
  await sharp(CARD_BACK_SOURCE).resize({ width: 420 }).flatten({ background: '#f3ead8' }).jpeg({ quality: 80, mozjpeg: true }).toFile(CARD_BACK_OUTPUT);
  written += 1;
}

console.log(`${scans.length} scans checked, ${written} file(s) written.`);
