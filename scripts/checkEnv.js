#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ensureModalConfig, MODAL_DEFAULT_MODEL } from '../functions/lib/modalChatCompletions.js';

// NOTE: The app can run with local fallbacks when these are missing.
// This script is intended to help you verify that AI-powered features and
// integration tests have the credentials they need.

const REQUIRED_FOR_OPENAI_READINGS = [
  'OPENAI_API_KEY'
];

const REQUIRED_FOR_MODAL_READINGS = [
  'MODAL_ENDPOINT_URL'
];

const MODAL_PROXY_TOKEN_PAIR = [
  'MODAL_PROXY_TOKEN_ID',
  'MODAL_PROXY_TOKEN_SECRET'
];

const MODAL_CREDENTIALS = [...MODAL_PROXY_TOKEN_PAIR, 'MODAL_PROXY_TOKEN'];

const OPTIONAL_FOR_MODAL_READINGS = [
  'MODAL_MODEL',
  'MODAL_REASONING_EFFORT',
  'MODAL_STREAM',
  'MODAL_TEMPERATURE',
  'MODAL_TOP_P',
  'MODAL_TIMEOUT_MS'
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

const REQUIRED_FOR_CLAUDE_API = [
  'ANTHROPIC_API_KEY'
];

const OPTIONAL_FOR_CLAUDE_API = [
  'ANTHROPIC_MODEL',
  'ANTHROPIC_EFFORT',
  'ANTHROPIC_TIMEOUT_MS'
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

function stripJsonComments(content) {
  let output = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      } else if (char === '\n') {
        output += char;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
    } else if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
    } else {
      output += char;
    }
  }

  return output;
}

function stripTrailingCommas(content) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ',') {
      let lookahead = index + 1;
      while (/\s/.test(content[lookahead] || '')) lookahead += 1;
      if (content[lookahead] === '}' || content[lookahead] === ']') {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function parseWranglerVars(filePath) {
  if (!fs.existsSync(filePath)) return {};

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(stripTrailingCommas(stripJsonComments(content)));
    const vars = parsed?.vars;
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return {};

    return Object.fromEntries(
      Object.entries(vars)
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => [key, String(value)])
    );
  } catch (error) {
    console.warn(`Warning: unable to parse ${path.basename(filePath)}: ${error.message}`);
    return {};
  }
}

function resolveVariable(key, envVars, fileVars, wranglerVars = {}) {
  const fromProcess = envVars[key];
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return { value: fromProcess, source: 'process.env' };
  }
  const fromFile = fileVars[key];
  if (typeof fromFile === 'string' && fromFile.trim().length > 0) {
    return { value: fromFile, source: '.dev.vars' };
  }
  const fromWrangler = wranglerVars[key];
  if (typeof fromWrangler === 'string' && fromWrangler.trim().length > 0) {
    return { value: fromWrangler, source: 'wrangler.jsonc' };
  }
  return null;
}

function resolveValue(key, envVars, fileVars, wranglerVars = {}) {
  return resolveVariable(key, envVars, fileVars, wranglerVars)?.value ?? null;
}

function isTruthyFlag(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function run() {
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
  const wranglerConfigPath = path.resolve(process.cwd(), 'wrangler.jsonc');
  const fileVars = parseDevVars(devVarsPath);
  const wranglerVars = parseWranglerVars(wranglerConfigPath);
  const results = {};

  const modalInputs = {};
  for (const key of [...REQUIRED_FOR_MODAL_READINGS, ...MODAL_CREDENTIALS, ...OPTIONAL_FOR_MODAL_READINGS]) {
    const resolved = resolveVariable(key, process.env, fileVars, wranglerVars);
    results[key] = resolved;
    if (resolved) modalInputs[key] = resolved.value;
  }
  const modalPairDeclared = MODAL_PROXY_TOKEN_PAIR.some((key) =>
    [process.env, fileVars, wranglerVars].some((source) => Object.hasOwn(source, key))
  );
  const missingModalPair = MODAL_PROXY_TOKEN_PAIR.filter((key) => !results[key]);
  const incompleteModalPair = modalPairDeclared && missingModalPair.length > 0;
  if (modalPairDeclared) {
    for (const key of missingModalPair) modalInputs[key] = '';
  }
  let modalConfigured = false;
  let modalConfigurationError;
  try {
    ensureModalConfig(modalInputs);
    modalConfigured = true;
  } catch (error) {
    // The shared adapter reports only setting names, never credential values.
    modalConfigurationError = error.message;
  }

  const missingClaude = [];
  for (const key of REQUIRED_FOR_CLAUDE_API) {
    const resolved = resolveVariable(key, process.env, fileVars, wranglerVars);
    results[key] = resolved;
    if (!resolved) missingClaude.push(key);
  }
  const claudeConfigured = missingClaude.length === 0;

  const missingOpenAI = [];
  for (const key of REQUIRED_FOR_OPENAI_READINGS) {
    const resolved = resolveVariable(key, process.env, fileVars, wranglerVars);
    results[key] = resolved;
    if (!resolved) missingOpenAI.push(key);
  }
  const openAIConfigured = missingOpenAI.length === 0;

  const missingAzureFallback = [];
  for (const key of REQUIRED_FOR_AZURE_OPENAI_FALLBACK) {
    const resolved = resolveVariable(key, process.env, fileVars, wranglerVars);
    results[key] = resolved;
    if (!resolved) missingAzureFallback.push(key);
  }
  const azureFallbackConfigured = missingAzureFallback.length === 0;

  // Conditional: vision proof secret is only required when the vision UI is enabled.
  const visionEnabledValue = resolveValue('VITE_ENABLE_VISION_RESEARCH', process.env, fileVars, wranglerVars);
  const visionEnabled = isTruthyFlag(visionEnabledValue);
  const missingVision = [];
  if (visionEnabled) {
    for (const key of OPTIONAL_FOR_VISION_RESEARCH) {
      const resolved = resolveVariable(key, process.env, fileVars, wranglerVars);
      results[key] = resolved;
      if (!resolved) missingVision.push(key);
    }
  }

  console.log('🔐 Environment prerequisite check');
  console.log(`- Loaded ${Object.keys(fileVars).length} entries from ${path.basename(devVarsPath)}${fs.existsSync(devVarsPath) ? '' : ' (file not present)'}`);
  console.log(`- Loaded ${Object.keys(wranglerVars).length} non-secret vars from ${path.basename(wranglerConfigPath)}${fs.existsSync(wranglerConfigPath) ? '' : ' (file not present)'}`);

  console.log('\nAI-generated readings (Claude API, tried first):');
  for (const key of REQUIRED_FOR_CLAUDE_API) {
    const entry = results[key];
    if (entry) console.log(`✔ ${key} (${entry.source})`);
    else console.log(`• ${key} (not set)`);
  }

  console.log('\nClaude API optional settings:');
  for (const key of OPTIONAL_FOR_CLAUDE_API) {
    const entry = resolveVariable(key, process.env, fileVars, wranglerVars);
    if (entry) console.log(`• ${key} (${entry.source})`);
    else console.log(`• ${key} (not set)`);
  }

  console.log('\nAI-generated readings (Modal):');
  for (const key of [...MODAL_CREDENTIALS, ...REQUIRED_FOR_MODAL_READINGS]) {
    const entry = results[key];
    if (entry) console.log(`✔ ${key} (${entry.source})`);
    else console.log(`• ${key} (not set)`);
  }

  console.log('\nModal optional settings:');
  for (const key of OPTIONAL_FOR_MODAL_READINGS) {
    const entry = resolveVariable(key, process.env, fileVars, wranglerVars);
    if (entry) console.log(`• ${key} (${entry.source})`);
    else if (key === 'MODAL_MODEL') console.log(`• ${key} (default: ${MODAL_DEFAULT_MODEL})`);
    else console.log(`• ${key} (not set)`);
  }

  console.log('\nAI-generated readings (OpenAI native):');
  for (const key of REQUIRED_FOR_OPENAI_READINGS) {
    const entry = results[key];
    if (entry) console.log(`✔ ${key} (${entry.source})`);
    else console.log(`✖ ${key} (missing)`);
  }

  console.log('\nOpenAI native optional settings:');
  for (const key of OPTIONAL_FOR_OPENAI_READINGS) {
    const entry = resolveVariable(key, process.env, fileVars, wranglerVars);
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

  if (incompleteModalPair) {
    console.error('\nModal proxy token pair is incomplete. Set both MODAL_PROXY_TOKEN_ID and MODAL_PROXY_TOKEN_SECRET, or remove both to use the legacy MODAL_PROXY_TOKEN.');
    process.exitCode = 1;
    return;
  }

  if (modalConfigurationError && (modalPairDeclared || results.MODAL_PROXY_TOKEN)) {
    console.warn(`\nModal configuration unavailable: ${modalConfigurationError}`);
  }

  if (!claudeConfigured && !modalConfigured && !openAIConfigured && !azureFallbackConfigured) {
    console.error(`\nMissing AI reading provider credentials: ${REQUIRED_FOR_CLAUDE_API.join(', ')} (preferred), ${MODAL_PROXY_TOKEN_PAIR.join(' + ')} (or legacy MODAL_PROXY_TOKEN) with ${REQUIRED_FOR_MODAL_READINGS.join(', ')}, ${REQUIRED_FOR_OPENAI_READINGS.join(', ')}, or ${REQUIRED_FOR_AZURE_OPENAI_FALLBACK.join(', ')} (fallback).`);
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
      const entry = resolveVariable(flag, process.env, fileVars, wranglerVars);
      if (entry) {
        console.log(`• ${flag} (${entry.source})`);
      } else {
        console.log(`• ${flag} (not set)`);
      }
    });
  }

  if (OPTIONAL_FOR_AUTH.length > 0) {
    console.log('\nOptional: Auth0 social login variables:');
    OPTIONAL_FOR_AUTH.forEach((key) => {
      const entry = resolveVariable(key, process.env, fileVars, wranglerVars);
      if (entry) console.log(`• ${key} (${entry.source})`);
      else console.log(`• ${key} (not set)`);
    });
  }

  const activeProvider = claudeConfigured
    ? 'Claude API'
    : modalConfigured
      ? 'Modal'
      : (openAIConfigured ? 'OpenAI native' : 'Azure OpenAI fallback');
  console.log(`\nAll required environment variables for AI-generated readings are present (${activeProvider}). You are ready to run \`npm run dev\` 🙌`);
}

run();
