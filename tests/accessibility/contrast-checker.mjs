/**
 * Automated Contrast Ratio Checker
 * Validates WCAG AA/AAA compliance for color combinations used in the app
 */

// Color utilities
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
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
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

function applyOpacity(hex, opacity) {
  const { r, g, b } = hexToRgb(hex);
  // Simplified opacity calculation (assumes blending with black background)
  const bgHex = '#0F0E13'; // --bg-main
  const { r: bgR, g: bgG, b: bgB } = hexToRgb(bgHex);
  
  const newR = Math.round(r * opacity + bgR * (1 - opacity));
  const newG = Math.round(g * opacity + bgG * (1 - opacity));
  const newB = Math.round(b * opacity + bgB * (1 - opacity));
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Color palette from theme.css
const colors = {
  // Base colors
  'color-black': '#0F0E13',
  'color-charcoal': '#1C1A22',
  'color-slate-dark': '#2A2730',
  'color-gray-light': '#9B9388',
  'color-white': '#E8E6E3',
  'color-gold-champagne': '#D4B896',
  'color-silver': '#A8A39E',
  
  // Semantic tokens
  'bg-main': '#0F0E13',
  'bg-surface': '#1C1A22',
  'bg-surface-muted': '#2A2730',
  'text-main': '#E8E6E3',
  'text-muted': '#B5AFA4', // Updated value from report
  'text-accent': '#D4B896',
  'brand-primary': '#D4B896',
  'brand-secondary': '#A89D92',
  'brand-accent': '#E8DAC3',
  'focus-ring-color': '#E8DAC3'
};

// Test cases from the codebase
const testCases = [
  // Base tokens (opaque surfaces)
  {
    name: 'text-muted on bg-surface (opaque)',
    fg: colors['text-muted'],
    bg: colors['bg-surface'],
    location: 'theme.css:52, various components',
    wcagLevel: 'AA',
    isText: true
  },
  {
    name: 'text-muted on bg-surface-muted (opaque)',
    fg: colors['text-muted'],
    bg: colors['bg-surface-muted'],
    location: 'theme.css:52',
    wcagLevel: 'AA',
    isText: true
  },
  {
    name: 'text-main on bg-main',
    fg: colors['text-main'],
    bg: colors['bg-main'],
    location: 'theme.css:50',
    wcagLevel: 'AAA',
    isText: true
  },
  {
    name: 'text-accent on bg-surface',
    fg: colors['text-accent'],
    bg: colors['bg-surface'],
    location: 'theme.css:54',
    wcagLevel: 'AA',
    isText: true
  },
  
  // Translucent surfaces (problematic areas from report)
  {
    name: 'text-muted on bg-surface-muted/60 (ReadingPreparation helper)',
    fg: colors['text-muted'],
    bg: applyOpacity(colors['bg-surface-muted'], 0.60),
    location: 'ReadingPreparation.jsx:104',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  },
  {
    name: 'text-muted on bg-surface-muted/70 (SpreadSelector cards)',
    fg: colors['text-muted'],
    bg: applyOpacity(colors['bg-surface-muted'], 0.70),
    location: 'SpreadSelector.jsx:146',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  },
  
  // Focus rings and borders (3:1 for non-text)
  {
    name: 'focus-ring-color on bg-main',
    fg: colors['focus-ring-color'],
    bg: colors['bg-main'],
    location: 'tarot.css:331, theme.css:70',
    wcagLevel: 'AA',
    isText: false
  },
  {
    name: 'border-secondary/75 on bg-surface-muted',
    fg: applyOpacity(colors['brand-secondary'], 0.75),
    bg: colors['bg-surface-muted'],
    location: 'SpreadSelector.jsx navigation arrows (hover state)',
    wcagLevel: 'AA',
    isText: false
  },
  {
    name: 'border-primary/60 on bg-primary/15 (complexity badge)',
    fg: applyOpacity(colors['brand-primary'], 0.60),
    bg: applyOpacity(colors['brand-primary'], 0.15),
    location: 'SpreadSelector.jsx:19 getComplexity',
    wcagLevel: 'AA',
    isText: false
  },
  
  // Button states
  {
    name: 'brand-accent on bg-surface (buttons)',
    fg: colors['brand-accent'],
    bg: colors['bg-surface'],
    location: 'GlobalNav, buttons',
    wcagLevel: 'AA',
    isText: true
  },
  
  // Card elements
  {
    name: 'text-main on bg-surface/85 (card revealed content)',
    fg: colors['text-main'],
    bg: applyOpacity(colors['bg-surface'], 0.85),
    location: 'Card.jsx:301',
    wcagLevel: 'AA',
    isText: true,
    translucent: true
  }
];

function checkWCAG(ratio, isText, level = 'AA') {
  if (isText) {
    // Text contrast requirements
    if (level === 'AAA') {
      return ratio >= 7.0 ? 'PASS' : 'FAIL';
    }
    return ratio >= 4.5 ? 'PASS' : 'FAIL';
  } else {
    // Non-text (UI components, borders, etc.)
    return ratio >= 3.0 ? 'PASS' : 'FAIL';
  }
}

function formatRatio(ratio) {
  return `${ratio.toFixed(2)}:1`;
}

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║          Tableu Tarot - Contrast Ratio Analysis Report            ║');
console.log('║                    WCAG 2.1 AA/AAA Compliance                      ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log('Color Palette:');
console.log('─────────────');
Object.entries(colors).forEach(([name, hex]) => {
  console.log(`  ${name.padEnd(25)} ${hex}`);
});
console.log('\n');

console.log('Contrast Test Results:');
console.log('═════════════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

testCases.forEach((test, index) => {
  totalTests++;
  const ratio = getContrastRatio(test.fg, test.bg);
  const status = checkWCAG(ratio, test.isText, test.wcagLevel);
  const passed = status === 'PASS';
  
  if (passed) {
    passedTests++;
  } else {
    failedTests++;
    failures.push({ ...test, ratio });
  }
  
  const statusIcon = passed ? '✅' : '❌';
  const typeLabel = test.isText ? 'Text' : 'UI';
  const translucentFlag = test.translucent ? ' [TRANSLUCENT]' : '';
  
  console.log(`${index + 1}. ${test.name}${translucentFlag}`);
  console.log(`   ${statusIcon} ${status} - ${formatRatio(ratio)} (${typeLabel}, WCAG ${test.wcagLevel})`);
  console.log(`   Location: ${test.location}`);
  console.log(`   FG: ${test.fg} | BG: ${test.bg}`);
  
  if (!passed) {
    const required = test.isText ? (test.wcagLevel === 'AAA' ? 7.0 : 4.5) : 3.0;
    const deficit = (required - ratio).toFixed(2);
    console.log(`   ⚠️  Falls short by ${deficit} (needs ${required}:1)`);
  }
  console.log('');
});

console.log('═════════════════════════════════════════════════════════════════════\n');
console.log('Summary:');
console.log('─────────');
console.log(`  Total Tests:   ${totalTests}`);
console.log(`  ✅ Passed:     ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
console.log(`  ❌ Failed:     ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
console.log('');

if (failures.length > 0) {
  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('FAILED TESTS - Requires Attention:');
  console.log('═════════════════════════════════════════════════════════════════════\n');
  
  failures.forEach((test, index) => {
    const required = test.isText ? (test.wcagLevel === 'AAA' ? 7.0 : 4.5) : 3.0;
    console.log(`${index + 1}. ${test.name}`);
    console.log(`   Current:  ${formatRatio(test.ratio)}`);
    console.log(`   Required: ${required}:1 (WCAG ${test.wcagLevel})`);
    console.log(`   Location: ${test.location}`);
    console.log(`   Type:     ${test.isText ? 'Text' : 'UI Component/Border'}`);
    console.log('');
  });
}

console.log('═════════════════════════════════════════════════════════════════════');
console.log('Recommendations:');
console.log('═════════════════════════════════════════════════════════════════════\n');

console.log('1. ✅ Base tokens meet WCAG AA');
console.log('   - text-muted (#B5AFA4) achieves 7.89:1 on bg-surface');
console.log('   - This confirms the UX report\'s recommendation is working\n');

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
console.log('   - Test on real devices at various brightness levels\n');

console.log('═════════════════════════════════════════════════════════════════════\n');

// Exit with error code if there are failures
process.exit(failedTests > 0 ? 1 : 0);