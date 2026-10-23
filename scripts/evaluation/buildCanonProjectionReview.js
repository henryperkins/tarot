#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { listKnowledgeBasePassages, TRIAD_PASSAGES } from '../../functions/lib/knowledgeBase.js';
import { ARCHETYPAL_TRIADS } from '../../src/data/knowledgeGraphData.js';
import { DECK_ORDER } from '../../shared/vision/deckCatalog.js';
import { projectPassageForDeck, getPassageProjectionRejectionReason } from '../../functions/lib/graphRAGProjection.js';

/** Actual merged registry x selected decks, including partial pairs and active enrichment. */
export function buildCanonProjectionReview() {
  const rows = [];
  const counts = { full: 0, pair: 0, enriched: 0 };
  const add = (passage, kind) => {
    for (const deckStyle of DECK_ORDER) {
      const projected = projectPassageForDeck(passage, deckStyle);
      rows.push({ kind, type: passage.type, patternId: passage.patternId, context: passage.context || 'general',
        sourceId: passage.sourceId, deckStyle, matchedCards: passage.matchedCards || null,
        projectionId: projected?.projectionId || JSON.stringify([passage.sourceId, passage.matchedCards || null, passage.projectionVersion || null, deckStyle]),
        projectionVersion: projected?.projectionVersion || passage.projectionVersion || '',
        title: projected?.title || '', theme: projected?.theme || '',
        authoredText: passage.authoredDisplayText || passage.text, suppliedText: projected?.promptText || '',
        anchors: projected?.promptVisualAnchors || [], sourceDeck: projected?.sourceDeck || passage.sourceDeck || '',
        sourceUrls: projected?.sourceUrls || passage.sourceUrls || [],
        runtimeStatus: projected ? 'available' : getPassageProjectionRejectionReason(passage, deckStyle),
        humanStatus: projected?.projectionReviewStatus || 'pending', fidelityStatus: 'pending', absentStageStatus: 'pending' });
      counts[kind]++;
    }
  };
  for (const passage of listKnowledgeBasePassages()) add(passage, passage.isEnriched ? 'enriched' : 'full');
  for (const triad of ARCHETYPAL_TRIADS) {
    const general = TRIAD_PASSAGES[triad.id].passages.find(passage => (passage.context || 'general') === 'general');
    for (const missing of triad.cards) add({ ...general, type: 'triad', patternId: triad.id, isPartialPattern: true, matchedCards: triad.cards.filter(number => number !== missing).sort((a,b) => a-b), missingCards: [missing] }, 'pair');
  }
  return { counts, rows };
}

export function renderCanonProjectionReview(review = buildCanonProjectionReview()) {
  const escape = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    '# Canon projection editorial review', '',
    'Generated from the actual merged runtime registry. Rebuild with `node scripts/evaluation/buildCanonProjectionReview.js` after registry changes. Runtime availability is an implementation status, never human approval.', '',
    `Baseline full projections: ${review.counts.full} (145 passages × three decks). Matched-pair projections: ${review.counts.pair} (30 independently authored general pairs × three decks). Active enrichment projections: ${review.counts.enriched}. Total rows: ${review.rows.length}.`, '',
    'Every human review below is pending. Review meaning fidelity, assumptions about unprovided life events, absent-stage implications, selected-deck names, and card/deck support for each visual anchor. A scene-word blacklist cannot establish semantic safety. Context-specific pair prose is not inherited from complete triads.', '',
    'Enrichment review keeps full prose approval (`human_verdict`) separate from projection approval (`projection_verdict`). New records carry a stable `source_id`, source URL/method/title, `projection_text`, and `projection_version`. A blank or rejected projection verdict omits the meaning from cross-deck generation with `missing_or_unapproved_meaning_projection`; approval of an old full passage never grants projection approval. Regenerating a queue preserves reviewed rows and their existing columns exactly when no new drafts are added. General-context enrichment remains excluded.', '',
    'Full authored text is retained for history and editorial comparison. Only supplied text and permitted anchors reach generation. Cross-deck references carry meaning-only text and no foreign visual anchors. Research sources are provenance for internally authored interpretation, never claimed quotations.', '',
    '| # | Kind | Pattern / context / matched IDs | Selected deck | Runtime | Meaning fidelity | Absent-stage review | Human approval |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...review.rows.map((row, index) => `| ${index + 1} | ${row.kind} | ${escape(`${row.type}/${row.patternId}/${row.context}${row.matchedCards ? ` [${row.matchedCards}]` : ''}`)} | ${row.deckStyle} | ${row.runtimeStatus} | ${row.fidelityStatus} | ${row.absentStageStatus} | ${row.humanStatus} |`), '',
    ...review.rows.flatMap((row, index) => [
      `## ${index + 1}. ${row.kind}: ${row.type} / ${row.patternId} / ${row.context} / ${row.deckStyle}`, '',
      `Source ID: \`${row.sourceId}\`. Source tradition: ${row.sourceDeck}. Projection version: \`${row.projectionVersion}\`.`, '',
      `Projection ID: \`${row.projectionId}\``, '',
      ...(row.matchedCards ? [`Matched canonical IDs: ${row.matchedCards.join(', ')}.`, ''] : []),
      `Authored display/history: ${row.authoredText}`, '',
      `Supplied title: ${row.title}. Theme: ${row.theme}.`, '',
      `Supplied text: ${row.suppliedText || '(omitted)'}`, '',
      `Supplied visual anchors: ${row.anchors.join(', ') || '(none)'}.`, '',
      ...(row.sourceUrls.length ? [`Research provenance: ${row.sourceUrls.join(', ')}`, ''] : []),
      `Runtime status: ${row.runtimeStatus}. Meaning fidelity: ${row.fidelityStatus}. Absent-stage review: ${row.absentStageStatus}. Human semantic approval: ${row.humanStatus}.`, ''
    ])
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const review = buildCanonProjectionReview();
  await writeFile(new URL('../../docs/knowledge-graph/CANON_PROJECTION_REVIEW.md', import.meta.url), renderCanonProjectionReview(review));
  console.log(JSON.stringify({ rows: review.rows.length, ...review.counts, humanReview: 'pending' }));
}
