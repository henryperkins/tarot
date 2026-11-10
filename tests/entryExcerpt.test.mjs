import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEntryExcerpt,
  shortSpreadName
} from '../src/lib/journal/entryExcerpt.js';

describe('journal entry metadata helpers', () => {
  describe('shortSpreadName', () => {
    it('strips trailing parenthetical position summaries while preserving plain names', () => {
      assert.equal(shortSpreadName('Three-Card Story (Past · Present · Future)'), 'Three-Card Story');
      assert.equal(shortSpreadName('Celtic Cross'), 'Celtic Cross');
      assert.equal(shortSpreadName(''), '');
    });
  });

  describe('buildEntryExcerpt', () => {
    it('prioritizes the reader reflection over the narrative prose', () => {
      const excerpt = buildEntryExcerpt(
        [['Whole reading', '  Saying no to Thursday\n\nopened space to think.  ']],
        '## Opening\n\nA long narrative paragraph.',
        'What needs space?'
      );
      assert.deepEqual(excerpt, {
        kind: 'reflection',
        label: 'Whole reading',
        text: 'Saying no to Thursday opened space to think.'
      });
    });

    it('extracts clean opening prose from Markdown narratives while skipping headings and rules', () => {
      const narrative = [
        '## Stepping back from noise',
        '',
        '---',
        '',
        '> Protect a **sustainable boundary** with `quiet-time` and [clarity](https://example.com).',
        '',
        '## Next chapter',
        'Later paragraph that should not be merged past the heading.'
      ].join('\n');

      const excerpt = buildEntryExcerpt([], narrative, 'What deserves space?');
      assert.deepEqual(excerpt, {
        kind: 'narrative',
        text: 'Protect a sustainable boundary with quiet-time and clarity.'
      });
    });

    it('skips an opening line that merely repeats the entry question', () => {
      const narrative = [
        'What deserves space this week?',
        'The Hermit invites one unhurried evening before deciding.'
      ].join('\n');

      const excerpt = buildEntryExcerpt([], narrative, 'What deserves space this week?');
      assert.deepEqual(excerpt, {
        kind: 'narrative',
        text: 'The Hermit invites one unhurried evening before deciding.'
      });
    });

    it('ignores fenced code blocks and returns null when no prose or reflection exists', () => {
      assert.equal(buildEntryExcerpt([], '```md\nhidden\n```\n---', ''), null);
      assert.equal(buildEntryExcerpt([], '', ''), null);
    });

    it('truncates long reflections and narratives cleanly with an ellipsis', () => {
      const longNote = 'Steady reflection '.repeat(20);
      const excerpt = buildEntryExcerpt([['Past · The Hermit', longNote]], '');
      assert.equal(excerpt.kind, 'reflection');
      assert.ok(excerpt.text.endsWith('…'));
      assert.ok(excerpt.text.length <= 221);
    });
  });
});
