import test from 'node:test';
import assert from 'node:assert/strict';

const context = async input => {
  const { buildReadingPersonalContext } = await import('../src/lib/readingPersonalContext.js');
  return buildReadingPersonalContext(input);
};

// A trimming/defaulting projection would lose the original question.
test('question survives without reflections', async () => {
  assert.deepEqual(await context({ question: '  How can I begin?\n' }), {
    question: '  How can I begin?\n', notes: []
  });
});

// Matching by name would collapse duplicate drawn occurrences.
test('duplicate card notes stay with spread index', async () => {
  const actual = await context({ cards: [
    { name: 'The Star', position: 'Past', userReflection: ' first star\n' },
    { name: 'The Star', position: 'Future', userReflection: ' second star ' }
  ], reflections: { 0: ' first star\n', 1: ' second star ' } });
  assert.deepEqual(actual.notes.map(({ spreadIndex, label, text }) => ({ spreadIndex, label, text })), [
    { spreadIndex: 0, label: 'Past · The Star', text: ' first star\n' },
    { spreadIndex: 1, label: 'Future · The Star', text: ' second star ' }
  ]);
  assert.equal(new Set(actual.notes.map(note => note.id)).size, 2);
});

// Copying a general string onto cards would invent personal associations.
test('general context never becomes a card note', async () => {
  const actual = await context({ reflections: '  A note for the whole reading.\n',
    cards: [{ name: 'The Star', position: 'Now' }, { name: 'The Star', position: 'Later' }] });
  assert.deepEqual(actual.notes.map(({ spreadIndex, label, text }) => ({ spreadIndex, label, text })), [
    { spreadIndex: null, label: 'Whole reading', text: '  A note for the whole reading.\n' }
  ]);
});

// Normalizing Unicode, whitespace, or clipping long context loses supplied bytes.
test('Unicode and long context remain byte-identical', async () => {
  const question = ' \tCafe\u0301 🌊\n\n何を選ぶ？\r\n ';
  const longNote = `\n ${'é e\u0301 🧭  '.repeat(2000)}\t\r\n`;
  const actual = await context({ question, reflections: { Overall: longNote } });
  assert.equal(Buffer.compare(Buffer.from(actual.question), Buffer.from(question)), 0);
  assert.equal(Buffer.compare(Buffer.from(actual.notes[0].text), Buffer.from(longNote)), 0);
});

// Legacy and unknown keys must stay visible without becoming a drawn occurrence.
test('Overall and legacy notes retain supplied labels and text', async () => {
  const actual = await context({ cards: [{ card: 'The Star', position: 'Now' }],
    reflections: { Overall: '  overall\n', 'Old position': 'legacy\t', 4: 'unmapped\n' } });
  assert.deepEqual(actual.notes.map(({ spreadIndex, label, text }) => ({ spreadIndex, label, text })), [
    { spreadIndex: null, label: 'Whole reading', text: '  overall\n' },
    { spreadIndex: null, label: '4', text: 'unmapped\n' },
    { spreadIndex: null, label: 'Old position', text: 'legacy\t' }
  ]);
});

// Picking just one supplied source would silently discard a differing note.
test('differing indexed and card notes both retain their occurrence', async () => {
  const actual = await context({ reflections: { 0: 'indexed' },
    cards: [{ name: 'The Star', position: 'Now', userReflection: 'card note', reflection: 'legacy card note' }] });
  assert.deepEqual(actual.notes.map(({ spreadIndex, text }) => ({ spreadIndex, text })), [
    { spreadIndex: 0, text: 'indexed' }, { spreadIndex: 0, text: 'card note' },
    { spreadIndex: 0, text: 'legacy card note' }
  ]);
});

// Empty inputs must not produce placeholders or quoted invented context.
test('empty and absent notes produce no invented rows', async () => {
  for (const reflections of [undefined, null, '', ' \n\t', {}, { Overall: '', 0: null, legacy: ' ' }]) {
    assert.deepEqual(await context({ reflections, cards: [{ userReflection: '' }, {}] }), { question: '', notes: [] });
  }
});
