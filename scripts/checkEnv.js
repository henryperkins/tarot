#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECRETS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_GPT5_MODEL',
  'AZURE_OPENAI_TTS_ENDPOINT',
  'AZURE_OPENAI_TTS_API_KEY',
  'AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT',
  'VISION_PROOF_SECRET',
  'ANTHROPIC_API_KEY'
];

const OPTIONAL_FLAGS = [
  'VITE_ENABLE_VISION_RESEARCH',
  'LOG_LLM_PROMPTS',
  'LOG_ENHANCEMENT_TELEMETRY',
  'PROMPT_BUDGET_AZURE',
  'PROMPT_BUDGET_CLAUDE',
  'PROMPT_BUDGET_DEFAULT'
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

function run() {
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
  const fileVars = parseDevVars(devVarsPath);
  const results = {};

  const missing = [];
  for (const key of REQUIRED_SECRETS) {
    const resolved = resolveVariable(key, process.env, fileVars);
    results[key] = resolved;
    if (!resolved) {
      missing.push(key);
    }
  }

  console.log('🔐 Environment prerequisite check');
  console.log(`- Loaded ${Object.keys(fileVars).length} entries from ${path.basename(devVarsPath)}${fs.existsSync(devVarsPath) ? '' : ' (file not present)'}`);

  for (const [key, entry] of Object.entries(results)) {
    if (entry) {
      console.log(`✔ ${key} (${entry.source})`);
    } else {
      console.log(`✖ ${key} (missing)`);
    }
  }

  if (missing.length > 0) {
    console.error('\nMissing required secrets:', missing.join(', '));
    console.error('Populate .dev.vars (or export env vars) before running dev.sh.');
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

  console.log('\nAll required environment variables are present. You are ready to run dev.sh 🙌');
}

run();
