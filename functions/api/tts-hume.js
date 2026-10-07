import { jsonResponse } from '../lib/utils.js';

// Older clients receive a typed retirement response without an allowance debit.
export const onRequestGet = () => jsonResponse({ provider: 'retired' }, { status: 410 });
export const onRequestPost = () => jsonResponse({ error: 'This narration option has been retired. Refresh the page to use reader voice.', errorCode: 'TTS_RETIRED' }, { status: 410 });
