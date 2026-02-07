import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findNarrationBreakIndex,
  shouldFlushNarrationBuffer,
  shouldScheduleAutoNarration,
  STREAM_AUTO_NARRATE_DEBOUNCE_MS
} from '../src/lib/narrationStream.js';

describe('narration stream chunking', () => {
  it('prefers a sentence boundary over a raw hard cut', () => {
    const text = 'The opening settles your breath and lets the first symbol come into focus with calm attention and care while the room grows quieter and your attention deepens. The cards then reveal a second layer of meaning that should stay for later.';
    const maxIndex = 170;

    const cutIndex = findNarrationBreakIndex(text, maxIndex, { minChars: 120 });
    const chunk = text.slice(0, cutIndex);

    assert.ok(chunk.endsWith('.'));
    assert.ok(cutIndex < maxIndex);
  });

  it('does not treat abbreviation periods as sentence stops', () => {
    const text = 'Dr. Luna watches the table quietly while each card is placed with patience and care before the final insight arrives.';
    const cutIndex = findNarrationBreakIndex(text, 45, { minChars: 20 });

    assert.ok(cutIndex > 3, 'cut should not stop after "Dr."');
  });

  it('can look ahead briefly for punctuation to avoid mid-sentence cuts', () => {
    const text = 'The opening thread keeps unfolding through symbols and mirrored positions while your focus follows one breath after another and the pattern keeps widening toward a complete thought that resolves just beyond the hard limit before a natural stop appears.';
    const cutIndex = findNarrationBreakIndex(text, 180, { minChars: 120 });
    const chunk = text.slice(0, cutIndex);

    assert.ok(cutIndex > 180, 'cut should extend past hard cap when punctuation is nearby');
    assert.ok(cutIndex <= 260, 'lookahead should stay bounded');
    assert.ok(chunk.endsWith('.'));
  });

  it('allows the first chunk to flush early when a natural stop appears', () => {
    const buffer = 'The tone softens and your focus settles into the spread as each position starts to speak with clarity and calm while the opening images settle into place for your first reflection.';

    const shouldFlush = shouldFlushNarrationBuffer({
      buffer,
      force: false,
      narrationStarted: false,
      minWords: 18,
      minChars: 120,
      targetChars: 220,
      maxChars: 300
    });

    assert.equal(shouldFlush, true);
    assert.ok(buffer.length >= 120 && buffer.length < 220);
  });

  it('holds the first chunk if minimum word count is not met', () => {
    const buffer = 'Longwordone longwordtwo longwordthree longwordfour longwordfive longwordsix longwordseven longwordeight longwordnine longwordten longwordeleven.';

    const shouldFlush = shouldFlushNarrationBuffer({
      buffer,
      force: false,
      narrationStarted: false,
      minWords: 18,
      minChars: 120,
      targetChars: 220,
      maxChars: 300
    });

    assert.equal(shouldFlush, false);
  });
});

describe('auto-narration debounce scheduling', () => {
  it('uses the unified 900ms auto-narration debounce', () => {
    assert.equal(STREAM_AUTO_NARRATE_DEBOUNCE_MS, 900);
  });

  const baseOptions = {
    voiceOn: true,
    autoNarrate: true,
    isReadingStreaming: true,
    isPersonalReadingError: false,
    autoNarrationTriggered: false,
    ttsProvider: 'hume',
    ttsStatus: 'idle'
  };

  it('schedules once streaming text has enough words', () => {
    const shouldSchedule = shouldScheduleAutoNarration({
      ...baseOptions,
      narrativeText: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo'
    });

    assert.equal(shouldSchedule, true);
  });

  it('does not schedule while narration is already busy', () => {
    const shouldSchedule = shouldScheduleAutoNarration({
      ...baseOptions,
      narrativeText: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo',
      ttsStatus: 'playing'
    });

    assert.equal(shouldSchedule, false);
  });
});
