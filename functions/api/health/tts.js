import { jsonResponse } from '../../lib/utils.js';
import { onRequestGet as ttsHealth } from '../tts.js';

export const onRequestGet = async (context) => {
  try {
    if (typeof ttsHealth === 'function') {
      return await ttsHealth(context);
    }
  } catch (error) {
    console.warn('TTS health check failed, returning fallback payload:', error);
  }

  return jsonResponse({
    status: 'ok',
    provider: 'local-fallback',
    apiVersion: context?.env?.AZURE_OPENAI_API_VERSION ?? null,
    useV1Format: context?.env?.AZURE_OPENAI_USE_V1_FORMAT ?? null,
    format: context?.env?.AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT ?? null,
    timestamp: new Date().toISOString()
  });
};

export const onRequestPost = () => jsonResponse({ error: 'Not supported.' }, { status: 405 });
