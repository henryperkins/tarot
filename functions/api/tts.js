/**
 * Cloudflare Pages Function that provides text-to-speech audio as a data URI.
 *
 * Enhanced with gpt-4o-mini-tts steerable instructions for context-aware,
 * mystical tarot reading narration.
 *
 * Supports:
 * - Context-specific instruction templates (card-reveal, full-reading, synthesis)
 * - Voice selection (nova, shimmer, alloy, echo, fable, onyx)
 * - Speed control for contemplative pacing
 * - Graceful fallback to local waveform
 */
export const onRequestPost = async ({ request, env }) => {
  try {
    const { text, context, voice } = await readJson(request);
    const sanitizedText = sanitizeText(text);

    if (!sanitizedText) {
      return jsonResponse(
        { error: 'The "text" field is required.' },
        { status: 400 }
      );
    }

    // Primary: Azure OpenAI gpt-4o-mini-tts with steerable instructions
    if (env?.AZURE_OPENAI_ENDPOINT && env?.AZURE_OPENAI_API_KEY && env?.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT) {
      try {
        const audio = await generateWithAzureGptMiniTTS(env, {
          text: sanitizedText,
          context: context || 'default',
          voice: voice || 'nova'
        });
        if (audio) {
          return jsonResponse({ audio, provider: 'azure-gpt-4o-mini-tts' });
        }
      } catch (error) {
        console.error('Azure OpenAI gpt-4o-mini-tts failed, falling back to local waveform:', error);
      }
    }

    // Fallback: local synthesized waveform (no external dependency).
    const fallbackAudio = generateFallbackWaveform(sanitizedText);
    return jsonResponse({ audio: fallbackAudio, provider: 'fallback' });
  } catch (error) {
    console.error('tts function error:', error);
    return jsonResponse(
      { error: 'Unable to generate audio at this time.' },
      { status: 500 }
    );
  }
};

async function readJson(request) {
  if (request.headers.get('content-length') === '0') {
    return {};
  }

  const text = await request.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, 4000); // Increased for full readings; gpt-4o-mini-tts handles longer text well
}

/**
 * Steerable instruction templates for different tarot reading contexts.
 * These leverage gpt-4o-mini-tts's ability to control tone, pacing, and delivery style.
 */
const INSTRUCTION_TEMPLATES = {
  'card-reveal': `Speak gently and mystically, as a tarot reader revealing a single card with reverence.
    Use a slightly slower pace with brief pauses after the card name and orientation.
    Convey wisdom and contemplation in your tone.`,

  'full-reading': `Speak as a wise, compassionate tarot reader sharing a complete reading.
    Use a thoughtful, contemplative tone with natural pauses between card descriptions and themes.
    Allow space for reflection—speak slowly and deliberately, as if sitting across from the querent.
    Convey mystical depth while remaining grounded and accessible.
    Maintain a gentle, trauma-informed presence throughout.`,

  'synthesis': `Speak as a tarot reader weaving together the threads of a reading into cohesive guidance.
    Use a flowing, storytelling cadence that connects themes and patterns.
    Pause briefly between major insights to allow integration.
    Convey both wisdom and warmth, emphasizing agency and empowerment.`,

  'question': `Speak gently and clearly, acknowledging the querent's question with respect.
    Use a warm, inviting tone that creates space for exploration rather than fixed answers.`,

  'reflection': `Speak softly and affirmingly, honoring the querent's personal reflections.
    Use a validating, supportive tone that acknowledges their intuitive insights.`,

  'default': `Speak thoughtfully and gently, as a tarot reader sharing wisdom.
    Use a mystical yet grounded tone with natural pacing and slight pauses for contemplation.`
};

/**
 * Enhanced Azure OpenAI gpt-4o-mini-tts generation with steerable instructions.
 *
 * Leverages the model's unique ability to control not just what is said, but HOW it's said,
 * creating context-appropriate narration for tarot readings.
 */
async function generateWithAzureGptMiniTTS(env, { text, context, voice }) {
  // Azure OpenAI gpt-4o-mini-tts endpoint structure:
  // POST {endpoint}/openai/deployments/{deploymentName}/audio/speech?api-version=2025-04-01-preview
  //
  // Required env vars:
  // - AZURE_OPENAI_ENDPOINT: https://YOUR-RESOURCE.openai.azure.com
  // - AZURE_OPENAI_API_KEY: API key for the Azure OpenAI resource
  // - AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT: deployment name (e.g., "gpt-4o-mini-tts")
  //
  // Returns audio as base64 data URI.

  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '');
  const deployment = env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT;
  const apiVersion = env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';
  const format = env.AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT || 'mp3';

  // Select instruction template based on context
  const instructions = INSTRUCTION_TEMPLATES[context] || INSTRUCTION_TEMPLATES.default;

  // Voice validation
  const validVoices = ['nova', 'shimmer', 'alloy', 'echo', 'fable', 'onyx'];
  const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

  const url = `${endpoint}/openai/deployments/${deployment}/audio/speech?api-version=${apiVersion}`;

  // Build payload - compatible with both tts-1/tts-1-hd and gpt-4o-mini-tts
  const payload = {
    model: deployment,
    voice: selectedVoice,
    input: text
  };

  // Add response_format if specified
  if (format) {
    payload.response_format = format;
  }

  // Add speed control (supported by all TTS models)
  payload.speed = 0.95; // Slightly slower for contemplative tarot reading pace

  // Check if this deployment supports steerable instructions
  // gpt-4o-mini-tts and similar models support instructions
  // tts-1 and tts-1-hd do NOT support instructions
  const isSteerableModel = deployment.toLowerCase().includes('gpt-4o') ||
                          deployment.toLowerCase().includes('mini-tts') ||
                          deployment.toLowerCase().includes('audio-preview');

  if (isSteerableModel) {
    // KEY FEATURE: Steerable tone and delivery (gpt-4o-mini-tts only)
    payload.instructions = instructions;
  }
  // If not a steerable model (tts-1/tts-1-hd), instructions are omitted to avoid errors

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': env.AZURE_OPENAI_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure gpt-4o-mini-tts error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));
  const mime = format === 'wav' ? 'audio/wav' : `audio/${format}`;
  return `data:${mime};base64,${base64}`;
}


/**
 * Generates a simple sine-wave audio clip encoded as a WAV data URI.
 * While this is not true speech, it provides audible feedback so the app's
 * audio pathway remains functional without external services.
 */
function generateFallbackWaveform(text) {
  const sampleRate = 22050;
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const durationSeconds = Math.min(6, Math.max(1.5, words * 0.55));
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const baseFrequency = 200 + Math.min(300, words * 40);
  const sweepFrequency = baseFrequency + Math.min(260, text.length);
  const amplitude = 0.4;

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 1, true); // Number of channels (mono)
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const dataView = new DataView(buffer, 44);
  for (let i = 0; i < totalSamples; i += 1) {
    const time = i / sampleRate;
    const sweep = baseFrequency + (sweepFrequency - baseFrequency) * (i / totalSamples);
    const envelope = Math.sin(Math.PI * Math.min(1, time / durationSeconds));
    const sample = Math.sin(2 * Math.PI * sweep * time) * amplitude * envelope;
    dataView.setInt16(i * 2, sample * 0x7fff, true);
  }

  const wavBytes = new Uint8Array(buffer);
  const base64Audio = uint8ToBase64(wavBytes);
  return `data:audio/wav;base64,${base64Audio}`;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Converts Uint8Array binary data into a base64 string using browser-compatible APIs.
 */
function uint8ToBase64(uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8Array).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });
}
