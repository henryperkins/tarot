/**
 * Automated Contrast Ratio Checker
 * Validates WCAG AA/AAA compliance for color combinations used in the app
 * using the live values from `src/styles/theme.css`.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHexToken, loadThemeTokenScopes } from '../../scripts/lib/themeTokens.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeCssPath = path.resolve(__dirname, '../../src/styles/theme.css');

const DISPLAY_TOKENS = [
  'color-black',
  'color-charcoal',
  'color-slate-dark',
  'color-gray-light',
  'color-white',
  'color-gold-champagne',
  'color-silver',
  'bg-main',
  'bg-surface',
  'bg-surface-muted',
  'text-main',
  'text-muted',
  'text-accent',
  'text-on-brand',
  'brand-primary',
  'brand-secondary',
  'brand-accent',
  'focus-ring-color'
];

const TEST_CASES = [
  {
    name: 'text-muted on bg-surface',
    fgToken: 'text-muted',
    bgToken: 'bg-surface',
    location: 'theme.css semantic text tokens',
    wcagLevel: 'AA',
    isText: true
  },
  {
    name: 'text-muted on bg-surface-muted',
    fgToken: 'text-muted',
    bgToken: 'bg-surface-muted',
    location: 'theme.css semantic text tokens',
    wcagLevel: 'AA',
    isText: true
  },
  {
    name: 'text-main on bg-main',
    fgToken: 'text-main',
    bgToken: 'bg-main',
    location: 'theme.css base surface tokens',
    wcagLevel: 'AAA',
    isText: true
  },
  {
    name: 'text-accent on bg-surface',
    fgToken: 'text-accent',
    bgToken: 'bg-surface',
    location: 'theme.css brand accent tokens',
    wcagLevel: 'AA',
    isText: true
  },
  {
    name: 'text-muted on bg-surface-muted/60 (ReadingPreparation helper)',
    fgToken: 'text-muted',
    bgToken: 'bg-surface-muted',
    bgOpacity: 0.6,
    opacityBackdropToken: 'bg-main',
    location: 'ReadingPreparation translucent helper surfaces',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  },
  {
    name: 'text-muted on bg-surface-muted/70 (SpreadSelector cards)',
    fgToken: 'text-muted',
    bgToken: 'bg-surface-muted',
    bgOpacity: 0.7,
    opacityBackdropToken: 'bg-main',
    location: 'SpreadSelector translucent card shells',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  },
  {
    name: 'focus-ring-color on bg-main',
    fgToken: 'focus-ring-color',
    bgToken: 'bg-main',
    location: 'Focus treatment tokens',
    wcagLevel: 'AA',
    isText: false
  },
  {
    name: 'text-main on bg-surface/80 (SpreadSelector navigation buttons)',
    fgToken: 'text-main',
    bgToken: 'bg-surface',
    bgOpacity: 0.8,
    opacityBackdropToken: 'bg-main',
    location: 'SpreadSelector navigation arrows',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  },
  {
    name: 'text-muted on bg-surface/88 (SpreadSelector complexity badge)',
    fgToken: 'text-muted',
    bgToken: 'bg-surface',
    bgOpacity: 0.88,
    opacityBackdropToken: 'bg-main',
    location: 'SpreadSelector complexity badges',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  },
  {
    name: 'brand-primary on bg-surface/88 (SpreadSelector complexity stars)',
    fgToken: 'brand-primary',
    bgToken: 'bg-surface',
    bgOpacity: 0.88,
    opacityBackdropToken: 'bg-main',
    location: 'SpreadSelector complexity badges',
    wcagLevel: 'AA',
    isText: false,
    translucent: true
  },
  {
    name: 'brand-accent on bg-surface (buttons)',
    fgToken: 'brand-accent',
    bgToken: 'bg-surface',
    location: 'Primary and outline button surfaces',
    wcagLevel: 'AA',
    isText: true
  },
  {
    name: 'text-main on bg-surface/85 (card revealed content)',
    fgToken: 'text-main',
    bgToken: 'bg-surface',
    bgOpacity: 0.85,
    opacityBackdropToken: 'bg-main',
    location: 'Card revealed overlays',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  }
];

function hexToRgb(hex) {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16)
  };
}

function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(fg, bg) {
  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function applyOpacity(hex, opacity, backdropHex) {
  const { r, g, b } = hexToRgb(hex);
  const { r: bgR, g: bgG, b: bgB } = hexToRgb(backdropHex);

  const nextR = Math.round(r * opacity + bgR * (1 - opacity));
  const nextG = Math.round(g * opacity + bgG * (1 - opacity));
  const nextB = Math.round(b * opacity + bgB * (1 - opacity));

  return `#${nextR.toString(16).padStart(2, '0')}${nextG.toString(16).padStart(2, '0')}${nextB.toString(16).padStart(2, '0')}`.toUpperCase();
}

function checkWCAG(ratio, isText, level = 'AA') {
  if (isText) {
    return level === 'AAA' ? ratio >= 7.0 : ratio >= 4.5;
  }
  return ratio >= 3.0;
}

function formatRatio(ratio) {
  return `${ratio.toFixed(2)}:1`;
}

function buildPalette(scope) {
  return Object.fromEntries(
    DISPLAY_TOKENS.map((tokenName) => [tokenName, getHexToken(scope, tokenName)])
  );
}

function resolveTokenColor(colors, tokenName) {
  if (!(tokenName in colors)) {
    throw new Error(`Missing color token '${tokenName}' in the loaded theme palette.`);
  }
  return colors[tokenName];
}

function evaluateCase(colors, testCase) {
  const opacityBackdrop = resolveTokenColor(
    colors,
    testCase.opacityBackdropToken || 'bg-main'
  );
  let fg = resolveTokenColor(colors, testCase.fgToken);
  let bg = resolveTokenColor(colors, testCase.bgToken);

  if (typeof testCase.fgOpacity === 'number') {
    fg = applyOpacity(fg, testCase.fgOpacity, opacityBackdrop);
  }
  if (typeof testCase.bgOpacity === 'number') {
    bg = applyOpacity(bg, testCase.bgOpacity, opacityBackdrop);
  }

  return { fg, bg };
}

const themeScopes = await loadThemeTokenScopes(themeCssPath);
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║          Tableu Tarot - Contrast Ratio Analysis Report            ║');
console.log('║                    WCAG 2.1 AA/AAA Compliance                      ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

for (const [modeName, scope] of Object.entries(themeScopes)) {
  const colors = buildPalette(scope);

  console.log(`${modeName.toUpperCase()} token palette (from src/styles/theme.css):`);
  console.log('─────────────');
  Object.entries(colors).forEach(([tokenName, hex]) => {
    console.log(`  ${tokenName.padEnd(25)} ${hex}`);
  });
  console.log('\n');

  console.log(`${modeName.toUpperCase()} contrast test results:`);
  console.log('═════════════════════════════════════════════════════════════════════\n');

  TEST_CASES.forEach((testCase, index) => {
    totalTests += 1;
    const { fg, bg } = evaluateCase(colors, testCase);
    const ratio = getContrastRatio(fg, bg);
    const passed = checkWCAG(ratio, testCase.isText, testCase.wcagLevel);

    if (passed) {
      passedTests += 1;
    } else {
      failedTests += 1;
      failures.push({ ...testCase, modeName, ratio, fg, bg });
    }

    const statusIcon = passed ? '✅' : '❌';
    const statusLabel = passed ? 'PASS' : 'FAIL';
    const typeLabel = testCase.isText ? 'Text' : 'UI';
    const translucentFlag = testCase.translucent ? ' [TRANSLUCENT]' : '';

    console.log(`${index + 1}. ${testCase.name}${translucentFlag}`);
    console.log(`   ${statusIcon} ${statusLabel} - ${formatRatio(ratio)} (${typeLabel}, WCAG ${testCase.wcagLevel}, ${modeName})`);
    console.log(`   Location: ${testCase.location}`);
    console.log(`   FG: ${fg} | BG: ${bg}`);

    if (!passed) {
      const required = testCase.isText ? (testCase.wcagLevel === 'AAA' ? 7.0 : 4.5) : 3.0;
      const deficit = (required - ratio).toFixed(2);
      console.log(`   ⚠️  Falls short by ${deficit} (needs ${required}:1)`);
    }
    console.log('');
  });
}

console.log('═════════════════════════════════════════════════════════════════════\n');
console.log('Summary:');
console.log('─────────');
console.log(`  Total Tests:   ${totalTests}`);
console.log(`  ✅ Passed:     ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log(`  ❌ Failed:     ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
console.log('');

if (failures.length > 0) {
  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('FAILED TESTS - Requires Attention:');
  console.log('═════════════════════════════════════════════════════════════════════\n');

  failures.forEach((testCase, index) => {
    const required = testCase.isText ? (testCase.wcagLevel === 'AAA' ? 7.0 : 4.5) : 3.0;
    console.log(`${index + 1}. ${testCase.name} (${testCase.modeName})`);
    console.log(`   Current:  ${formatRatio(testCase.ratio)}`);
    console.log(`   Required: ${required}:1 (WCAG ${testCase.wcagLevel})`);
    console.log(`   Location: ${testCase.location}`);
    console.log(`   Type:     ${testCase.isText ? 'Text' : 'UI Component/Border'}`);
    console.log('');
  });
}

console.log('═════════════════════════════════════════════════════════════════════');
console.log('Recommendations:');
console.log('═════════════════════════════════════════════════════════════════════\n');

console.log('1. ✅ Palette comes from the live theme tokens');
console.log('   - This script now reads both dark and light values directly from `src/styles/theme.css`');
console.log('   - Token drift now changes the report immediately instead of waiting for manual updates\n');

console.log('2. ⚠️  Translucent surfaces need validation');
console.log('   - Use browser DevTools or axe to measure actual rendered contrast');
console.log('   - Opacity calculations are simplified; real-world may differ\n');

console.log('3. 🔧 For any failures:');
console.log('   - Increase opacity of translucent backgrounds (60% → 80%+)');
console.log('   - Use opaque backgrounds where possible');
console.log('   - Lighten foreground colors or darken backgrounds\n');

console.log('4. 📋 Next Steps:');
console.log('   - Run `npm run dev` and test with axe DevTools browser extension');
console.log('   - Check actual rendered contrast on problematic components');
console.log('   - Validate focus rings with keyboard navigation');
console.log('   - Test both light and dark themes on real devices at various brightness levels\n');

console.log('═════════════════════════════════════════════════════════════════════\n');

process.exit(failedTests > 0 ? 1 : 0);
