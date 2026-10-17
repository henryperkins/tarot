import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getCanAutoNarrate,
  getAutoNarrationReadingKey
} from '../src/hooks/useNarrationAutomation.js';
import { normalizeTtsProvider } from '../src/lib/audio.js';

describe('getCanAutoNarrate', () => {
  test('reader voice completion stays owned by ReadingContext after preference migration', () => {
    for (const savedProvider of ['azure', 'azure-sdk', 'hume', 'reader-voice', null]) {
      assert.equal(getCanAutoNarrate({
        voiceOn: true,
        autoNarrate: true,
        narrativePhase: 'complete',
        isReadingStreaming: false,
        autoNarrationTriggered: false,
        ttsProvider: normalizeTtsProvider(savedProvider)
      }), false, 'Do not start a second narration from the narrative display');
    }
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
