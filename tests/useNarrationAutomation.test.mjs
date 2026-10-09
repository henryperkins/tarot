import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getCanAutoNarrate,
  getAutoNarrationReadingKey
} from '../src/hooks/useNarrationAutomation.js';

describe('getCanAutoNarrate', () => {
  test('leaves completed ElevenLabs and Deepgram narration to ReadingContext', () => {
    for (const ttsProvider of ['elevenlabs', 'deepgram']) {
      const result = getCanAutoNarrate({
        voiceOn: true,
        autoNarrate: true,
        narrativePhase: 'complete',
        isReadingStreaming: false,
        autoNarrationTriggered: false,
        ttsProvider
      });

      assert.equal(result, false);
    }
  });

  test('blocks auto narration while streaming or after a previous trigger', () => {
    assert.equal(getCanAutoNarrate({
      voiceOn: true,
      autoNarrate: true,
      narrativePhase: 'complete',
      isReadingStreaming: true,
      autoNarrationTriggered: false,
      ttsProvider: 'elevenlabs'
    }), false);

    assert.equal(getCanAutoNarrate({
      voiceOn: true,
      autoNarrate: true,
      narrativePhase: 'complete',
      isReadingStreaming: false,
      autoNarrationTriggered: true,
      ttsProvider: 'deepgram'
    }), false);

  });
});

describe('getAutoNarrationReadingKey', () => {
  test('prefers explicit reading identity when present', () => {
    const key = getAutoNarrationReadingKey({
      readingIdentity: 'threeCard:abc123:3',
      personalReading: {
        requestId: 'req-1',
        normalized: 'streaming text'
      }
    });

    assert.equal(key, 'identity:threeCard:abc123:3');
  });

  test('falls back to requestId when reading identity is missing', () => {
    const key = getAutoNarrationReadingKey({
      readingIdentity: '',
      personalReading: {
        requestId: 'req-42',
        normalized: 'streaming text'
      }
    });

    assert.equal(key, 'request:req-42');
  });

  test('returns a stable non-content key when reading has no id', () => {
    const keyA = getAutoNarrationReadingKey({
      personalReading: { normalized: 'partial chunk one' }
    });
    const keyB = getAutoNarrationReadingKey({
      personalReading: { normalized: 'partial chunk two' }
    });

    assert.equal(keyA, '__reading_present__');
    assert.equal(keyB, '__reading_present__');
  });
});
