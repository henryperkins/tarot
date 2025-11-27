/**
 * Elemental Remedies Test
 * Verifies that actionable elemental remedies are generated when elements are imbalanced
 */

import { buildElementalRemedies, shouldOfferElementalRemedies } from '../functions/lib/narrative/helpers.js';

console.log('🧪 Testing Elemental Remedies Enhancement...\n');

const tests = [
  {
    name: 'Fire-dominant spread (2/3 Fire)',
    elementCounts: { Fire: 2, Water: 0, Air: 1, Earth: 0 },
    totalCards: 3,
    context: 'self',
    expectRemedies: true,
    expectElements: ['Water', 'Earth']
  },
  {
    name: 'Balanced spread',
    elementCounts: { Fire: 1, Water: 1, Air: 1, Earth: 1 },
    totalCards: 4,
    context: 'general',
    expectRemedies: false,
    expectElements: []
  },
  {
    name: 'Water-only spread (all Water)',
    elementCounts: { Fire: 0, Water: 3, Air: 0, Earth: 0 },
    totalCards: 3,
    context: 'love',
    expectRemedies: true,
    expectElements: ['Fire', 'Air', 'Earth']
  },
  {
    name: 'Sparse elements (Fire + Air only)',
    elementCounts: { Fire: 2, Water: 0, Air: 1, Earth: 0 },
    totalCards: 3,
    context: 'career',
    expectRemedies: true,
    expectElements: ['Water', 'Earth']
  },
  {
    name: 'Single-card spread (no remedies)',
    elementCounts: { Fire: 1, Water: 0, Air: 0, Earth: 0 },
    totalCards: 1,
    context: 'spiritual',
    expectRemedies: false,
    expectElements: []
  },
  {
    name: 'Celtic Cross with moderate Fire dominance',
    elementCounts: { Fire: 5, Water: 2, Air: 2, Earth: 1 },
    totalCards: 10,
    context: 'general',
    expectRemedies: true,
    expectElements: ['Earth'] // Only Earth is < 15% (1/10 = 10%)
  }
];

let passed = 0;
let failed = 0;
let totalTests = tests.length;

tests.forEach((test, index) => {
  console.log(`\n📝 Test ${index + 1}: ${test.name}`);
  console.log(`   Element counts: ${JSON.stringify(test.elementCounts)}`);
  console.log(`   Total cards: ${test.totalCards}`);

  // Test shouldOfferElementalRemedies
  const shouldOffer = shouldOfferElementalRemedies(test.elementCounts, test.totalCards);
  console.log(`   Should offer remedies: ${shouldOffer} (expected: ${test.expectRemedies})`);

  if (shouldOffer !== test.expectRemedies) {
    console.log(`   ❌ FAILED: shouldOfferElementalRemedies returned ${shouldOffer}, expected ${test.expectRemedies}`);
    failed++;
    return;
  }

  // Test buildElementalRemedies
  const remedies = buildElementalRemedies(test.elementCounts, test.totalCards, test.context);

  if (test.expectRemedies) {
    if (!remedies) {
      console.log(`   ❌ FAILED: Expected remedies but got null`);
      failed++;
      return;
    }

    console.log(`   Generated remedies:\n${remedies.split('\n').map(line => `     ${line}`).join('\n')}`);

    // Check that expected elements are present
    const missingElements = test.expectElements.filter(element => !remedies.includes(element));
    if (missingElements.length > 0) {
      console.log(`   ❌ FAILED: Missing expected elements: ${missingElements.join(', ')}`);
      failed++;
      return;
    }

    // Check that remedies contain actionable text (checking for context-aware fragments)
    const hasActionableText = remedies.includes('Move your body') ||
      remedies.includes('Start that creative') ||
      remedies.includes('Journal your feelings') ||
      remedies.includes('Practice self-compassion') ||
      remedies.includes('Discuss your thoughts') ||
      remedies.includes('Write out your thoughts') ||
      remedies.includes('Establish one grounding') ||
      remedies.includes('Tend to your body') ||
      remedies.includes('Share a vulnerable') ||
      remedies.includes('Check in with how you feel') ||
      remedies.includes('Plan a spontaneous date') ||
      remedies.includes('Ask a question') ||
      remedies.includes('Create a small daily ritual') ||
      remedies.includes('Engage in embodied practice');

    if (!hasActionableText) {
      console.log(`   ❌ FAILED: Remedies don't contain actionable guidance`);
      failed++;
      return;
    }

    console.log(`   ✅ PASSED: Remedies generated correctly with expected elements`);
    passed++;
  } else {
    if (remedies) {
      console.log(`   ❌ FAILED: Expected no remedies but got: ${remedies}`);
      failed++;
      return;
    }
    console.log(`   ✅ PASSED: Correctly returned no remedies for balanced spread`);
    passed++;
  }
});

console.log('\n🌀 Rotation variety check');
const rotationCounts = { Fire: 2, Water: 0, Air: 1, Earth: 1 };
const rotationTotalCards = 4;
const firstRemedy = buildElementalRemedies(rotationCounts, rotationTotalCards, 'love', { rotationIndex: 0 });
const secondRemedy = buildElementalRemedies(rotationCounts, rotationTotalCards, 'love', { rotationIndex: 1 });
if (!firstRemedy || !secondRemedy) {
  console.log('   ❌ FAILED: Rotation test could not generate remedies for comparison');
  failed++;
} else if (firstRemedy === secondRemedy) {
  console.log('   ❌ FAILED: Different rotationIndex values returned identical remedies');
  failed++;
} else {
  console.log('   ✅ PASSED: Rotation index surfaces varied remedies');
  passed++;
}
totalTests += 1;

console.log(`\n\n📊 Results: ${passed}/${totalTests} tests passed`);

if (failed === 0) {
  console.log('✨ All elemental remedy tests passed!');
  console.log('Concrete, actionable guidance is being generated for imbalanced spreads.');
  process.exit(0);
} else {
  console.log(`⚠️  ${failed} test(s) failed`);
  process.exit(1);
}
