import { DEFAULT_NARRATION_PROVIDER } from '../../shared/narrationProviders.js';

export const AURA_MODEL = '@cf/deepgram/aura-2-en';
export const AURA_VOICE = 'cora';

// Safe metadata used by the status endpoint, synthesis and the admin inventory.
export function getNarrationConfiguration(env, id = DEFAULT_NARRATION_PROVIDER) {
  if (id === 'elevenlabs') {
    return { id, available: typeof env?.ELEVENLABS_API_KEY === 'string' && Boolean(env.ELEVENLABS_API_KEY.trim()),
      model: env?.ELEVENLABS_MODEL_ID?.trim() || 'eleven_v4',
      voice: env?.ELEVENLABS_VOICE_ID?.trim() || 'EXAVITQu4vr4xnSDxMaL' };
  }
  return { id: 'deepgram', available: typeof env?.AI?.run === 'function', model: AURA_MODEL, voice: AURA_VOICE };
}
