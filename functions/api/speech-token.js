import { jsonResponse } from '../lib/utils.js';

const retired = () => jsonResponse({
  error: 'Azure narration has been retired. Choose ElevenLabs or Deepgram.',
  errorCode: 'SPEECH_PROVIDER_RETIRED'
}, { status: 410 });

export const onRequestGet = retired;
export const onRequestPost = retired;
