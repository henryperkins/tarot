#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

// NOTE: The app can run with local fallbacks when these are missing.
// This script is intended to help you verify that AI-powered features and
// integration tests have the credentials they need.

const REQUIRED_FOR_OPENAI_READINGS = [
  'OPENAI_API_KEY'
];

const OPTIONAL_FOR_OPENAI_READINGS = [
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'OPENAI_STREAMING_ENABLED'
];

const REQUIRED_FOR_AZURE_OPENAI_FALLBACK = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_GPT5_MODEL'
];

const OPTIONAL_FOR_CLAUDE_FALLBACK = [
  'AZURE_ANTHROPIC_ENDPOINT',
  'AZURE_ANTHROPIC_API_KEY',
  'AZURE_ANTHROPIC_MODEL'
];

const OPTIONAL_FOR_TTS = [
  // TTS requires a deployment; endpoint/key may fall back to AZURE_OPENAI_*.
  'AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT',
  'AZURE_OPENAI_TTS_ENDPOINT',
  'AZURE_OPENAI_TTS_API_KEY',
  'AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT',
  'AZURE_OPENAI_USE_V1_FORMAT'
];

const OPTIONAL_FOR_VISION_RESEARCH = [
  'VISION_PROOF_SECRET'
];

const OPTIONAL_FLAGS = [
  'VITE_ENABLE_VISION_RESEARCH',
  'VITE_NEW_DECK_INTERFACE',
  'VITE_SYMBOL_DETECTOR_MODEL',
  'VISION_BACKEND_DEFAULT',
  'VISION_TIMEOUT_MS',
  'LOG_LLM_PROMPTS',
  'LOG_NARRATIVE_ENHANCEMENTS',
  'LOG_ENHANCEMENT_TELEMETRY',
  'GRAPHRAG_ENABLED',
  'ENABLE_PROMPT_SLIMMING',
  'DISABLE_QUALITY_FILTERING',
  'PERSIST_PROMPTS',
  'PROMPT_BUDGET_AZURE',
  'PROMPT_BUDGET_CLAUDE',
  'PROMPT_BUDGET_DEFAULT'
];

const OPTIONAL_FOR_AUTH = [
  'AUTH0_DOMAIN',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
  'AUTH0_AUDIENCE',
  'AUTH0_USERINFO_URL',
  'APP_URL'
];

function parseDevVars(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      if (!key) return acc;
      const rawValue = rest.join('=').trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      acc[key.trim()] = value;
      return acc;
    }, {});
}

function resolveVariable(key, envVars, fileVars) {
  const fromProcess = envVars[key];
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return { value: fromProcess, source: 'process.env' };
  }
  const fromFile = fileVars[key];
  if (typeof fromFile === 'string' && fromFile.trim().length > 0) {
    return { value: fromFile, source: '.dev.vars' };
  }
  return null;
}

function resolveValue(key, envVars, fileVars) {
  return resolveVariable(key, envVars, fileVars)?.value ?? null;
}

function isTruthyFlag(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function run() {
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
  const fileVars = parseDevVars(devVarsPath);
  const results = {};

  const missingOpenAI = [];
  for (const key of REQUIRED_FOR_OPENAI_READINGS) {
    const resolved = resolveVariable(key, process.env, fileVars);
    results[key] = resolved;
    if (!resolved) missingOpenAI.push(key);
  }
  const openAIConfigured = missingOpenAI.length === 0;

  const missingAzureFallback = [];
  for (const key of REQUIRED_FOR_AZURE_OPENAI_FALLBACK) {
    const resolved = resolveVariable(key, process.env, fileVars);
    results[key] = resolved;
    if (!resolved) missingAzureFallback.push(key);
  }
  const azureFallbackConfigured = missingAzureFallback.length === 0;

  // Conditional: vision proof secret is only required when the vision UI is enabled.
  const visionEnabledValue = resolveValue('VITE_ENABLE_VISION_RESEARCH', process.env, fileVars);
  const visionEnabled = isTruthyFlag(visionEnabledValue);
  const missingVision = [];
  if (visionEnabled) {
    for (const key of OPTIONAL_FOR_VISION_RESEARCH) {
      const resolved = resolveVariable(key, process.env, fileVars);
      results[key] = resolved;
      if (!resolved) missingVision.push(key);
    }
  }

  // Conditional: treat TTS as "wanted" if a deployment is set.
  const ttsDeployment = resolveValue('AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT', process.env, fileVars);
  const ttsEnabled = typeof ttsDeployment === 'string' && ttsDeployment.trim().length > 0;
  const missingTts = [];
  if (ttsEnabled) {
    // Deployment is already truthy here; check whether we have *some* endpoint+key.
    const endpoint = resolveValue('AZURE_OPENAI_TTS_ENDPOINT', process.env, fileVars)
      || resolveValue('AZURE_OPENAI_ENDPOINT', process.env, fileVars);
    const apiKey = resolveValue('AZURE_OPENAI_TTS_API_KEY', process.env, fileVars)
      || resolveValue('AZURE_OPENAI_API_KEY', process.env, fileVars);
    if (!endpoint) missingTts.push('AZURE_OPENAI_TTS_ENDPOINT (or AZURE_OPENAI_ENDPOINT)');
    if (!apiKey) missingTts.push('AZURE_OPENAI_TTS_API_KEY (or AZURE_OPENAI_API_KEY)');
  }

  console.log('🔐 Environment prerequisite check');
  console.log(`- Loaded ${Object.keys(fileVars).length} entries from ${path.basename(devVarsPath)}${fs.existsSync(devVarsPath) ? '' : ' (file not present)'}`);

  console.log('\nAI-generated readings (OpenAI native):');
  for (const key of REQUIRED_FOR_OPENAI_READINGS) {
    const entry = results[key];
    if (entry) console.log(`✔ ${key} (${entry.source})`);
    else console.log(`✖ ${key} (missing)`);
  }

  console.log('\nOpenAI native optional settings:');
  for (const key of OPTIONAL_FOR_OPENAI_READINGS) {
    const entry = resolveVariable(key, process.env, fileVars);
    if (entry) console.log(`• ${key} (${entry.source})`);
    else console.log(`• ${key} (not set)`);
  }

  console.log('\nFallback: Azure OpenAI readings:');
  for (const key of REQUIRED_FOR_AZURE_OPENAI_FALLBACK) {
    const entry = results[key];
    if (entry) console.log(`✔ ${key} (${entry.source})`);
    else console.log(`• ${key} (not set)`);
  }

  if (visionEnabled) {
    console.log('\nVision research mode is ENABLED (VITE_ENABLE_VISION_RESEARCH=true):');
    for (const key of OPTIONAL_FOR_VISION_RESEARCH) {
      const entry = results[key];
      if (entry) console.log(`✔ ${key} (${entry.source})`);
      else console.log(`✖ ${key} (missing)`);
    }
  }

  if (ttsEnabled) {
    console.log('\nText-to-speech looks ENABLED (AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT set):');
    if (missingTts.length === 0) {
      console.log('✔ TTS endpoint/key appear configured (via AZURE_OPENAI_TTS_* or fallback to AZURE_OPENAI_*)');
    } else {
      console.log(`✖ Missing TTS prerequisites: ${missingTts.join(', ')}`);
    }
  }

  if (!openAIConfigured && !azureFallbackConfigured) {
    console.error(`\nMissing AI reading provider credentials: ${REQUIRED_FOR_OPENAI_READINGS.join(', ')} (preferred) or ${REQUIRED_FOR_AZURE_OPENAI_FALLBACK.join(', ')} (fallback).`);
    console.error('Populate .dev.vars (or export env vars) to enable AI-generated readings.');
    console.error('Note: `npm run dev` will still run, but API-powered features may fall back to local generators.');
    process.exitCode = 1;
    return;
  }

  if (missingVision.length > 0) {
    console.error(`\nMissing vision prerequisites: ${missingVision.join(', ')}`);
    console.error('Populate .dev.vars (or export env vars) to use vision research mode.');
    process.exitCode = 1;
    return;
  }

  if (OPTIONAL_FLAGS.length > 0) {
    console.log('\nOptional flags (set as needed):');
    OPTIONAL_FLAGS.forEach((flag) => {
      const entry = resolveVariable(flag, process.env, fileVars);
      if (entry) {
        console.log(`• ${flag} (${entry.source})`);
      } else {
        console.log(`• ${flag} (not set)`);
      }
    });
  }

  if (OPTIONAL_FOR_CLAUDE_FALLBACK.length > 0) {
    console.log('\nOptional: Claude fallback (Azure AI Foundry Anthropic):');
    OPTIONAL_FOR_CLAUDE_FALLBACK.forEach((key) => {
      const entry = resolveVariable(key, process.env, fileVars);
      if (entry) console.log(`• ${key} (${entry.source})`);
      else console.log(`• ${key} (not set)`);
    });
  }

  if (OPTIONAL_FOR_AUTH.length > 0) {
    console.log('\nOptional: Auth0 social login variables:');
    OPTIONAL_FOR_AUTH.forEach((key) => {
      const entry = resolveVariable(key, process.env, fileVars);
      if (entry) console.log(`• ${key} (${entry.source})`);
      else console.log(`• ${key} (not set)`);
    });
  }

  if (OPTIONAL_FOR_TTS.length > 0) {
    console.log('\nOptional: Azure OpenAI TTS variables:');
    OPTIONAL_FOR_TTS.forEach((key) => {
      const entry = resolveVariable(key, process.env, fileVars);
      if (entry) console.log(`• ${key} (${entry.source})`);
      else console.log(`• ${key} (not set)`);
    });
  }

  const activeProvider = openAIConfigured ? 'OpenAI native' : 'Azure OpenAI fallback';
  console.log(`\nAll required environment variables for AI-generated readings are present (${activeProvider}). You are ready to run \`npm run dev\` 🙌`);
}

run();
