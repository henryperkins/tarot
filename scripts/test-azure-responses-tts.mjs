#!/usr/bin/env node
/**
 * Test Azure OpenAI Responses API TTS (gpt-4o-mini-tts)
 *
 * Run:
 *   AZURE_OPENAI_ENDPOINT=... \
 *   AZURE_OPENAI_API_KEY=... \
 *   AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT=... \
 *   node scripts/test-azure-responses-tts.mjs
 *
 * Optional:
 *   AZURE_OPENAI_RESPONSES_API_VERSION=v1
 *   AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT=mp3
 *   AZURE_OPENAI_TTS_VOICE=alloy
 *   AZURE_OPENAI_TTS_SPEED=1.0
 *   AZURE_OPENAI_TTS_TEXT="Hello from Azure Responses TTS"
 *   AZURE_OPENAI_TTS_OUTFILE="speech.mp3"
 *
 * If Responses audio fields are rejected, the script falls back to /audio/speech.
 */

import { writeFileSync } from 'node:fs';

function normalizeAzureEndpoint(rawEndpoint) {
  return String(rawEndpoint || '')
    .replace(/\/+$/, '')
    .replace(/\/openai\/v1\/?$/, '')
    .replace(/\/openai\/?$/, '');
}

function getAzureResponsesUrl(endpoint, apiVersion) {
  return `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;
}

function getAzureAudioSpeechUrl({ endpoint, deployment, useV1Format, apiVersion }) {
  if (useV1Format) {
    return `${endpoint}/openai/v1/audio/speech?api-version=preview`;
  }
  return `${endpoint}/openai/deployments/${deployment}/audio/speech?api-version=${encodeURIComponent(apiVersion)}`;
}

function extractOutputAudio(data) {
  if (!Array.isArray(data?.output)) return null;

  for (const block of data.output) {
    const pieces = Array.isArray(block?.content) ? block.content : [];
    for (const piece of pieces) {
      if (piece?.type === 'output_audio' && piece?.data) {
        return { data: piece.data, transcript: piece.transcript || null };
      }
    }
  }

  return null;
}

const endpoint = normalizeAzureEndpoint(process.env.AZURE_OPENAI_ENDPOINT);
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT;
const responsesApiVersion = process.env.AZURE_OPENAI_TTS_RESPONSES_API_VERSION
  || process.env.AZURE_OPENAI_RESPONSES_API_VERSION
  || process.env.AZURE_OPENAI_API_VERSION
  || 'v1';
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';
const format = process.env.AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT || 'mp3';
const voice = process.env.AZURE_OPENAI_TTS_VOICE || 'alloy';
const speed = process.env.AZURE_OPENAI_TTS_SPEED ? Number(process.env.AZURE_OPENAI_TTS_SPEED) : undefined;
const text = process.env.AZURE_OPENAI_TTS_TEXT || 'Hi! This is a test of Azure Responses API text-to-speech.';
const outFile = process.env.AZURE_OPENAI_TTS_OUTFILE || `speech-responses.${format}`;
const useV1Format = (process.env.AZURE_OPENAI_USE_V1_FORMAT || '').trim().toLowerCase() === 'true';

console.log('🔍 Testing Azure OpenAI Responses TTS\n');
console.log('Configuration:');
console.log('- Endpoint:', endpoint ? '✓ Set' : '✗ Missing');
console.log('- API Key:', apiKey ? '✓ Set' : '✗ Missing');
console.log('- Deployment:', deployment ? `✓ ${deployment}` : '✗ Missing');
console.log('- Responses API Version:', responsesApiVersion);
console.log('- Output format:', format);
console.log('- Voice:', voice);
console.log('- Speed:', Number.isFinite(speed) ? speed : '(default)');
console.log('- Output file:', outFile);

if (!endpoint || !apiKey || !deployment) {
  console.error('\n❌ Missing required environment variables');
  console.error('Required: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT');
  process.exit(1);
}

const responsesUrl = getAzureResponsesUrl(endpoint, responsesApiVersion);
const responsesBody = {
  model: deployment,
  input: text,
  instructions: 'Speak clearly and naturally, as a calm tarot guide.',
  modalities: ['audio'],
  audio: { format, voice }
};

if (Number.isFinite(speed)) {
  responsesBody.audio.speed = speed;
}

console.log('\n📡 Attempting /openai/v1/responses...\n');

try {
  const response = await fetch(responsesUrl, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(responsesBody)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${responseText.slice(0, 1000)}`);
  }

  const data = JSON.parse(responseText);
  const outputAudio = extractOutputAudio(data);

  if (!outputAudio?.data) {
    throw new Error('No output_audio found in response.output');
  }

  writeFileSync(outFile, Buffer.from(outputAudio.data, 'base64'));
  console.log('✅ Wrote', outFile);
  if (outputAudio.transcript) {
    console.log('Transcript:', outputAudio.transcript);
  }
  process.exit(0);
} catch (error) {
  console.warn('⚠️  Responses TTS failed:', error?.message || error);
  console.warn('↪ Falling back to /audio/speech...\n');
}

const speechUrl = getAzureAudioSpeechUrl({ endpoint, deployment, useV1Format, apiVersion });
const speechBody = {
  model: deployment,
  input: text,
  voice,
  response_format: format
};

if (Number.isFinite(speed)) {
  speechBody.speed = speed;
}

if (/gpt-4o|mini-tts|audio-preview/i.test(deployment)) {
  speechBody.instructions = 'Speak clearly and naturally, as a calm tarot guide.';
}

try {
  const response = await fetch(speechUrl, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(speechBody)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`❌ /audio/speech failed: HTTP ${response.status} ${response.statusText}`);
    console.error(errText.slice(0, 2000));
    process.exit(1);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outFile, audioBuffer);
  console.log('✅ Wrote', outFile);
} catch (error) {
  console.error('❌ Error:', error?.message || error);
  process.exit(1);
}

