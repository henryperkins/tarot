/**
 * Anime.js V4 API Verification Script
 *
 * Run with: node tests/anime-api-verification.mjs
 *
 * This script verifies the actual exports and API shape of Anime.js
 * to ensure our migration code uses the correct syntax.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

console.log('========================================');
console.log('Anime.js API Verification');
console.log('========================================\n');

// Try to import anime.js
let anime;
let animeModule;

try {
  // Try ES module import first
  animeModule = await import('animejs');
  console.log('✓ ES Module import successful\n');
  console.log('Exported keys:', Object.keys(animeModule));
  console.log('');

  // Check what's exported
  const exports = Object.keys(animeModule);

  console.log('=== Export Analysis ===\n');

  // Check for named exports we expect
  const expectedExports = [
    'animate',
    'timeline',
    'stagger',
    'utils',
    'spring',
    'easing',
    'default'
  ];

  expectedExports.forEach(name => {
    const exists = name in animeModule;
    const type = exists ? typeof animeModule[name] : 'N/A';
    console.log(`${exists ? '✓' : '✗'} ${name}: ${type}`);
  });

  console.log('\n=== Detailed Export Inspection ===\n');

  // Inspect each export
  for (const [key, value] of Object.entries(animeModule)) {
    console.log(`--- ${key} ---`);
    console.log(`Type: ${typeof value}`);

    if (typeof value === 'function') {
      console.log(`Function name: ${value.name || '(anonymous)'}`);
      console.log(`Parameters: ${value.length}`);

      // Check for sub-properties (like anime.stagger)
      const subProps = Object.keys(value);
      if (subProps.length > 0) {
        console.log(`Sub-properties: ${subProps.join(', ')}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      console.log(`Object keys: ${Object.keys(value).join(', ')}`);
    }
    console.log('');
  }

  // Check default export
  if (animeModule.default) {
    console.log('=== Default Export Analysis ===\n');
    const defaultExport = animeModule.default;
    console.log(`Type: ${typeof defaultExport}`);

    if (typeof defaultExport === 'function') {
      const props = Object.keys(defaultExport);
      console.log(`Static properties: ${props.join(', ') || 'none'}`);

      // Check for common methods
      const methods = ['stagger', 'set', 'timeline', 'random', 'version'];
      methods.forEach(m => {
        const exists = m in defaultExport;
        console.log(`  ${exists ? '✓' : '✗'} .${m}: ${exists ? typeof defaultExport[m] : 'missing'}`);
      });
    }
  }

  // Test actual API calls (in Node without DOM)
  console.log('\n=== API Call Tests (Node.js) ===\n');

  // Test stagger function
  if (typeof animeModule.stagger === 'function') {
    try {
      const staggerResult = animeModule.stagger(100);
      console.log('✓ stagger(100) returns:', typeof staggerResult);
    } catch (e) {
      console.log('✗ stagger() error:', e.message);
    }

    try {
      const staggerFromCenter = animeModule.stagger(100, { from: 'center' });
      console.log('✓ stagger(100, { from: "center" }) returns:', typeof staggerFromCenter);
    } catch (e) {
      console.log('✗ stagger with options error:', e.message);
    }
  }

  // Check for utils
  const utils = animeModule.utils || animeModule.default?.utils;
  if (utils) {
    console.log('\n--- utils object ---');
    console.log('utils keys:', Object.keys(utils).join(', '));

    // Check for specific utils
    ['splitText', 'get', 'set', 'random', 'round', 'clamp'].forEach(fn => {
      console.log(`  ${fn in utils ? '✓' : '✗'} utils.${fn}`);
    });
  } else {
    console.log('✗ utils not found as named export or on default');
  }

  // Check timeline
  const timelineFn = animeModule.timeline || animeModule.createTimeline;
  if (timelineFn) {
    console.log('\n--- timeline function ---');
    console.log('✓ timeline available');
    try {
      // Can't fully test without DOM, but check it's callable
      console.log('  Type:', typeof timelineFn);
    } catch (e) {
      console.log('  Note: Full test requires DOM');
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('MIGRATION NOTES');
  console.log('========================================\n');

  // Determine the correct import style
  if (animeModule.animate) {
    console.log('Use named imports:');
    console.log("  import { animate, stagger, timeline, utils } from 'animejs';");
  } else if (animeModule.default) {
    console.log('Use default import:');
    console.log("  import anime from 'animejs';");
    console.log('  // Then use: anime(), anime.stagger(), anime.timeline(), etc.');
  }

  // Check easing string format
  console.log('\nEasing: Use string format like "easeOutQuad" or "spring(1,100,10,0)"');

  // Promise API
  console.log('\nPromise: Use animation.finished (not .promise)');

} catch (e) {
  console.error('Failed to import animejs:', e.message);
  console.log('\nMake sure animejs is installed: npm install animejs');

  // Try to check package.json for version info
  try {
    const pkg = require('animejs/package.json');
    console.log('\nInstalled version:', pkg.version);
    console.log('Main entry:', pkg.main);
    console.log('Module entry:', pkg.module);
  } catch {
    console.log('\nCould not read animejs package.json');
  }
}

console.log('\n========================================');
console.log('Browser Test');
console.log('========================================');
console.log('\nOpen tests/anime-api-verification.html in a browser');
console.log('to run interactive visual tests.\n');
