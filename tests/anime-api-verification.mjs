/**
 * Anime.js v4 API Verification Script
 *
 * Run with: node tests/anime-api-verification.mjs
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

console.log('========================================');
console.log('Anime.js v4 API Verification');
console.log('========================================\n');

let animeModule;

try {
  animeModule = await import('animejs');
  const exports = Object.keys(animeModule).sort();

  console.log('✓ ES module import successful');
  console.log(`Export count: ${exports.length}\n`);

  const expected = [
    'animate',
    'createTimeline',
    'stagger',
    'set',
    'splitText',
    'createScope',
    'spring',
    'waapi',
    'utils',
    'engine'
  ];

  console.log('=== Required v4 exports ===\n');
  expected.forEach((name) => {
    const exists = name in animeModule;
    const type = exists ? typeof animeModule[name] : 'missing';
    console.log(`${exists ? '✓' : '✗'} ${name} (${type})`);
  });

  console.log('\n=== Legacy API checks (should be absent) ===\n');
  const legacy = ['timeline', 'easing'];
  legacy.forEach((name) => {
    const exists = name in animeModule;
    console.log(`${exists ? '⚠' : '✓'} ${name} ${exists ? 'present (legacy alias?)' : 'not present'}`);
  });

  console.log('\n=== Runtime helper checks ===\n');

  if (typeof animeModule.stagger === 'function') {
    const staggerValue = animeModule.stagger(100, { from: 'center' });
    console.log(`✓ stagger(100, { from: 'center' }) => ${typeof staggerValue}`);
  }

  if (typeof animeModule.spring === 'function') {
    const springEase = animeModule.spring({ stiffness: 120, damping: 12, mass: 1 });
    console.log(`✓ spring(...) => ${typeof springEase}`);
  }

  if (animeModule.utils) {
    const utilChecks = ['random', 'round', 'clamp', 'mapRange', 'snap'];
    utilChecks.forEach((fn) => {
      console.log(`${fn in animeModule.utils ? '✓' : '✗'} utils.${fn}`);
    });
  }

  if (animeModule.waapi) {
    console.log(`✓ waapi exports: ${Object.keys(animeModule.waapi).join(', ')}`);
  }

  console.log('\n========================================');
  console.log('Migration Reference');
  console.log('========================================\n');

  console.log('Use named imports:');
  console.log("  import { animate, createTimeline, stagger, splitText, waapi } from 'animejs';");

  console.log('\nUse v4 parameter names:');
  console.log("  ease (not easing), loopDelay (not endDelay), reversed/alternate (not direction)\n");

  console.log('Completion style (v4):');
  console.log('  const anim = animate(target, params);');
  console.log('  await anim;');
  console.log('  // or: anim.then(() => { ... })\n');

} catch (error) {
  console.error('Failed to import animejs:', error.message);
  console.log('\nMake sure animejs is installed: npm install animejs');

  try {
    const pkg = require('animejs/package.json');
    console.log(`\nInstalled version: ${pkg.version}`);
  } catch {
    console.log('\nCould not read animejs package metadata');
  }

  process.exitCode = 1;
}

console.log('Browser verification page: tests/anime-v4-api-test.html\n');
