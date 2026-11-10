#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { detectSuitProgressions, getPriorityPatternNarratives, detectAllPatterns } from '../../functions/lib/knowledgeGraph.js';
import { renderSuitProgressionHighlight } from '../../functions/lib/minorPatternHighlights.js';
import { SUIT_PROGRESSIONS } from '../../src/data/knowledgeGraphData.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { listKnowledgeBasePassages, TRIAD_PASSAGES } from '../../functions/lib/knowledgeBase.js';
import { ARCHETYPAL_TRIADS } from '../../src/data/knowledgeGraphData.js';
import { DECK_ORDER } from '../../shared/vision/deckCatalog.js';
import { projectPassageForDeck, getPassageProjectionRejectionReason } from '../../functions/lib/graphRAGProjection.js';
import { buildGraphContext } from '../../functions/lib/graphContext.js';
import { collectPassageCandidates } from '../../functions/lib/graphRAGCandidates.js';
import { getReadingPromptVersion } from '../../functions/lib/promptVersioning.js';
import { buildGroupedEditorialReview, renderGroupedEditorialReview } from './lib/groupedEditorialReview.js';
export { buildGroupedEditorialReview } from './lib/groupedEditorialReview.js';

/** Actual merged registry x selected decks, including partial pairs and active enrichment. */
export function buildCanonProjectionReview({ previousReviews = [] } = {}) {
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
  return { counts, rows: preserveHumanReviews(rows, previousReviews) };
}

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const verdicts = new Set(['pending', 'approved', 'rejected']);

/** Human decisions belong to exact source/projection/text, independent of reruns. */
export function preserveHumanReviews(rows, previousReviews = []) {
  return rows.map(row => {
    const textHash = digest([row.title, row.theme, row.authoredText, row.suppliedText, row.anchors]);
    const reviewId = digest([row.kind, row.sourceId, row.projectionId, textHash]);
    const previous = previousReviews.find(old => old.reviewId === reviewId && old.textHash === textHash && old.reviewerType === 'human');
    const clean = { ...row, textHash, reviewId, reviewerType: null, humanStatus: 'pending', fidelityStatus: 'pending', absentStageStatus: 'pending' };
    if (!previous) return clean;
    return { ...clean, reviewerType: 'human',
      humanStatus: verdicts.has(previous.humanStatus) ? previous.humanStatus : 'pending',
      fidelityStatus: verdicts.has(previous.fidelityStatus) ? previous.fidelityStatus : 'pending',
      absentStageStatus: verdicts.has(previous.absentStageStatus) ? previous.absentStageStatus : 'pending',
      ...(typeof previous.notes === 'string' ? { notes: previous.notes } : {}) };
  });
}

export function buildReadingPipelineEditorialReview({ previousReviews = [], agentVerdicts = [] } = {}) {
  const canon = buildCanonProjectionReview({ previousReviews });
  const rows = [...canon.rows];
  const counts = { ...canon.counts, directMajor: 0, directMinor: 0, directCourt: 0, referenceMinor: 0, referenceCourt: 0 };
  const add = (kind, id, deckStyle, suppliedText) => {
    counts[kind]++;
    rows.push({ kind, type: 'direct-highlight', patternId: id, context: 'general', sourceId: `direct:${id}`,
      deckStyle, sourceDeck: deckStyle, sourceUrls: [], projectionId: JSON.stringify([kind, id, deckStyle]), projectionVersion: `reading-${getReadingPromptVersion()}`,
      title: id, theme: '', authoredText: suppliedText, suppliedText, anchors: [], runtimeStatus: 'available' });
  };
  const addReference = (kind, id, deckStyle, cards, type) => {
    const graphKeys = buildGraphContext(cards, { deckStyle }).graphKeys;
    const passage = collectPassageCandidates(graphKeys, { deckStyle }).find(row => row.type === type);
    if (!passage) throw new Error(`Missing ${kind} review projection: ${id}/${deckStyle}`);
    counts[kind]++;
    rows.push({ kind, type, patternId: id, context: passage.context || 'general', sourceId: passage.sourceId,
      deckStyle, sourceDeck: passage.sourceDeck, sourceUrls: passage.sourceUrls, projectionId: passage.projectionId,
      projectionVersion: passage.projectionVersion, title: passage.title, theme: passage.theme,
      matchedCardKeys: passage.matchedCardKeys, authoredText: passage.authoredDisplayText, suppliedText: passage.promptText,
      anchors: passage.promptVisualAnchors, runtimeStatus: 'available' });
  };
  for (const triad of ARCHETYPAL_TRIADS) for (const [pairKey, text] of Object.entries(triad.partialNarrative)) {
    add('directMajor', `${triad.id}:${pairKey}`, 'rws-1909', text);
  }
  for (const [suit, data] of Object.entries(SUIT_PROGRESSIONS)) for (const stage of ['beginning', 'challenge', 'mastery']) {
    const members = data[stage].cards;
    for (let mask = 0; mask < 2 ** members.length; mask++) {
      const matched = members.filter((_, index) => mask & (1 << index));
      if (matched.length < 2) continue;
      for (const deckStyle of DECK_ORDER) {
        const cards = matched.map((entry, index) => {
          const card = MINOR_ARCANA.find(row => row.name === entry.name);
          return { ...card, card: card.name, canonicalName: card.name, orientation: index % 2 ? 'Reversed' : 'Upright', position: `Slot ${index + 1}` };
        });
        const progression = detectSuitProgressions(cards, { deckStyle })[0];
        const rendered = renderSuitProgressionHighlight(progression, { deckStyle });
        add('directMinor', `${suit}:${stage}:${matched.map(row => row.rank).join('-')}`, deckStyle, rendered.text);
        addReference('referenceMinor', `${suit}:${stage}:${matched.map(row => row.rank).join('-')}`, deckStyle, cards, 'suit-progression');
      }
    }
    // Court families are enumerated below, independently of pip stage subsets.
  }
  for (const suit of ['Wands', 'Cups', 'Swords', 'Pentacles']) for (const size of [2, 3]) for (const deckStyle of DECK_ORDER) {
    const cards = ['Page', 'Queen', 'King'].slice(3 - size).map(rank => {
      const card = MINOR_ARCANA.find(row => row.name === `${rank} of ${suit}`);
      return { ...card, card: card.name, canonicalName: card.name, orientation: 'Upright' };
    });
    const patterns = detectAllPatterns(cards, { deckStyle });
    const text = getPriorityPatternNarratives({ courtLineages: patterns.courtLineages }, deckStyle)[0].text;
    add('directCourt', `${suit}:court:${size}`, deckStyle, text);
  }
  for (const suit of ['Wands', 'Cups', 'Swords', 'Pentacles']) for (let mask = 0; mask < 16; mask++) {
    const ranks = ['Page', 'Knight', 'Queen', 'King'].filter((_, index) => mask & (1 << index));
    if (ranks.length < 2) continue;
    const cards = ranks.map(rank => {
      const card = MINOR_ARCANA.find(row => row.name === `${rank} of ${suit}`);
      return { ...card, card: card.name, canonicalName: card.name, orientation: 'Upright' };
    });
    for (const deckStyle of DECK_ORDER) addReference('referenceCourt', `${suit}:court:${ranks.join('-')}`, deckStyle, cards, 'court-lineage');
  }
  const preservedRows = preserveHumanReviews(rows, previousReviews);
  return { counts, rows: preservedRows, humanReview: 'not_requested', groupedReview: buildGroupedEditorialReview(preservedRows, { verdicts: agentVerdicts }) };
}

export function renderCanonProjectionReview(review = buildCanonProjectionReview()) {
  if (review.groupedReview) return renderGroupedEditorialReview(review);
  const generatorCommand = `node scripts/evaluation/buildCanonProjectionReview.js${review.counts.directMinor !== undefined ? ' --pipeline' : ''}`;
  const escape = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    '# Canon projection editorial review', '',
    `Generated from the actual merged runtime registry. Rebuild with \`${generatorCommand}\` after registry changes. Runtime availability is an implementation status, never human approval.`, '',
    `Baseline full projections: ${review.counts.full} (${review.counts.full / DECK_ORDER.length} passages × ${DECK_ORDER.length} decks). Matched-pair projections: ${review.counts.pair} (${review.counts.pair / DECK_ORDER.length} independently authored general pairs × ${DECK_ORDER.length} decks). Active enrichment projections: ${review.counts.enriched}. Total rows: ${review.rows.length}.`, '',
    'Human verdicts are preserved only for the exact source, projection and text hash. Unreviewed or changed rows remain pending. Review meaning fidelity, assumptions about unprovided life events, absent-stage implications, selected-deck names, and card/deck support for each visual anchor. A scene-word blacklist cannot establish semantic safety. Context-specific pair prose is not inherited from complete triads.', '',
    ...(review.counts.directMinor !== undefined ? [`Direct highlights: ${review.counts.directMajor} Major pair themes, ${review.counts.directMinor} Minor membership/deck renderings and ${review.counts.directCourt} court renderings. Human reviewers edit the matching JSON rows, set reviewerType to human, and record humanStatus, fidelityStatus, absentStageStatus and notes. Keep reviewId and textHash unchanged; regeneration preserves only exact matches.`, ''] : []),
    'Enrichment review keeps full prose approval (`human_verdict`) separate from projection approval (`projection_verdict`). New records carry a stable `source_id`, source URL/method/title, `projection_text`, and `projection_version`. A blank or rejected projection verdict omits the meaning from cross-deck generation with `missing_or_unapproved_meaning_projection`; approval of an old full passage never grants projection approval. Regenerating a queue preserves reviewed rows and their existing columns exactly when no new drafts are added. General-context enrichment remains excluded.', '',
    'Full authored text is retained for history and editorial comparison. Only supplied text and permitted anchors reach generation. Cross-deck references carry meaning-only text and no foreign visual anchors. Research sources are provenance for internally authored interpretation, never claimed quotations.', '',
    '| # | Kind | Pattern / context / matched IDs | Selected deck | Runtime | Meaning fidelity | Absent-stage review | Human approval |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...review.rows.map((row, index) => `| ${index + 1} | ${row.kind} | ${escape(`${row.type}/${row.patternId}/${row.context}${row.matchedCards ? ` [${row.matchedCards}]` : ''}`)} | ${row.deckStyle} | ${row.runtimeStatus} | ${row.fidelityStatus} | ${row.absentStageStatus} | ${row.humanStatus} |`), '',
    ...review.rows.flatMap((row, index) => [
      `## ${index + 1}. ${row.kind}: ${row.type} / ${row.patternId} / ${row.context} / ${row.deckStyle}`, '',
      `Source ID: \`${row.sourceId}\`. Source tradition: ${row.sourceDeck}. Projection version: \`${row.projectionVersion}\`.`, '',
      `Projection ID: \`${row.projectionId}\``, '',
      `Review ID: ${row.reviewId}. Text SHA-256: ${row.textHash}.`, '',
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
  const pipeline = process.argv.includes('--pipeline');
  const filename = pipeline ? 'READING_PIPELINE_EDITORIAL_REVIEW' : 'CANON_PROJECTION_REVIEW';
  let existingReviews = [];
  try { existingReviews = JSON.parse(await readFile(new URL(`../../docs/knowledge-graph/${filename}.json`, import.meta.url), 'utf8')).rows; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(existingReviews)) throw new Error('Existing editorial rows must be an array.');
  const verdictPath = new URL('../../docs/knowledge-graph/CANON_PROJECTION_VERDICTS.json', import.meta.url);
  let previousReviews = [];
  try { previousReviews = JSON.parse(await readFile(verdictPath, 'utf8')).rows; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(previousReviews)) throw new Error('Editorial verdict rows must be an array.');
  previousReviews = [...previousReviews, ...existingReviews];
  let agentVerdicts = [];
  if (pipeline) {
    try { agentVerdicts = JSON.parse(await readFile(new URL('../../docs/knowledge-graph/READING_PIPELINE_AGENT_VERDICTS.json', import.meta.url), 'utf8')).verdicts; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!Array.isArray(agentVerdicts)) throw new Error('Agent editorial verdicts must be an array.');
  }
  const review = pipeline ? buildReadingPipelineEditorialReview({ previousReviews, agentVerdicts }) : buildCanonProjectionReview({ previousReviews });
  await writeFile(new URL(`../../docs/knowledge-graph/${filename}.md`, import.meta.url), renderCanonProjectionReview(review));
  if (pipeline) await writeFile(new URL(`../../docs/knowledge-graph/${filename}.json`, import.meta.url), JSON.stringify(review, null, 2) + '\n');
  console.log(JSON.stringify({ rows: review.rows.length, ...review.counts, ...(review.groupedReview ? { groups: review.groupedReview.groupCount, editorialReview: review.groupedReview.status, ...review.groupedReview.summary } : { humanReview: 'pending' }) }));
}
