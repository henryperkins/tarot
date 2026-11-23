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
  assert.equal(tree.children[1].type, 'paragraph');
});

test('a passage without headings is left unchanged', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Rest.' }] }] };
  const before = JSON.stringify(tree);
  remarkJournalHeadings()(tree);
  assert.equal(JSON.stringify(tree), before);
});

test('a heading nested in a block is remapped and the surrounding text stays', () => {
  const tree = {
    type: 'root',
    children: [{
      type: 'blockquote',
      children: [
        { type: 'heading', depth: 3, children: [{ type: 'text', value: 'Inside' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Same' }] }
      ]
    }]
  };
  remarkJournalHeadings()(tree);
  assert.equal(tree.children[0].children[0].depth, 4);
  assert.equal(tree.children[0].children[1].children[0].value, 'Same');
});

test('heading depth stops at h6 for both saved readings and follow-up answers', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Opening' }] },
      { type: 'heading', depth: 6, children: [{ type: 'text', value: 'Detail' }] }
    ]
  };
  remarkJournalHeadings()(tree);
  assert.equal(tree.children[0].depth, 4);
  assert.equal(tree.children[1].depth, 6);
});
