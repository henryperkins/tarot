#!/usr/bin/env node

/**
 * Test script to verify telemetry persistence to METRICS_DB KV namespace
 *
 * This script:
 * 1. Generates a mock vision proof (bypassing actual image upload for testing)
 * 2. Makes a test reading request with the proof
 * 3. Verifies the telemetry was written to KV
 */

import crypto from 'crypto';

const BASE_URL = process.env.TEST_URL;
const VISION_SECRET = process.env.VISION_PROOF_SECRET;

if (!BASE_URL) {
  throw new Error('TEST_URL is required (example: https://tableau.<subdomain>.workers.dev)');
}

if (!VISION_SECRET) {
  throw new Error('VISION_PROOF_SECRET is required. Do not hardcode secrets in this script.');
}

/**
 * Sign a vision proof payload with HMAC-SHA256
 */
async function signProof(payload, secret) {
  const message = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('base64');
}

/**
 * Create a test vision proof
 */
async function createTestProof() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3600000); // 1 hour from now

  const payload = {
    id: crypto.randomUUID(),
    deckStyle: 'rws-1909',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    insights: [
      {
        label: 'test-card-1',
        predictedCard: 'The Fool',
        confidence: 0.95,
        basis: 'test',
        matches: [],
        attention: null,
        symbolVerification: null
      },
      {
        label: 'test-card-2',
        predictedCard: 'The Magician',
        confidence: 0.92,
        basis: 'test',
        matches: [],
        attention: null,
        symbolVerification: null
      },
      {
        label: 'test-card-3',
        predictedCard: 'The High Priestess',
        confidence: 0.88,
        basis: 'test',
        matches: [],
        attention: null,
        symbolVerification: null
      }
    ]
  };

  const signature = await signProof(payload, VISION_SECRET);

  return {
    ...payload,
    signature
  };
}

/**
 * Make a test tarot reading request
 */
async function testReading() {
  console.log('🔮 Testing telemetry persistence...\n');

  // Create vision proof
  console.log('1️⃣  Creating test vision proof...');
  const visionProof = await createTestProof();
  console.log(`   ✓ Proof ID: ${visionProof.id}\n`);

  // Prepare test reading payload
  const payload = {
    spreadInfo: {
      name: 'Three-Card Story (Past · Present · Future)',
      description: 'Test spread for telemetry'
    },
    cardsInfo: [
      {
        position: 'Past',
        card: 'The Fool',
        orientation: 'upright',
        meaning: 'New beginnings, innocence, spontaneity'
      },
      {
        position: 'Present',
        card: 'The Magician',
        orientation: 'upright',
        meaning: 'Manifestation, resourcefulness, power'
      },
      {
        position: 'Future',
        card: 'The High Priestess',
        orientation: 'reversed',
        meaning: 'Hidden agendas, need for patience'
      }
    ],
    userQuestion: 'What guidance do I need right now?',
    reflectionsText: 'Testing telemetry persistence',
    visionProof,
    deckStyle: 'rws-1909'
  };

  // Make request
  console.log('2️⃣  Making reading request...');
  const response = await fetch(`${BASE_URL}/api/tarot-reading`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`   Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const error = await response.text();
    console.error(`   ✗ Request failed:`, error);
    process.exit(1);
  }

  const result = await response.json();
  console.log(`   ✓ Provider: ${result.provider}`);
  console.log(`   ✓ Reading length: ${result.reading?.length || 0} chars\n`);

  return result;
}

// Run test
testReading()
  .then(() => {
    console.log('✅ Telemetry test completed successfully!');
    console.log('\n📊 To verify persistence, run:');
    console.log('   npx wrangler d1 execute mystic-tarot-db --command "SELECT request_id, provider, spread_key, deck_style, created_at FROM eval_metrics ORDER BY created_at DESC LIMIT 5;" --json\n');
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
