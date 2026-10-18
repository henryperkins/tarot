export const DEFAULT_NARRATION_PROVIDER = 'deepgram';

export const NARRATION_PROVIDERS = Object.freeze([
  Object.freeze({ id: 'elevenlabs', label: 'ElevenLabs', description: 'Eleven v4' }),
  Object.freeze({ id: 'deepgram', label: 'Deepgram', description: 'Aura-2' })
]);

export function normalizeTtsProvider(value) {
  if (value === 'workers-ai-aura-2') return 'deepgram';
  return isServerNarrationProvider(value) ? value : DEFAULT_NARRATION_PROVIDER;
}

export function isServerNarrationProvider(value) {
  return NARRATION_PROVIDERS.some(provider => provider.id === value);
}
