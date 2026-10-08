export const NARRATION_PROVIDERS = Object.freeze([
  Object.freeze({ id: 'elevenlabs', label: 'ElevenLabs', description: 'Eleven v4' }),
  Object.freeze({ id: 'deepgram', label: 'Deepgram', description: 'Aura-2' })
]);

export function normalizeTtsProvider(value) {
  return value === 'deepgram' || value === 'workers-ai-aura-2' ? 'deepgram' : 'elevenlabs';
}

export function isServerNarrationProvider(value) {
  return NARRATION_PROVIDERS.some(provider => provider.id === value);
}
