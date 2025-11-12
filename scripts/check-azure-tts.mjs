#!/usr/bin/env node

/**
 * Azure OpenAI TTS Configuration Checker
 *
 * This script helps diagnose TTS configuration issues by:
 * 1. Checking environment variables
 * 2. Testing the Azure OpenAI endpoint
 * 3. Verifying deployment accessibility
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load .env.local if it exists
config({ path: join(rootDir, '.env.local') });

const REQUIRED_VARS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT'
];

const OPTIONAL_VARS = [
  'AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT'
];

console.log('🔍 Azure OpenAI TTS Configuration Checker\n');

// Check environment variables
console.log('📋 Environment Variables:\n');

let allPresent = true;

REQUIRED_VARS.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName === 'AZURE_OPENAI_API_KEY') {
      console.log(`✅ ${varName}: ${value.slice(0, 10)}...${value.slice(-10)} (${value.length} chars)`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allPresent = false;
  }
});

console.log('\n📝 Optional Variables:\n');

OPTIONAL_VARS.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`⚪ ${varName}: Not set (will use default)`);
  }
});

if (!allPresent) {
  console.log('\n❌ Missing required environment variables!');
  console.log('\n💡 To fix:');
  console.log('   1. Edit .env.local and fill in the missing values');
  console.log('   2. Get values from Azure Portal:');
  console.log('      https://portal.azure.com → Azure OpenAI → Your Resource → Keys and Endpoint');
  console.log('   3. For deployment name, go to: Deployments tab');
  process.exit(1);
}

// Test Azure OpenAI connection
console.log('\n🔌 Testing Azure OpenAI Connection:\n');

const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '');
const deployment = process.env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';
const format = process.env.AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT || 'mp3';

const url = `${endpoint}/openai/deployments/${deployment}/audio/speech?api-version=${apiVersion}`;

console.log(`🌐 Endpoint: ${url}`);
console.log(`🎙️  Deployment: ${deployment}`);
console.log(`📦 API Version: ${apiVersion}`);
console.log(`🎵 Format: ${format}\n`);

// Test with a simple request
const testPayload = {
  model: deployment,
  voice: 'nova',
  input: 'Testing Azure OpenAI TTS integration.',
  response_format: format,
  speed: 0.95
};

// Check if deployment supports steerable instructions
const isSteerableModel = deployment.toLowerCase().includes('gpt-4o') ||
                        deployment.toLowerCase().includes('mini-tts') ||
                        deployment.toLowerCase().includes('audio-preview');

if (isSteerableModel) {
  testPayload.instructions = 'Speak gently and clearly, as a test of the text-to-speech system.';
  console.log('✨ Model supports steerable instructions (gpt-4o-mini-tts detected)');
} else {
  console.log('⚪ Model does not support steerable instructions (tts-1/tts-1-hd detected)');
}

console.log('\n📡 Sending test request...\n');

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(testPayload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to read error response');
    console.log(`❌ Request failed with status ${response.status}`);
    console.log(`\n📄 Error details:\n${errorText}\n`);

    if (response.status === 401) {
      console.log('💡 Fix: Check your AZURE_OPENAI_API_KEY is correct');
    } else if (response.status === 404) {
      console.log('💡 Fix: Check your AZURE_OPENAI_ENDPOINT and deployment name are correct');
      console.log('   Verify the deployment exists in Azure Portal → Deployments tab');
    } else if (response.status === 429) {
      console.log('💡 Fix: Rate limit exceeded or quota reached. Check Azure Portal → Quotas');
    }

    process.exit(1);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioSize = arrayBuffer.byteLength;

  console.log(`✅ SUCCESS! TTS is working correctly`);
  console.log(`   Audio generated: ${(audioSize / 1024).toFixed(2)} KB`);
  console.log(`   Format: ${format}`);
  console.log(`   Provider: azure-${deployment}\n`);

  console.log('🎉 Your Azure OpenAI TTS integration is configured correctly!');
  console.log('\n📌 Next steps:');
  console.log('   1. For Cloudflare Pages deployment, set these environment variables in:');
  console.log('      Cloudflare Dashboard → Pages → mystic-tarot → Settings → Environment variables');
  console.log('   2. For local development with Vite, the .env.local file should work');
  console.log('   3. For Cloudflare Pages Functions, you may need to use wrangler.toml or dashboard\n');

} catch (error) {
  console.log(`❌ Connection failed: ${error.message}\n`);
  console.log('💡 Troubleshooting:');
  console.log('   1. Check your internet connection');
  console.log('   2. Verify AZURE_OPENAI_ENDPOINT is correct');
  console.log('   3. Ensure the Azure OpenAI resource is active');
  console.log('   4. Check firewall/proxy settings\n');
  process.exit(1);
}
