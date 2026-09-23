import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server;
let MarkdownRenderer;
let NarrativeBody;
let NarrativePanelHeader;
let SpreadPatterns;
let FeedbackPanel;

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
});

after(async () => {
  await server?.close();
});

function render(Component, props = {}) {
  return renderToStaticMarkup(createElement(Component, props));
}

function headings(markup) {
  return Array.from(markup.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/gs), ([, level, content]) => ({
    level: Number(level),
    text: content.replace(/<[^>]*>/g, '')
  }));
}

const ALL_HEADINGS = '# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six';

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
  assert.deepEqual(headings(markup), [{ level: 2, text: 'Your Personalized Narrative' }]);
  assert.match(markup, /<h2\b[^>]*id="personalized-narrative-title"/);
  assert.match(markup, /<h2\b[^>]*tabindex="-1"/);
  assert.match(markup, /<h2\b[^>]*data-reading-focus-target/);
});

test('spread insights uses an h2 panel title with h3 immediate subsections', () => {
  const markup = render(SpreadPatterns, {
    spreadHighlights: [{ title: 'Balance', text: 'Notice what repeats.' }],
    themes: { knowledgeGraph: { narrativeHighlights: [{ text: 'A developing theme.' }] } },
    passages: [{ title: 'A source', text: 'Traditional context.' }]
  });
  assert.deepEqual(headings(markup), [
    { level: 2, text: 'Spread Insights' },
    { level: 3, text: 'Highlights' },
    { level: 3, text: 'Archetypal Patterns' },
    { level: 3, text: 'Traditional Wisdom' }
  ]);
});

test('collapsed feedback disclosure controls a mounted, hidden panel', () => {
  const markup = render(FeedbackPanel, { requestId: 'reading-semantics' });
  const targetId = markup.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(targetId);
  assert.ok(markup.includes(`<div id="${targetId}" hidden=""`));
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /<input/);
});
