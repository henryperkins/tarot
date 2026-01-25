#!/usr/bin/env node
/**
 * Azure OpenAI TTS Diagnostic Script
 * Tests connection and configuration for the tarot app TTS endpoint.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Load environment variables manually
function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    console.error(`Warning: Could not load ${filePath}:`, error.message);
  }
}

loadEnv(resolve(rootDir, '.env.local'));

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function header(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(message, 'bold');
  log('='.repeat(60), 'cyan');
}

function checkmark() {
  return `${COLORS.green}✓${COLORS.reset}`;
}

function xmark() {
  return `${COLORS.red}✗${COLORS.reset}`;
}

// Configuration from environment
const config_values = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
  format: process.env.AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT || 'mp3'
};

header('Azure OpenAI TTS Configuration Diagnostics');

// Step 1: Check environment variables
log('\n📋 Step 1: Environment Variables', 'cyan');

const checks = [
  {
    name: 'AZURE_OPENAI_ENDPOINT',
    value: config_values.endpoint,
    validator: (val) => {
      if (!val) return { valid: false, message: 'Not set' };
      try {
        const url = new URL(val);
        if (url.hostname.endsWith('.cognitiveservices.azure.com')) {
          return {
            valid: false,
            message: 'Using legacy endpoint! Should be *.openai.azure.com',
            fix: val.replace('cognitiveservices.azure.com', 'openai.azure.com')
          };
        }
        if (!url.hostname.endsWith('.openai.azure.com')) {
          return { valid: false, message: 'Should match pattern: https://*.openai.azure.com' };
        }
      } catch {
        return { valid: false, message: 'Invalid URL format' };
      }
      if (val.endsWith('/')) {
        return {
          valid: true,
          warning: 'Ends with trailing slash (will be stripped by code)'
        };
      }
      return { valid: true, message: 'Format looks correct' };
    }
  },
  {
    name: 'AZURE_OPENAI_API_KEY',
    value: config_values.apiKey,
    validator: (val) => {
      if (!val) return { valid: false, message: 'Not set' };
      if (val.length < 32) return { valid: false, message: 'Key seems too short' };
      return { valid: true, message: `Set (length: ${val.length})` };
    }
  },
  {
    name: 'AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT',
    value: config_values.deployment,
    validator: (val) => {
      if (!val) return { valid: false, message: 'Not set' };
      return { valid: true, message: `Set to: "${val}"` };
    }
  },
  {
    name: 'AZURE_OPENAI_API_VERSION',
    value: config_values.apiVersion,
    validator: (val) => {
      const validVersions = ['2024-06-01', '2024-08-01-preview', '2024-10-01-preview', '2025-04-01-preview'];
      if (!val) return { valid: false, message: 'Not set (will default to 2024-06-01)' };
      if (!validVersions.includes(val)) {
        return { valid: true, warning: `Non-standard version: ${val}` };
      }
      return { valid: true, message: `Valid version: ${val}` };
    }
  }
];

let configValid = true;
const fixes = {};

for (const check of checks) {
  const result = check.validator(check.value);
  const status = result.valid ? checkmark() : xmark();

  console.log(`  ${status} ${check.name}`);

  if (result.message) {
    log(`     ${result.message}`, result.valid ? 'green' : 'red');
  }

  if (result.warning) {
    log(`     ⚠ ${result.warning}`, 'yellow');
  }

  if (result.fix) {
    log(`     💡 Suggested fix: ${result.fix}`, 'cyan');
    fixes[check.name] = result.fix;
  }

  if (!result.valid) {
    configValid = false;
  }
}

if (!configValid) {
  log('\n❌ Configuration issues detected. Cannot proceed with API test.', 'red');

  if (Object.keys(fixes).length > 0) {
    log('\n🔧 Suggested fixes for .env.local:', 'yellow');
    for (const [key, fix] of Object.entries(fixes)) {
      log(`   ${key}=${fix}`, 'cyan');
    }
  }

  log('\n📖 Configuration guide:', 'cyan');
  log('   1. Go to Azure Portal: https://portal.azure.com', 'reset');
  log('   2. Navigate to: Azure OpenAI → Your Resource', 'reset');
  log('   3. Keys & Endpoint: Copy endpoint (should be *.openai.azure.com)', 'reset');
  log('   4. Deployments: Verify your deployment name exists', 'reset');

  process.exit(1);
}

log('\n✅ All configuration checks passed!', 'green');

// Step 2: Test API connectivity
header('Step 2: Testing Azure OpenAI TTS API Connection');

const endpoint = config_values.endpoint.replace(/\/+$/, '');
const url = `${endpoint}/openai/deployments/${config_values.deployment}/audio/speech?api-version=${config_values.apiVersion}`;

log(`\n🔗 Endpoint: ${url}`, 'cyan');
log(`🎤 Voice: nova`, 'cyan');
log(`⚙️  Format: ${config_values.format}`, 'cyan');

const testPayload = {
  model: config_values.deployment,
  voice: 'nova',
  input: 'This is a test of the Azure OpenAI text-to-speech service.',
  response_format: config_values.format,
  speed: 0.95
};

// Add steerable instructions if this looks like gpt-4o-mini-tts
if (config_values.deployment.toLowerCase().includes('gpt-4o') ||
    config_values.deployment.toLowerCase().includes('mini-tts')) {
  log(`🎯 Detected steerable model - adding instructions`, 'cyan');
  testPayload.instructions = 'Speak clearly and naturally, as if testing a microphone.';
}

log('\n📤 Sending test request...', 'yellow');

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': config_values.apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(testPayload)
  });

  log(`\n📥 Response status: ${response.status} ${response.statusText}`,
      response.ok ? 'green' : 'red');

  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);

    log(`\n${checkmark()} Success! Audio generated successfully`, 'green');
    log(`   Size: ${sizeKB} KB`, 'green');
    log(`   Format: ${config_values.format}`, 'green');

    log('\n✅ Your Azure OpenAI TTS configuration is working correctly!', 'bold');
    log('\n💡 Next steps:', 'cyan');
    log('   1. If running locally: Restart your dev server (npm run dev)', 'reset');
    log('   2. If deployed: Add these env vars to Cloudflare Pages settings', 'reset');
    log('      → Settings → Environment variables → Production', 'reset');

  } else {
    const errorText = await response.text();
    log(`\n${xmark()} Request failed`, 'red');
    log('\n📄 Error details:', 'yellow');

    try {
      const errorJson = JSON.parse(errorText);
      console.log(JSON.stringify(errorJson, null, 2));

      // Provide specific guidance based on error
      if (errorJson.error?.code === 'DeploymentNotFound') {
        log('\n🔍 Deployment not found. Common issues:', 'yellow');
        log('   • Deployment name must match EXACTLY what you created in Azure', 'reset');
        log('   • Check: Azure Portal → Azure OpenAI → Deployments', 'reset');
        log(`   • Current value: "${config_values.deployment}"`, 'cyan');
      } else if (errorJson.error?.code === 'PermissionDenied' || response.status === 401) {
        log('\n🔑 Authentication failed. Check:', 'yellow');
        log('   • API key is correct and not expired', 'reset');
        log('   • Key matches the resource where deployment exists', 'reset');
      } else if (response.status === 404) {
        log('\n🔍 Endpoint not found. Check:', 'yellow');
        log('   • Endpoint URL format: https://YOUR-RESOURCE.openai.azure.com', 'reset');
        log('   • API version is valid for your region', 'reset');
        log(`   • Current endpoint: ${config_values.endpoint}`, 'cyan');
      }

    } catch {
      log(errorText, 'red');
    }

    process.exit(1);
  }

} catch (error) {
  log(`\n${xmark()} Connection error`, 'red');
  log(`   ${error.message}`, 'red');

  if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
    log('\n🌐 Network/DNS issue. Check:', 'yellow');
    log('   • Internet connectivity', 'reset');
    log('   • Endpoint URL is correct', 'reset');
    log('   • No firewall blocking Azure endpoints', 'reset');
  }

  process.exit(1);
}

header('Diagnostic Complete');
