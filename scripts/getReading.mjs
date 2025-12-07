#!/usr/bin/env node
/**
 * Interactive tarot reading script
 *
 * Usage:
 *   node scripts/getReading.mjs                    # Random spread, random question
 *   node scripts/getReading.mjs --spread celtic    # Specific spread
 *   node scripts/getReading.mjs --question "..."   # Specific question
 *   node scripts/getReading.mjs --minors           # Include minor arcana
 *   node scripts/getReading.mjs --api production   # Use production API
 *   node scripts/getReading.mjs --json             # Output raw JSON
 */

import { SPREADS } from '../src/data/spreads.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

// ============================================================================
// Configuration
// ============================================================================

const API_ENDPOINTS = {
  local: 'http://localhost:8787/api/tarot-reading',
  production: 'https://tarot.henryperkins.workers.dev/api/tarot-reading'
};

const SAMPLE_QUESTIONS = [
  'What energy surrounds my current path?',
  'How can I bring more balance into my life?',
  'What should I focus on this week?',
  'What is blocking my progress?',
  'What lesson is presenting itself right now?',
  'How can I move forward with clarity?',
  'What do I need to release?',
  'What strength can I draw upon?',
  'What is the energy around my relationships?',
  'How can I align with my highest purpose?'
];

// ============================================================================
// Deck utilities (mirrored from src/lib/deck.js for Node.js)
// ============================================================================

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function xorshift32(seed) {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

function seededShuffle(arr, seed) {
  const copy = arr.slice();
  const rand = xorshift32(seed >>> 0);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function computeSeed({ cutIndex, knockTimes, userQuestion }) {
  const intervals = (knockTimes || [])
    .slice(-3)
    .map((t, i, arr) => (i ? t - arr[i - 1] : 0))
    .reduce((sum, value) => sum + value, 0);

  const knockCount = (knockTimes || []).length;
  const avgInterval = knockCount > 1 ? intervals / (knockCount - 1) : 0;
  const timingPattern = avgInterval > 500 ? 'slow' : avgInterval > 200 ? 'medium' : 'rapid';
  const timingHash = hashString(timingPattern);

  const qHash = hashString(userQuestion || '');
  let seed = (qHash ^ (cutIndex * 2654435761) ^ Math.floor(intervals) ^ (knockCount * 1664525) ^ timingHash) >>> 0;
  if (seed === 0) seed = 0x9e3779b9;
  return seed >>> 0;
}

function getDeckPool(includeMinors = false) {
  if (includeMinors && Array.isArray(MINOR_ARCANA) && MINOR_ARCANA.length === 56) {
    return [...MAJOR_ARCANA, ...MINOR_ARCANA];
  }
  return MAJOR_ARCANA;
}

function drawSpread({ spreadKey, seed, includeMinors = false }) {
  const spread = SPREADS[spreadKey];
  if (!spread) throw new Error(`Unknown spread: ${spreadKey}`);

  const pool = seededShuffle(getDeckPool(includeMinors), seed);
  const count = spread.count;

  if (pool.length < count) {
    throw new Error(`Deck too small for spread: need ${count} cards but only have ${pool.length}`);
  }

  const orientationRand = xorshift32((seed ^ 0xa5a5a5a5) >>> 0);

  return pool.slice(0, count).map((card, index) => ({
    ...card,
    position: spread.positions[index],
    isReversed: orientationRand() > 0.5
  }));
}

// ============================================================================
// CLI argument parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    spread: null,
    question: null,
    includeMinors: false,
    api: 'local',
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--spread' || arg === '-s') {
      options.spread = args[++i];
    } else if (arg === '--question' || arg === '-q') {
      options.question = args[++i];
    } else if (arg === '--minors' || arg === '-m') {
      options.includeMinors = true;
    } else if (arg === '--api' || arg === '-a') {
      options.api = args[++i];
    } else if (arg === '--json' || arg === '-j') {
      options.json = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Tarot Reading Script
====================

Draw cards and receive an AI-generated tarot reading.

Usage:
  node scripts/getReading.mjs [options]

Options:
  --spread, -s <name>    Spread type: single, threeCard, fiveCard, decision, relationship, celtic
  --question, -q <text>  Your question for the reading
  --minors, -m           Include Minor Arcana (78 cards instead of 22)
  --api, -a <target>     API target: local (default) or production
  --json, -j             Output raw JSON response
  --help, -h             Show this help

Examples:
  node scripts/getReading.mjs
  node scripts/getReading.mjs --spread threeCard --question "What should I focus on?"
  node scripts/getReading.mjs -s celtic -m --api production
`);
}

// ============================================================================
// Ritual simulation
// ============================================================================

function simulateRitual() {
  // Simulate 3 knocks with varying intervals
  const now = Date.now();
  const knockTimes = [
    now - 1500 - Math.floor(Math.random() * 500),
    now - 800 - Math.floor(Math.random() * 300),
    now - Math.floor(Math.random() * 200)
  ];

  // Random cut position (where user "cuts" the deck)
  const cutIndex = Math.floor(Math.random() * 78);

  return { knockTimes, cutIndex };
}

// ============================================================================
// Display helpers
// ============================================================================

function formatCard(card, index) {
  const orientation = card.isReversed ? '(reversed)' : '(upright)';
  const cardName = card.name || card.card || 'Unknown';
  return `  ${index + 1}. [${card.position}] ${cardName} ${orientation}`;
}

function displaySpread(spreadKey, cards, question) {
  const spread = SPREADS[spreadKey];

  console.log('\n' + '='.repeat(60));
  console.log(`  ${spread.name}`);
  console.log('='.repeat(60));
  console.log(`\nQuestion: "${question}"\n`);
  console.log('Cards Drawn:');
  cards.forEach((card, i) => console.log(formatCard(card, i)));
  console.log('');
}

function displayReading(reading) {
  console.log('='.repeat(60));
  console.log('  YOUR READING');
  console.log('='.repeat(60));
  console.log('');
  console.log(reading);
  console.log('');
}

// ============================================================================
// API call
// ============================================================================

async function fetchReading(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Select spread
  const spreadKeys = Object.keys(SPREADS);
  const spreadKey = options.spread && SPREADS[options.spread]
    ? options.spread
    : spreadKeys[Math.floor(Math.random() * spreadKeys.length)];

  const spread = SPREADS[spreadKey];

  // Select question
  const question = options.question ||
    SAMPLE_QUESTIONS[Math.floor(Math.random() * SAMPLE_QUESTIONS.length)];

  // Simulate ritual and compute seed
  const { knockTimes, cutIndex } = simulateRitual();
  const seed = computeSeed({ cutIndex, knockTimes, userQuestion: question });

  // Draw cards
  const drawnCards = drawSpread({
    spreadKey,
    seed,
    includeMinors: options.includeMinors
  });

  // Build API payload
  const cardsInfo = drawnCards.map(card => ({
    card: card.name,
    position: card.position,
    orientation: card.isReversed ? 'Reversed' : 'Upright',
    meaning: card.isReversed ? card.reversed : card.upright,
    // Include additional card data for richer analysis
    number: card.number,
    suit: card.suit || null,
    rank: card.rank || null,
    rankValue: card.rankValue || null,
    upright: card.upright,
    reversed: card.reversed,
    element: card.element || null
  }));

  const payload = {
    spreadInfo: {
      name: spread.name,
      positions: spread.positions
    },
    cardsInfo,
    userQuestion: question,
    deckStyle: 'rws-1909',
    context: null // Let the API infer context
  };

  // Display the spread
  if (!options.json) {
    displaySpread(spreadKey, drawnCards, question);
    console.log('Fetching reading from API...\n');
  }

  // Call API
  const endpoint = API_ENDPOINTS[options.api] || API_ENDPOINTS.local;

  try {
    const result = await fetchReading(endpoint, payload);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.reading) {
        displayReading(result.reading);

        // Show metadata
        console.log('-'.repeat(60));
        console.log(`Provider: ${result.provider || 'unknown'}`);
        if (result.themes) {
          console.log(`Themes: ${JSON.stringify(result.themes.suitFocus || {})}`);
        }
        if (result.spreadAnalysis?.summary) {
          console.log(`Analysis: ${result.spreadAnalysis.summary}`);
        }
      } else {
        console.error('No reading in response:', result);
      }
    }
  } catch (err) {
    console.error('Failed to fetch reading:', err.message);

    if (!options.json) {
      console.log('\nTip: Make sure the dev server is running with `npm run dev`');
      console.log('Or use --api production to hit the deployed API.');
    }

    process.exit(1);
  }
}

main();
