import { jsonResponse } from '../../lib/utils.js';
import { onRequestGet as tarotReadingHealth } from '../tarot-reading.js';

export const onRequestGet = async (context) => {
  try {
    if (typeof tarotReadingHealth === 'function') {
      return await tarotReadingHealth(context);
    }
  } catch (error) {
    console.warn('Tarot reading health check failed, returning fallback payload:', error);
  }

  return jsonResponse({ status: 'ok', provider: 'local-fallback', timestamp: new Date().toISOString() });
};

export const onRequestPost = () => jsonResponse({ error: 'Not supported.' }, { status: 405 });
