import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MAJOR_ARCANA_PASSAGES, mergeEnrichedPassages } from '../functions/lib/knowledgeBase.js';
import { collectPassageCandidates, passageContextMatch, selectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { applyCandidates } from '../scripts/enrichment/applyPassageCandidates.js';
import { stringifyRow } from '../scripts/evaluation/lib/csv.js';

for (const reviewed of [false, true]) {
  test(`synthetic approved enrichment survives apply, merge, same-context selection; projection approved=${reviewed}`, async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tableu-synthetic-projection-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const row = { candidate_id: 'synthetic-card-zero', card_number: '0', card_name: 'The Fool', context: 'transition', source_id: 'research:synthetic-zero', source_url: 'https://example.com/fool', source_title: 'Synthetic source', source_method: 'fetch', draft_text: 'Bring curiosity to the next practical step without abandoning a boundary that matters to you. A small experiment can help you learn before making a larger commitment.', draft_tags: 'curiosity experiment boundaries', projection_text: 'A small experiment can offer information while preserving your choices. Keep curiosity connected to a practical boundary and review what you learn before committing more energy.', projection_version: 'meaning-v1', projection_verdict: reviewed ? 'approve' : '', human_verdict: 'approve' };
    const columns = Object.keys(row);
    const queue = path.join(dir, 'queue.csv');
    const out = path.join(dir, 'synthetic.mjs');
    await fs.writeFile(queue, `${columns.join(',')}\n${stringifyRow(columns.map(key => row[key]))}\n`);
    const result = await applyCandidates({ queue, out, provenance: path.join(dir, 'provenance.json'), log: () => {} });
    assert.equal(result.applied, 1);
    const generated = (await import(pathToFileURL(out))).ENRICHED_MAJOR_ARCANA_PASSAGES;
    const original = MAJOR_ARCANA_PASSAGES[0].passages.slice();
    t.after(() => { MAJOR_ARCANA_PASSAGES[0].passages = original; });
    mergeEnrichedPassages(MAJOR_ARCANA_PASSAGES, generated);
    mergeEnrichedPassages(MAJOR_ARCANA_PASSAGES, { 0: { passages: [{ ...generated[0].passages[0], context: 'general' }] } });
    assert.equal(MAJOR_ARCANA_PASSAGES[0].passages.filter(p => p.context === 'general').length, 1);
    const keys = { totalMajors: 1, singleMajorNumber: 0 };
    const rws = collectPassageCandidates(keys);
    const enriched = rws.find(p => p.sourceId === row.source_id);
    assert.ok(enriched, 'same-context base variant must not hide enrichment');
    assert.deepEqual(enriched.sourceUrls, [row.source_url]);
    assert.match(enriched.source, /research-informed/);
    // Scored for a question in the enrichment's context; graphRAGContextVariants.test.mjs covers the unmatched case.
    const selected = selectPassageCandidates(rws.map(p => ({ ...p, relevanceScore: p.sourceId === row.source_id ? 1 : 0.8, _contextMatch: passageContextMatch(p, row.context) })), { maxPassages: 5 });
    assert.equal(selected.length, 1, 'canonical and enriched sources compete for the same graph pattern slot');
    assert.equal(selected[0].sourceId, row.source_id);
    const thoth = collectPassageCandidates(keys, { deckStyle: 'thoth-a1' });
    assert.equal(thoth.some(p => p.sourceId === row.source_id), reviewed);
    if (!reviewed) assert.ok(thoth.retrievalStats.projectionRejectedReasons.missing_or_unapproved_meaning_projection > 0);
  });
}

import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';

function withEnrichment(t, fields) {
  const entry = MAJOR_ARCANA_PASSAGES[17];
  const length = entry.passages.length;
  t.after(() => entry.passages.splice(length));
  mergeEnrichedPassages(MAJOR_ARCANA_PASSAGES, { 17: { passages: [{
    context: 'career', sourceId: 'synthetic-source-url-regression',
    text: 'Patient career practice keeps a useful possibility open.',
    archetypalText: 'Patient career practice keeps a useful possibility open.',
    projectionReviewStatus: 'approved', ...fields
  }] } });
  return collectPassageCandidates({ totalMajors: 1, singleMajorNumber: 17 }, { deckStyle: 'thoth-a1' })
    .find(row => row.sourceId === 'synthetic-source-url-regression');
}

test('merged enrichment sourceUrl survives selected-deck projection and final reference attribution', t => {
  const candidate = withEnrichment(t, { sourceUrl: 'https://synthetic.invalid/single-source' });
  assert.ok(candidate);
  assert.deepEqual(candidate.sourceUrls, ['https://synthetic.invalid/single-source']);
  const built = buildEnhancedClaudePrompt({
    spreadInfo: { key: 'single', name: 'One card' },
    cardsInfo: [{ card: 'The Star', number: 17, position: 'Theme', meaning: 'Hope.', orientation: 'Upright' }],
    themes: {}, deckStyle: 'thoth-a1', graphRAGPayload: { passages: [candidate] },
    promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
  });
  assert.match(built.userPrompt, /https:\/\/synthetic\.invalid\/single-source/);
});

test('merged enrichment retains distinct safe array and singular URLs without duplicate or unsafe links', t => {
  const candidate = withEnrichment(t, {
    sourceUrl: 'https://synthetic.invalid/singular',
    sourceUrls: ['https://synthetic.invalid/array', 'javascript:alert(1)', null, 'https://synthetic.invalid/array', 'data:text/plain,unsafe']
  });
  assert.deepEqual(candidate.sourceUrls, ['https://synthetic.invalid/array', 'https://synthetic.invalid/singular']);
});

test('invalid singular source URL cannot enter projected attribution', t => {
  const candidate = withEnrichment(t, { sourceUrl: 'javascript:alert(1)', sourceUrls: ['http://synthetic.invalid/safe'] });
  assert.deepEqual(candidate.sourceUrls, ['http://synthetic.invalid/safe']);
});

for (const reviewed of [false, true]) {
  test(`multi-Major spread admits approved enrichment on one drawn Major while preserving canon fallback when cross-deck projection approved=${reviewed}`, t => {
    const entry = MAJOR_ARCANA_PASSAGES[8];
    const originalLength = entry.passages.length;
    t.after(() => entry.passages.splice(originalLength));
    mergeEnrichedPassages(MAJOR_ARCANA_PASSAGES, {
      8: {
        passages: [{
          sourceId: `synthetic-multi-major-8-${reviewed}`,
          context: 'career',
          text: 'Steady patient courage in workplace leadership.',
          archetypalText: 'Steady patient courage in workplace leadership.',
          sourceUrl: 'https://synthetic.invalid/strength-career',
          projectionReviewStatus: reviewed ? 'approved' : 'pending'
        }]
      }
    });
    const multiKeys = { totalMajors: 2, majorNumbers: [0, 8] };
    const rws = collectPassageCandidates(multiKeys, { deckStyle: 'rws-1909' });
    assert.ok(rws.some(p => p.sourceId === `synthetic-multi-major-8-${reviewed}`), 'same-deck multi-Major spread includes approved enrichment');
    assert.ok(rws.some(p => p.type === 'major-arcana' && p.patternId === '0'), 'other drawn Major remains eligible');

    const thoth = collectPassageCandidates(multiKeys, { deckStyle: 'thoth-a1' });
    assert.equal(thoth.some(p => p.sourceId === `synthetic-multi-major-8-${reviewed}`), reviewed);
    const thothStrengthCanon = thoth.filter(p => p.type === 'major-arcana' && p.patternId === '8' && !p.isEnriched);
    assert.ok(thothStrengthCanon.length > 0, 'compatible canon remains usable when enriched cross-deck projection is rejected');
    const selected = selectPassageCandidates(
      thoth.map(p => ({ ...p, relevanceScore: p.patternId === '8' ? 0.9 : 0.5, _contextMatch: passageContextMatch(p, 'career') })),
      { maxPassages: 2 }
    );
    assert.equal(selected.filter(p => p.patternId === '8').length, 1, 'at most one variant per pattern slot');
  });
}

test('either hand-written canon or approved enrichment can win its pattern slot on relevance while canon registry entries remain intact', t => {
  const entry = MAJOR_ARCANA_PASSAGES[17];
  const originalSnapshot = structuredClone(entry.passages);
  t.after(() => { entry.passages = structuredClone(originalSnapshot); });
  mergeEnrichedPassages(MAJOR_ARCANA_PASSAGES, {
    17: {
      passages: [{
        sourceId: 'synthetic-competition-17',
        context: 'career',
        text: 'Dedicated career renewal through steady skill-building.',
        archetypalText: 'Dedicated career renewal through steady skill-building.',
        sourceUrl: 'https://synthetic.invalid/star-career',
        projectionReviewStatus: 'approved'
      }]
    }
  });
  assert.deepEqual(entry.passages.slice(0, originalSnapshot.length), originalSnapshot, 'hand-written canon entries remain unchanged after merge');
  const candidates = collectPassageCandidates({ totalMajors: 1, majorNumbers: [17], singleMajorNumber: 17 });
  const enrichedWins = selectPassageCandidates(
    candidates.map(p => ({ ...p, relevanceScore: p.sourceId === 'synthetic-competition-17' ? 0.92 : 0.65, _contextMatch: passageContextMatch(p, 'career') })),
    { maxPassages: 5 }
  );
  assert.equal(enrichedWins.length, 1);
  assert.equal(enrichedWins[0].sourceId, 'synthetic-competition-17');

  const canonWins = selectPassageCandidates(
    candidates.map(p => ({ ...p, relevanceScore: p.sourceId === 'synthetic-competition-17' ? 0.55 : 0.88, _contextMatch: passageContextMatch(p, 'career') })),
    { maxPassages: 5 }
  );
  assert.equal(canonWins.length, 1);
  assert.notEqual(canonWins[0].sourceId, 'synthetic-competition-17');
  assert.equal(canonWins[0].isEnriched, false);
});


