/**
 * Vision Weaving Integration Test
 * Verifies that vision-detected tone/emotion are injected into narrative prompts
 */

import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';

// Mock card data with vision insights
const mockCardsInfo = [
  {
    card: 'The Fool',
    number: 0,
    position: 'Past — influences that led here',
    orientation: 'Upright',
    meaning: 'New beginnings, innocence, spontaneity'
  },
  {
    card: 'The Magician',
    number: 1,
    position: 'Present — where you stand now',
    orientation: 'Upright',
    meaning: 'Manifestation, resourcefulness, power'
  },
  {
    card: 'The High Priestess',
    number: 2,
    position: 'Future — trajectory if nothing shifts',
    orientation: 'Reversed',
    meaning: 'Hidden agendas, need to listen to inner voice'
  }
];

// Mock vision insights with visual profiles
const mockVisionInsights = [
  {
    label: 'fool-upload',
    predictedCard: 'The Fool',
    confidence: 0.92,
    basis: 'image',
    visualProfile: {
      tone: ['mystical', 'ethereal'],
      emotion: ['joyful', 'carefree']
    }
  },
  {
    label: 'magician-upload',
    predictedCard: 'The Magician',
    confidence: 0.88,
    basis: 'text',
    visualProfile: {
      tone: ['vibrant', 'bold'],
      emotion: ['confident', 'focused']
    }
  },
  {
    label: 'priestess-upload',
    predictedCard: 'The High Priestess',
    confidence: 0.85,
    basis: 'adapter',
    visualProfile: {
      tone: ['dark', 'mysterious'],
      emotion: ['contemplative', 'introspective']
    }
  }
];

const mockSpreadInfo = {
  name: 'Three-Card Story (Past · Present · Future)',
  deckStyle: 'rws-1909'
};

const mockThemes = {
  reversalCount: 1,
  reversalFramework: 'contextual',
  reversalDescription: {
    name: 'Context-Dependent',
    description: 'Reversed cards interpreted based on position and context',
    guidance: 'Read each reversal in light of its position'
  },
  elementalBalance: 'Mixed elemental energies: Air (3)',
  deckStyle: 'rws-1909'
};

console.log('🧪 Testing Vision Weaving Enhancement...\n');

try {
  const { systemPrompt: _systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo: mockSpreadInfo,
    cardsInfo: mockCardsInfo,
    userQuestion: 'How can I navigate this new phase?',
    reflectionsText: null,
    themes: mockThemes,
    spreadAnalysis: {
      transitions: {
        firstToSecond: { relationship: 'supportive', elements: ['Air', 'Air'] },
        secondToThird: { relationship: 'tension', elements: ['Air', 'Water'] }
      }
    },
    context: 'self',
    visionInsights: mockVisionInsights,
    deckStyle: 'rws-1909'
  });

  console.log('✅ buildEnhancedClaudePrompt executed successfully\n');

  // Check that vision tone/emotion appear in user prompt
  const checks = [
    {
      name: 'Fool mystical tone',
      pattern: /mystical.*ethereal/i,
      context: 'The Fool card'
    },
    {
      name: 'Fool joyful emotion',
      pattern: /joyful.*carefree/i,
      context: 'The Fool card'
    },
    {
      name: 'Magician vibrant tone',
      pattern: /vibrant.*bold/i,
      context: 'The Magician card'
    },
    {
      name: 'Magician confident emotion',
      pattern: /confident.*focused/i,
      context: 'The Magician card'
    },
    {
      name: 'High Priestess dark tone',
      pattern: /dark.*mysterious/i,
      context: 'The High Priestess card'
    },
    {
      name: 'High Priestess contemplative emotion',
      pattern: /contemplative.*introspective/i,
      context: 'The High Priestess card'
    },
    {
      name: 'Vision-detected tone indicator',
      pattern: /vision-detected tone/i,
      context: 'User prompt formatting'
    }
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach(check => {
    const found = check.pattern.test(userPrompt);
    if (found) {
      console.log(`✅ ${check.name}`);
      passed++;
    } else {
      console.log(`❌ ${check.name} - not found in prompt`);
      failed++;
    }
  });

  console.log(`\n📊 Results: ${passed}/${checks.length} checks passed`);

  if (failed === 0) {
    console.log('\n✨ Vision weaving is working correctly!');
    console.log('Visual profiles (tone/emotion) are being injected into card prompts.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some vision data was not woven into prompts.');
    console.log('This may indicate an issue with the vision weaving logic.');

    // Output snippet of user prompt for debugging
    console.log('\n📝 Sample from user prompt (first 1000 chars):');
    console.log(userPrompt.substring(0, 1000));
    console.log('...\n');

    process.exit(1);
  }

} catch (error) {
  console.error('❌ Test failed with error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
