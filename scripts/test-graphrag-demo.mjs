// scripts/test-graphrag-demo.mjs
// Demonstration and automated test of GraphRAG system with real spread examples
// Run with: node scripts/test-graphrag-demo.mjs
//
// This script serves dual purposes:
// 1. Visual demonstration of GraphRAG capabilities for humans
// 2. Automated assertions for CI (exits non-zero on failure)

import assert from 'node:assert/strict';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { retrievePassages, formatPassagesForPrompt, buildRetrievalSummary } from '../functions/lib/graphRAG.js';

let testsPassed = 0;
let testsFailed = 0;

function assertOk(condition, message) {
  try {
    assert.ok(condition, message);
    testsPassed++;
  } catch (err) {
    testsFailed++;
    console.error(`❌ ASSERTION FAILED: ${message}`);
    console.error(`   ${err.message}`);
  }
}

function assertEqual(actual, expected, message) {
  try {
    assert.strictEqual(actual, expected, message);
    testsPassed++;
  } catch (_err) {
    testsFailed++;
    console.error(`❌ ASSERTION FAILED: ${message}`);
    console.error(`   Expected: ${expected}, Got: ${actual}`);
  }
}

console.log('🔮 GraphRAG System Demonstration & Test\n');
console.log('='.repeat(80));
console.log();

// Example 1: Death-Temperance-Star (The Healing Arc)
console.log('📖 Example 1: The Healing Arc (Death → Temperance → Star)\n');
console.log('-'.repeat(80));

const healingArcCards = [
  { name: 'Death', number: 13, orientation: 'upright' },
  { name: 'Temperance', number: 14, orientation: 'upright' },
  { name: 'The Star', number: 17, orientation: 'upright' }
];

const healingContext = buildGraphContext(healingArcCards, { deckStyle: 'rws-1909' });

assertOk(healingContext, 'Healing Arc: Should build graph context');
assertOk(healingContext?.patterns, 'Healing Arc: Should have patterns');
assertOk(healingContext?.graphKeys, 'Healing Arc: Should have graphKeys');

if (healingContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Fool's Journey Stage: ${healingContext.graphKeys.foolsJourneyStageKey}`);
  console.log(`   - Complete Triads: ${healingContext.graphKeys.completeTriadIds.join(', ')}`);
  console.log(`   - High Dyads: ${healingContext.graphKeys.dyadPairs.length}`);
  console.log();

  assertEqual(healingContext.graphKeys.foolsJourneyStageKey, 'integration',
    'Healing Arc: Journey stage should be integration');
  assertOk(healingContext.graphKeys.completeTriadIds.includes('death-temperance-star'),
    'Healing Arc: Should detect death-temperance-star triad');

  const passages = retrievePassages(healingContext.graphKeys, { maxPassages: 3 });

  assertOk(passages.length > 0, 'Healing Arc: Should retrieve passages');
  assertOk(passages.length <= 3, 'Healing Arc: Should respect maxPassages limit');
  assertEqual(passages[0].type, 'triad', 'Healing Arc: First passage should be triad (priority 1)');
  assertEqual(passages[0].title, 'The Healing Arc', 'Healing Arc: Triad title should match');

  console.log(`📚 Retrieved ${passages.length} Passages:\n`);
  passages.forEach((p, i) => {
    console.log(`   ${i + 1}. [Priority ${p.priority}] ${p.type}: ${p.title || p.theme}`);
    console.log(`      "${p.text.substring(0, 120)}..."`);
    console.log(`      — ${p.source}`);
    console.log();
  });

  const formatted = formatPassagesForPrompt(passages);
  assertOk(formatted.length > 0, 'Healing Arc: Should produce formatted output');
  assertOk(formatted.includes('Retrieved Wisdom'), 'Healing Arc: Should include header');
  assertOk(formatted.includes('Healing Arc'), 'Healing Arc: Should include triad title');

  console.log('📝 Formatted for LLM Prompt:\n');
  console.log(formatted);
  console.log();

  const summary = buildRetrievalSummary(healingContext.graphKeys, passages);
  assertEqual(summary.patternsDetected.completeTriads, 1,
    'Healing Arc: Summary should show 1 complete triad');
  assertOk(summary.passagesRetrieved >= 1,
    'Healing Arc: Summary should show passages retrieved');

  console.log('📊 Retrieval Summary:');
  console.log(JSON.stringify(summary, null, 2));
}

console.log();
console.log('='.repeat(80));
console.log();

// Example 2: Devil-Tower-Sun (Liberation Arc)
console.log('📖 Example 2: The Liberation Arc (Devil → Tower → Sun)\n');
console.log('-'.repeat(80));

const liberationCards = [
  { name: 'The Devil', number: 15, orientation: 'upright' },
  { name: 'The Tower', number: 16, orientation: 'upright' },
  { name: 'The Sun', number: 19, orientation: 'upright' }
];

const liberationContext = buildGraphContext(liberationCards, { deckStyle: 'rws-1909' });

assertOk(liberationContext, 'Liberation Arc: Should build graph context');

if (liberationContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Fool's Journey Stage: ${liberationContext.graphKeys.foolsJourneyStageKey}`);
  console.log(`   - Complete Triads: ${liberationContext.graphKeys.completeTriadIds.join(', ')}`);
  console.log();

  assertEqual(liberationContext.graphKeys.foolsJourneyStageKey, 'culmination',
    'Liberation Arc: Journey stage should be culmination');
  assertOk(liberationContext.graphKeys.completeTriadIds.includes('devil-tower-sun'),
    'Liberation Arc: Should detect devil-tower-sun triad');

  const passages = retrievePassages(liberationContext.graphKeys, { maxPassages: 2 });

  assertOk(passages.length > 0, 'Liberation Arc: Should retrieve passages');
  assertEqual(passages[0].type, 'triad', 'Liberation Arc: First passage should be triad');

  console.log(`📚 Retrieved ${passages.length} Passages:\n`);
  passages.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.title}`);
    console.log(`      Theme: ${p.theme}`);
    console.log(`      "${p.text.substring(0, 150)}..."`);
    console.log();
  });
}

console.log('='.repeat(80));
console.log();

// Example 3: Mixed Major spread (no complete triad, but Journey + Dyads)
console.log('📖 Example 3: Mixed Major Spread (Journey + Dyads)\n');
console.log('-'.repeat(80));

const mixedCards = [
  { name: 'The Hermit', number: 9, orientation: 'upright' },
  { name: 'The Hanged Man', number: 12, orientation: 'upright' },
  { name: 'Death', number: 13, orientation: 'upright' },
  { name: 'The Star', number: 17, orientation: 'upright' }
];

const mixedContext = buildGraphContext(mixedCards, { deckStyle: 'rws-1909' });

assertOk(mixedContext, 'Mixed Spread: Should build graph context');

if (mixedContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Fool's Journey Stage: ${mixedContext.graphKeys.foolsJourneyStageKey}`);
  console.log(`   - Partial Triads: ${mixedContext.graphKeys.triadIds.filter(id => !mixedContext.graphKeys.completeTriadIds.includes(id)).join(', ') || 'none'}`);
  console.log(`   - High Dyads Detected: ${mixedContext.graphKeys.dyadPairs.length}`);
  console.log();

  assertOk(mixedContext.graphKeys.foolsJourneyStageKey,
    'Mixed Spread: Should detect journey stage');

  const passages = retrievePassages(mixedContext.graphKeys, { maxPassages: 4 });

  assertOk(passages.length >= 1, 'Mixed Spread: Should retrieve at least one passage');

  console.log(`📚 Retrieved ${passages.length} Passages (Journey + Dyads):\n`);
  passages.forEach((p, i) => {
    const typeLabel = p.type === 'fools-journey' ? '🎭 Journey' : '🔗 Dyad';
    console.log(`   ${i + 1}. ${typeLabel} [Priority ${p.priority}]`);
    console.log(`      ${p.title || p.theme}`);
    if (p.cardNames) {
      console.log(`      Cards: ${p.cardNames.join(' + ')}`);
    }
    console.log();
  });

  // Verify priority ordering (journey P2 should come before dyad P3)
  const journeyIdx = passages.findIndex(p => p.type === 'fools-journey');
  const dyadIdx = passages.findIndex(p => p.type === 'dyad');
  if (journeyIdx !== -1 && dyadIdx !== -1) {
    assertOk(journeyIdx < dyadIdx, 'Mixed Spread: Journey should precede dyads in ordering');
  }
}

console.log('='.repeat(80));
console.log();

// Example 4: Minor Arcana Suit Progression
console.log('📖 Example 4: Minor Arcana Suit Progression (Wands Beginning)\n');
console.log('-'.repeat(80));

const wandsCards = [
  { name: 'Ace of Wands', suit: 'Wands', rank: 'Ace', rankValue: 1, orientation: 'upright' },
  { name: 'Two of Wands', suit: 'Wands', rank: 'Two', rankValue: 2, orientation: 'upright' },
  { name: 'Three of Wands', suit: 'Wands', rank: 'Three', rankValue: 3, orientation: 'upright' }
];

const wandsContext = buildGraphContext(wandsCards, { deckStyle: 'rws-1909' });

assertOk(wandsContext, 'Wands Spread: Should build graph context');

if (wandsContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Suit Progressions: ${wandsContext.graphKeys.suitProgressions.length}`);
  console.log();

  assertOk(wandsContext.graphKeys.suitProgressions.length > 0,
    'Wands Spread: Should detect suit progression');

  const passages = retrievePassages(wandsContext.graphKeys, { maxPassages: 2 });

  if (passages.length > 0) {
    console.log(`📚 Retrieved ${passages.length} Passage(s) for Suit Progression:\n`);
    passages.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.title}`);
      console.log(`      Suit: ${p.suit}, Stage: ${p.stage}`);
      console.log(`      "${p.text.substring(0, 120)}..."`);
      console.log();
    });

    // Verify suit progression passage has correct metadata
    const suitPassage = passages.find(p => p.type === 'suit-progression');
    if (suitPassage) {
      assertEqual(suitPassage.suit, 'Wands', 'Wands Spread: Passage should be for Wands');
      assertEqual(suitPassage.stage, 'beginning', 'Wands Spread: Stage should be beginning');
    }
  } else {
    console.log('   ℹ️  No passages retrieved (suit progression may not be strong enough)\n');
  }
}

console.log('='.repeat(80));
console.log();

// Example 5: Edge case - Empty/null cards
console.log('📖 Example 5: Edge Cases\n');
console.log('-'.repeat(80));

const nullContext = buildGraphContext(null, { deckStyle: 'rws-1909' });
const emptyContext = buildGraphContext([], { deckStyle: 'rws-1909' });

assertEqual(nullContext, null, 'Edge Case: null cards should return null context');
assertEqual(emptyContext, null, 'Edge Case: empty cards should return null context');

console.log('✅ Edge cases handled correctly:');
console.log('   - null cards → null context');
console.log('   - empty array → null context');
console.log();

// Verify retrievePassages handles edge cases
const nullPassages = retrievePassages(null, { maxPassages: 3 });
const emptyPassages = retrievePassages({}, { maxPassages: 3 });

assertEqual(nullPassages.length, 0, 'Edge Case: null graphKeys should return empty passages');
assertEqual(emptyPassages.length, 0, 'Edge Case: empty graphKeys should return empty passages');

console.log('   - null graphKeys → empty passages');
console.log('   - empty graphKeys → empty passages');
console.log();

console.log('='.repeat(80));
console.log();

// Summary
console.log('✨ GraphRAG System Summary\n');
console.log('   ✅ Knowledge base loaded with curated passages');
console.log('   ✅ Retrieval prioritizes: Triads > Journey > Dyads > Suit Progressions');
console.log('   ✅ Passages formatted for LLM prompt injection');
console.log('   ✅ Zero infrastructure dependencies (in-memory retrieval)');
console.log('   ✅ Edge cases handled gracefully');
console.log();

// Test Results
console.log('='.repeat(80));
console.log();
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log();

if (testsFailed > 0) {
  console.log('❌ Some tests failed. See errors above.');
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  process.exit(0);
}
