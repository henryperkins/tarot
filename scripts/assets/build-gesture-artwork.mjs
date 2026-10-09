import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Lossy delivery copies only: original vector source and authored overlay
// coordinates stay untouched. The width accommodates the study's largest crop
// at 3x device density without sending megabytes of SVG path data per card.
const root = new URL('../../', import.meta.url);
const sourceRoot = new URL('output/reading-motion/assets/rws-immanuelle/', root);
const outputRoot = new URL('public/images/cards/rws-vector/', root);
const original = JSON.parse(await readFile(new URL('manifest.json', sourceRoot), 'utf8'));
const settings = { width: 1086, format: 'webp', quality: 88, effort: 6 };
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
await mkdir(outputRoot, { recursive: true });
const cards = [];
// Keep rasterization bounded to one source at a time; source SVGs are complex.
for (const source of original.cards.filter(card => card.id !== 'back')) {
  const bytes = await readFile(new URL(source.filename, sourceRoot));
  if (sha256(bytes) !== source.sha256) throw new Error(`Source hash changed: ${source.filename}`);
  const { data, info } = await sharp(bytes).resize({ width: settings.width }).webp({ quality: settings.quality, effort: settings.effort }).toBuffer({ resolveWithObject: true });
  const filename = source.filename.replace(/\.svg$/, '.webp');
  await writeFile(new URL(filename, outputRoot), data);
  cards.push({ name: source.name, filename, width: info.width, height: info.height, bytes: info.size,
    sha256: sha256(data), sourceFilename: source.filename, sourceBytes: bytes.length,
    sourceSha256: source.sha256, sourceUrl: source.description_url,
    artist: source.artist, vectorizationCredit: source.vectorization_credit,
    license: source.license, licenseUrl: source.license_url });
}
const manifest = { schemaVersion: 1, edition: 'rws-immanuelle-vector', renderer: `sharp ${sharp.versions.sharp}; librsvg ${sharp.versions.rsvg}`,
  settings, sourceManifest: 'output/reading-motion/assets/rws-immanuelle/manifest.json',
  totalSourceBytes: cards.reduce((sum, card) => sum + card.sourceBytes, 0),
  totalBytes: cards.reduce((sum, card) => sum + card.bytes, 0), cards };
await writeFile(new URL('manifest.json', outputRoot), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ cards: cards.length, sourceBytes: manifest.totalSourceBytes, deliveryBytes: manifest.totalBytes, settings }));
