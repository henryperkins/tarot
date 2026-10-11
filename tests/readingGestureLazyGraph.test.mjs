import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const heavy = /(?:NarrativeCardFocus\.jsx|narrativePassageAligner\.js|narrativeCardLinks\.js|cardTouchPoints\.js|cardGestureArtwork\.js|SpreadCompanion\.jsx|GesturePhrase\.jsx)$/;
const entries = ['src/components/MarkdownRenderer.jsx', 'src/components/StreamingNarrative.jsx',
  'src/components/NarrativePanel.jsx', 'src/hooks/useNarrativeReadingController.js',
  'src/components/journal/entry-card/EntrySections/NarrativeSection.jsx'];

test('optimized production reading entries do not eagerly download the gesture graph', async () => {
  const { metafile } = await build({ entryPoints: entries, bundle: true, splitting: true, format: 'esm',
    platform: 'browser', outdir: 'lazy-graph-output', write: false, metafile: true, minify: true,
    jsx: 'automatic', define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
    loader: { '.svg': 'dataurl' }, logLevel: 'silent' });
  const outputs = metafile.outputs;
  const visit = (output, seen = new Set()) => {
    if (seen.has(output)) return seen;
    seen.add(output);
    for (const item of outputs[output]?.imports || []) if (item.kind !== 'dynamic-import' && !item.external) visit(item.path, seen);
    return seen;
  };
  for (const entry of entries) {
    const output = Object.keys(outputs).find(key => outputs[key].entryPoint === entry);
    assert.ok(output, `optimized entry exists: ${entry}`);
    const loaded = [...visit(output)].flatMap(key => Object.keys(outputs[key].inputs));
    assert.deepEqual(loaded.filter(input => heavy.test(input)), [], `${entry} static download graph contains gesture implementation`);
  }
  // The optimizer must retain the real gated implementation, not drop the feature.
  assert.ok(Object.values(outputs).some(output => Object.keys(output.inputs).some(input => /narrativePassageAligner\.js$/.test(input))));
});

test('Vite production app route and modulepreload closures exclude the gesture runtime', { timeout: 120000 }, async t => {
  const { build: viteBuild } = await import('vite');
  const { default: config } = await import('../vite.config.js');
  const built = await viteBuild({ ...config, configFile: false, logLevel: 'silent',
    build: { ...config.build, write: false, manifest: true } });
  const outputs = built.output.filter(item => item.type === 'chunk');
  const byFile = new Map(outputs.map(item => [item.fileName, item]));
  const closure = (chunk, seen = new Set()) => {
    if (seen.has(chunk.fileName)) return seen;
    seen.add(chunk.fileName);
    for (const imported of chunk.imports) if (byFile.has(imported)) closure(byFile.get(imported), seen);
    return seen;
  };
  const productionRoots = outputs.filter(chunk => chunk.isEntry || Object.keys(chunk.modules).some(id => entries.some(entry => id.endsWith('/' + entry))));
  assert.ok(productionRoots.length >= 3, 'actual app includes ordinary reading, Markdown and journal outputs');
  for (const chunk of productionRoots) {
    const modules = [...closure(chunk)].flatMap(file => Object.keys(byFile.get(file).modules));
    assert.deepEqual(modules.filter(id => heavy.test(id)), [], `${chunk.fileName} production import/preload closure`);
  }
  const heavyChunks = outputs.filter(chunk => Object.keys(chunk.modules).some(id => heavy.test(id)));
  assert.ok(heavyChunks.some(chunk => Object.keys(chunk.modules).some(id => /narrativePassageAligner\.js$/.test(id))));
  t.diagnostic(JSON.stringify({ production: productionRoots.map(chunk => ({ file: chunk.fileName,
    sha256: createHash('sha256').update(chunk.code).digest('hex'), staticDownloads: [...closure(chunk)] })),
    gated: heavyChunks.map(chunk => ({ file: chunk.fileName, sha256: createHash('sha256').update(chunk.code).digest('hex'),
      modules: Object.keys(chunk.modules).filter(id => heavy.test(id)).map(id => id.replace(process.cwd() + '/', '')) })) }));
});
