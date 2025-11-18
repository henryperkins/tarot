// scripts/test-graphrag-demo.mjs
// Demonstration of GraphRAG system with real spread examples
// Run with: node scripts/test-graphrag-demo.mjs

import { buildGraphContext } from '../functions/lib/graphContext.js';
import { retrievePassages, formatPassagesForPrompt, buildRetrievalSummary } from '../functions/lib/graphRAG.js';

console.log('🔮 GraphRAG System Demonstration\n');
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

if (healingContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Fool's Journey Stage: ${healingContext.graphKeys.foolsJourneyStageKey}`);
  console.log(`   - Complete Triads: ${healingContext.graphKeys.completeTriadIds.join(', ')}`);
  console.log(`   - High Dyads: ${healingContext.graphKeys.dyadPairs.length}`);
  console.log();

  const passages = retrievePassages(healingContext.graphKeys, { maxPassages: 3 });

  console.log(`📚 Retrieved ${passages.length} Passages:\n`);
  passages.forEach((p, i) => {
    console.log(`   ${i + 1}. [Priority ${p.priority}] ${p.type}: ${p.title || p.theme}`);
    console.log(`      "${p.text.substring(0, 120)}..."`);
    console.log(`      — ${p.source}`);
    console.log();
  });

  const formatted = formatPassagesForPrompt(passages);
  console.log('📝 Formatted for LLM Prompt:\n');
  console.log(formatted);
  console.log();

  const summary = buildRetrievalSummary(healingContext.graphKeys, passages);
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

if (liberationContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Fool's Journey Stage: ${liberationContext.graphKeys.foolsJourneyStageKey}`);
  console.log(`   - Complete Triads: ${liberationContext.graphKeys.completeTriadIds.join(', ')}`);
  console.log();

  const passages = retrievePassages(liberationContext.graphKeys, { maxPassages: 2 });

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

if (mixedContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Fool's Journey Stage: ${mixedContext.graphKeys.foolsJourneyStageKey}`);
  console.log(`   - Partial Triads: ${mixedContext.graphKeys.triadIds.filter(id => !mixedContext.graphKeys.completeTriadIds.includes(id)).join(', ') || 'none'}`);
  console.log(`   - High Dyads Detected: ${mixedContext.graphKeys.dyadPairs.length}`);
  console.log();

  const passages = retrievePassages(mixedContext.graphKeys, { maxPassages: 4 });

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

if (wandsContext) {
  console.log('✅ Graph Context Built:');
  console.log(`   - Suit Progressions: ${wandsContext.graphKeys.suitProgressions.length}`);
  console.log();

  const passages = retrievePassages(wandsContext.graphKeys, { maxPassages: 2 });

  if (passages.length > 0) {
    console.log(`📚 Retrieved ${passages.length} Passage(s) for Suit Progression:\n`);
    passages.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.title}`);
      console.log(`      Suit: ${p.suit}, Stage: ${p.stage}`);
      console.log(`      "${p.text.substring(0, 120)}..."`);
      console.log();
    });
  } else {
    console.log('   ℹ️  No passages retrieved (suit progression may not be strong enough)\n');
  }
}

console.log('='.repeat(80));
console.log();

// Summary
console.log('✨ GraphRAG System Summary\n');
console.log('   ✅ Knowledge base loaded with curated passages');
console.log('   ✅ Retrieval prioritizes: Triads > Journey > Dyads > Suit Progressions');
console.log('   ✅ Passages formatted for LLM prompt injection');
console.log('   ✅ Zero infrastructure dependencies (in-memory retrieval)');
console.log('   ✅ Ready for upgrade to semantic search with embeddings');
console.log();
console.log('🎯 Next steps:');
console.log('   1. Test in production readings (GRAPHRAG_ENABLED=true)');
console.log('   2. Collect user feedback on passage relevance');
console.log('   3. Add more passages for additional patterns');
console.log('   4. Consider embedding-based semantic search');
console.log();
