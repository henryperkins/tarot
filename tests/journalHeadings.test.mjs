import assert from 'node:assert/strict';
import { test } from 'node:test';

import { remarkJournalHeadings } from '../src/components/journal/entry-card/journalHeadings.js';

test('a follow-up heading becomes a section heading under the entry title', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Start over' }] },
      { type: 'paragraph', children: [] },
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Next' }] }
    ]
  };
  remarkJournalHeadings()(tree);
  assert.deepEqual(tree.children.map((node) => node.depth ?? null), [4, null, 5]);
});
