import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { MemoryRouter } from 'react-router-dom';

let server;
let MarkdownRenderer;
let NarrativeBody;
let NarrativePanelHeader;
let SpreadPatterns;
let FeedbackPanel;
let CardTouchArt;
let NarrativeSection;
let JournalEntryCard;
let AuthProvider;
let SubscriptionProvider;
let ReadingFeedbackSection;
let ReadingMediaSection;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.cache/narrative-semantics-vite', import.meta.url)),
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom'
  });
  ({ MarkdownRenderer } = await server.ssrLoadModule('/src/components/MarkdownRenderer.jsx'));
  ({ NarrativeBody } = await server.ssrLoadModule('/src/components/reading/narrative/NarrativeBody.jsx'));
  ({ NarrativePanelHeader } = await server.ssrLoadModule('/src/components/reading/narrative/NarrativePanelHeader.jsx'));
  ({ SpreadPatterns } = await server.ssrLoadModule('/src/components/SpreadPatterns.jsx'));
  ({ FeedbackPanel } = await server.ssrLoadModule('/src/components/FeedbackPanel.jsx'));
  ({ CardTouchArt } = await server.ssrLoadModule('/src/components/reading/narrative/CardTouchArt.jsx'));
  ({ NarrativeSection } = await server.ssrLoadModule('/src/components/journal/entry-card/EntrySections/NarrativeSection.jsx'));
  ({ JournalEntryCard } = await server.ssrLoadModule('/src/components/journal/entry-card/JournalEntryCard.jsx'));
  ({ AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx'));
  ({ SubscriptionProvider } = await server.ssrLoadModule('/src/contexts/SubscriptionContext.jsx'));
  ({ ReadingFeedbackSection } = await server.ssrLoadModule('/src/components/reading/complete/ReadingFeedbackSection.jsx'));
  ({ ReadingMediaSection } = await server.ssrLoadModule('/src/components/reading/complete/ReadingMediaSection.jsx'));
});

test('unsupported artwork editions retain whole-card context without vector details', () => {
  const markup = render(CardTouchArt, {
    card: { canonicalName: 'The Star', image: '/images/star.webp', artworkEdition: 'unknown', isReversed: true },
    gesture: { detailIds: ['pool-pour'], phase: 'held' }, crop: true, motionOwner: false
  });
  assert.match(markup, /src="\/images\/star.webp"/);
  assert.match(markup, /data-reversed="true"/);
  assert.doesNotMatch(markup, /<svg|data-water-detail|<mask/);
});

after(async () => {
  await server?.close();
});

function render(Component, props = {}) {
  return renderToStaticMarkup(createElement(Component, props));
}

test('readings without a request ID omit the entire feedback section', () => {
  for (const readingMeta of [undefined, {}, { requestId: null }]) {
    assert.equal(render(ReadingFeedbackSection, { personalReading: { raw: 'Restored reading.' }, readingMeta }), '');
  }
  assert.match(render(ReadingFeedbackSection, {
    personalReading: { raw: 'Current reading.' }, readingMeta: { requestId: 'current-reading' }
  }), /How did this reading land/);
});

test('media section hides itself while a reading streams or has failed', () => {
  for (const personalReading of [null, { isStreaming: true }, { isError: true }]) {
    assert.equal(render(ReadingMediaSection, { personalReading, canUseMediaGallery: true }), '');
  }
  assert.match(render(ReadingMediaSection, {
    personalReading: { raw: 'Complete reading.' }, canUseMediaGallery: true
  }), /View recent media/);
});

function headings(markup) {
  return Array.from(markup.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/gs), ([, level, content]) => ({
    level: Number(level),
    text: content.replace(/<[^>]*>/g, '')
  }));
}

const ALL_HEADINGS = '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six';

test('plain saved journal headings nest under the entry, preserving parsed Markdown and both expansion modes', () => {
  const narrativeText = '~~~text\n# Not a heading\n~~~\n\nOpening\n-------\n\n### Reflection\n\n##### Detail\n\n###### More detail';
  for (const collapsible of [true, false]) {
    const markup = render(NarrativeSection, { narrativeText, narrativeId: 'saved-reading', collapsible, defaultExpanded: true });
    assert.deepEqual(headings(markup), [
      { level: 4, text: 'Opening' },
      { level: 5, text: 'Reflection' },
      { level: 6, text: 'Detail' },
      { level: 6, text: 'More detail' }
    ]);
    assert.match(markup, /# Not a heading/);
  }
});

for (const gestureStudyEnabled of [false, true]) {
  test(`saved journal card nests narrative headings below its title (restored cues: ${gestureStudyEnabled})`, () => {
    const entry = { id: 'heading-card', ts: 0, spread: 'Journal entry', question: 'A reflection',
      cards: [{ name: 'The Fool', position: 'Present', orientation: 'Upright' }],
      personalReading: '~~~text\n# Not a heading\n~~~\n\nOpening\n-------\n\n### Reflection\n\n##### Detail\n\n###### More detail' };
    const card = createElement(JournalEntryCard, { entry, defaultExpanded: true, gestureStudyEnabled });
    const markup = renderToStaticMarkup(createElement(MemoryRouter, null,
      createElement(AuthProvider, null, createElement(SubscriptionProvider, null, card))));
    assert.deepEqual(headings(markup), [
      { level: 3, text: 'A reflection' },
      { level: 4, text: 'Opening' },
      { level: 5, text: 'Reflection' },
      { level: 6, text: 'Detail' },
      { level: 6, text: 'More detail' }
    ]);
    assert.match(markup, /# Not a heading/);
  });
}

test('shared Markdown keeps all six original heading levels for chat and journal', () => {
  assert.deepEqual(headings(render(MarkdownRenderer, { content: ALL_HEADINGS })), [
    { level: 1, text: 'One' },
    { level: 2, text: 'Two' },
    { level: 3, text: 'Three' },
    { level: 4, text: 'Four' },
    { level: 5, text: 'Five' },
    { level: 6, text: 'Six' }
  ]);
});

test('contextual Markdown nests every source heading beneath the narrative panel', () => {
  assert.deepEqual(headings(render(MarkdownRenderer, { content: ALL_HEADINGS, headingBaseLevel: 3 })), [
    { level: 3, text: 'One' },
    { level: 4, text: 'Two' },
    { level: 5, text: 'Three' },
    { level: 6, text: 'Four' },
    { level: 6, text: 'Five' },
    { level: 6, text: 'Six' }
  ]);
});

test('narrative heading base follows Markdown structure, including setext and fenced code', () => {
  const content = '```text\n# Not a heading\n```\n\nOpening\n-------\n\n### Reflection\n\n#### Detail';
  const markup = render(MarkdownRenderer, { content, headingBaseLevel: 3 });
  assert.deepEqual(headings(markup), [
    { level: 3, text: 'Opening' },
    { level: 4, text: 'Reflection' },
    { level: 5, text: 'Detail' }
  ]);
  assert.match(markup, /# Not a heading/);
});

test('contextual heading rendering preserves voice word offsets, highlights, and HTML policy', () => {
  const content = '## Opening\n\nFind gentle balance.\n\n### Reflection\n\nListen carefully.\n\n<script>ignore me</script>';
  const props = {
    content,
    highlightPhrases: ['gentle balance'],
    wordBoundary: { textOffset: 14, wordLength: 6 }
  };
  for (const headingBaseLevel of [undefined, 3]) {
    const markup = render(MarkdownRenderer, { ...props, headingBaseLevel });
    assert.match(markup, /class="narrative-tts-word narrative-tts-word--active">gentle<\/span>/);
    assert.match(markup, /Find /);
    assert.match(markup, /Listen carefully\./);
    assert.doesNotMatch(markup, /<script|ignore me/);
  }
});

test('narrative voice highlighting counts text beneath all six supported heading levels', () => {
  const markup = render(MarkdownRenderer, {
    content: '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six\n\nTake time.',
    headingBaseLevel: 3,
    wordBoundary: { textOffset: 34, wordLength: 4 }
  });
  // "One\n\nTwo\n\nThree\n\nFour\n\nFive\n\nSix\n\n" is 34 characters.
  assert.match(markup, /class="narrative-tts-word narrative-tts-word--active">Take<\/span>/);
});

test('narrative body opts into h3 sections without changing the shared renderer default', () => {
  const markup = render(NarrativeBody, {
    narrativeText: '## Opening\n\nComplete reading.\n\n### Reflection\n\nConsider your next step.',
    personalReading: { hasMarkdown: true },
    shouldStreamNarrative: false
  });
  assert.deepEqual(headings(markup), [
    { level: 3, text: 'Opening' },
    { level: 4, text: 'Reflection' }
  ]);
  assert.match(markup, /Complete reading\./);
  assert.match(markup, /Consider your next step\./);
});

test('narrative title exposes the stable h2 focus destination', () => {
  const markup = render(NarrativePanelHeader);
  assert.deepEqual(headings(markup), [{ level: 2, text: 'Your reading' }]);
  assert.match(markup, /<h2\b[^>]*id="personalized-narrative-title"/);
  assert.match(markup, /<h2\b[^>]*tabindex="-1"/);
  assert.match(markup, /<h2\b[^>]*data-reading-focus-target/);
});

test('spread insights uses an h2 panel title with h3 immediate subsections', () => {
  const markup = render(SpreadPatterns, {
    spreadHighlights: [{ title: 'Balance', text: 'Notice what repeats.' }],
    themes: { knowledgeGraph: { narrativeHighlights: [
      { text: 'A developing theme.' }, { text: 'A second pattern.' },
      { text: 'A third pattern.' }, { text: 'A supporting pattern.' }
    ] } },
    passages: [{ title: 'A source', text: 'Traditional context.' }]
  });
  assert.deepEqual(headings(markup), [
    { level: 2, text: 'Spread Insights' },
    { level: 3, text: 'Highlights' },
    { level: 3, text: 'More spread details' },
    { level: 3, text: 'Archetypal patterns' },
    { level: 3, text: 'Traditional wisdom' }
  ]);
  assert.match(markup, /^<section[^>]*aria-labelledby="([^"]+)"[^>]*>\s*<h2[^>]*id="\1"/, 'The panel is a region named by its title');
});

test('collapsed feedback disclosure controls a mounted, hidden panel', () => {
  const markup = render(FeedbackPanel, { requestId: 'reading-semantics' });
  const targetId = markup.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(targetId);
  assert.ok(markup.includes(`<div id="${targetId}" hidden=""`));
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /<input/);
});

test('spread insights leads with card relationships and limits the initial summary', () => {
  const markup = render(SpreadPatterns, {
    themes: { knowledgeGraph: { narrativeHighlights: [{ type: 'complete-triad', priority: 1, text: '**Healing Arc** Death, Temperance, and The Star.' }] } },
    spreadHighlights: [
      { key: 'deck-scope', title: 'Deck scope:', text: 'Full deck.' },
      { key: 'elemental-balance', title: 'Balance:', text: 'Major Arcana.' },
      { key: 'reversal-framework', title: 'Lens:', text: 'Look inward.' },
      { key: 'rel-0-sequence', title: 'Story Flow', text: 'From The Star to Death.' }
    ]
  });
  const summary = markup.match(/<ul[^>]*aria-label="Spread highlights"[^>]*>([\s\S]*?)<\/ul>/)?.[1] || '';
  assert.match(summary, /Healing Arc/);
  assert.match(summary, /Story Flow/);
  assert.doesNotMatch(summary, /Deck scope/);
  assert.equal((summary.match(/<li\b/g) || []).length, 3);
  assert.match(markup, /Full deck\./, 'Supplementary context is retained behind a disclosure');
});

test('traditional passages expose native list items and their source tradition', () => {
  const markup = render(SpreadPatterns, {
    themes: { deckStyle: 'thoth-a1' },
    passages: [{ type: 'triad', title: 'Healing', text: 'Temperance pours between cups.', source: 'Tableu Tarot Canon' }]
  });
  assert.match(markup, /<ul[^>]*aria-label="Traditional wisdom passages"[^>]*>\s*<li\b/);
  assert.match(markup, /Rider-Waite-Smith reference/);
  assert.match(markup, /Thoth/);
  assert.match(markup, /imagery/);
});

test('card mentions offer detail actions only for cards in the current spread', () => {
  const markup = render(SpreadPatterns, {
    spreadHighlights: [{ title: 'Connection:', text: 'Death and The Star; the heart of the matter.' }],
    cards: [{ name: 'Death', position: 'Future' }, { name: 'Art', canonicalName: 'Temperance', position: 'Present' }],
    onSelectCard: () => {}
  });
  assert.match(markup, /<button[^>]*aria-label="View Death[^"]*"[^>]*>Death<\/button>/);
  assert.doesNotMatch(markup, /<button[^>]*>The Star<\/button>/);
  assert.doesNotMatch(markup, /he<button/);
});
