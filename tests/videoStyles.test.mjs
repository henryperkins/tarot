import test from 'node:test';
import assert from 'node:assert/strict';
import { VIDEO_STYLE_PRESETS } from '../shared/vision/videoStyles.js';
import { VIDEO_STYLES } from '../functions/lib/videoPrompts.js';

test('video style presets match backend config keys', () => {
  const presetIds = VIDEO_STYLE_PRESETS.map((style) => style.id).sort();
  const promptIds = Object.keys(VIDEO_STYLES).sort();
  assert.deepEqual(presetIds, promptIds);
});
