import { createHash } from 'node:crypto';
import { ARCHETYPAL_TRIADS, SUIT_PROGRESSIONS } from '../../../src/data/knowledgeGraphData.js';
import { MINOR_ARCANA } from '../../../src/data/minorArcana.js';
import { MAJOR_ARCANA } from '../../../src/data/majorArcana.js';
import { DECK_ORDER } from '../../../shared/vision/deckCatalog.js';
import { getDeckAlias } from '../../../shared/vision/deckAssets.js';
import { COURT_MEMBER_ROLES } from '../../../functions/lib/minorPatternReferences.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reviewStatuses = new Set(['accepted', 'correction_required', 'owner_decision']);
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function groupKey(row) {
  switch (row.kind) {
    case 'full': case 'enriched': return `canon:${row.sourceId}`;
    case 'pair': return `pair:${row.patternId}:${[...row.matchedCards].sort((a, b) => a - b).join('-')}`;
    case 'directMajor': return `pair:${row.patternId}`;
    case 'directMinor': case 'referenceMinor': return `minor:${row.patternId.split(':').slice(0, 2).join(':')}`;
    case 'directCourt': case 'referenceCourt': return `court:${row.patternId.split(':')[0]}`;
    default: throw new Error(`Unsupported editorial kind: ${row.kind}`);
  }
}

// Include every field read by the reviewer, plus source and projection identity.
// Legacy human metadata is preserved on raw rows and never copied into agent verdicts.
function reviewMaterial(row) {
  const { reviewerType: _reviewerType, humanStatus: _humanStatus, fidelityStatus: _fidelityStatus,
    absentStageStatus: _absentStageStatus, notes: _notes, ...material } = row;
  return material;
}

export function checkEditorialMechanics(rows) {
  const issues = [];
  const seen = new Set();
  const add = (row, code, detail) => issues.push({ rowId: row.reviewId, code, detail });
  for (const row of rows) {
    if (seen.has(row.reviewId)) add(row, 'duplicate_review_id', 'A raw row identity occurs more than once.');
    seen.add(row.reviewId);
    const textHash = digest([row.title, row.theme, row.authoredText, row.suppliedText, row.anchors]);
    if (textHash !== row.textHash || digest([row.kind, row.sourceId, row.projectionId, textHash]) !== row.reviewId) {
      add(row, 'stale_row_hash', 'The recorded row hash does not bind its current text and identity.');
    }
    if (!DECK_ORDER.includes(row.deckStyle)) add(row, 'unknown_deck', 'The selected deck is not supported.');
    if (row.runtimeStatus !== 'available' || !row.suppliedText?.trim()) add(row, 'unavailable_text', 'The row does not supply usable runtime text.');
    if (row.deckStyle !== row.sourceDeck && row.anchors.length) add(row, 'foreign_visual_anchor', 'Cross-deck projections must not retain source-deck visual anchors.');
    if (['full', 'pair', 'enriched'].includes(row.kind) && row.deckStyle !== 'rws-1909') {
      const supplied = [row.title, row.theme, row.suppliedText].join('\n');
      for (const card of MAJOR_ARCANA) {
        const alias = getDeckAlias(card, row.deckStyle).split(' (RWS:')[0];
        if (alias !== card.name && !alias.includes(card.name) && new RegExp(`\\b${escapeRegExp(card.name)}\\b`).test(supplied)) {
          add(row, 'foreign_card_label', `${card.name} should use ${alias} in supplied text.`);
        }
      }
    }
    if (row.kind === 'pair') {
      const triad = ARCHETYPAL_TRIADS.find(triad => triad.id === row.patternId);
      if (!triad || row.matchedCards?.length !== 2 || new Set(row.matchedCards).size !== 2 || !row.matchedCards.every(card => triad.cards.includes(card))) {
        add(row, 'invalid_pair_membership', 'The pair must contain exactly two distinct members of its source triad.');
      }
      if (row.anchors.length || row.suppliedText === row.authoredText) add(row, 'full_arc_in_pair', 'Partial references cannot inherit full-arc prose or imagery.');
    }
    if (['directMinor', 'referenceMinor'].includes(row.kind)) {
      const [suit, stageName, selected] = row.patternId.split(':');
      const stage = SUIT_PROGRESSIONS[suit]?.[stageName];
      const ranks = selected?.split('-').map(Number) || [];
      if (!stage || ranks.length < 2 || new Set(ranks).size !== ranks.length || !ranks.every(rank => stage.cards.some(card => card.rank === rank))) {
        add(row, 'invalid_minor_membership', 'The grouping includes an unsupported or repeated member.');
        continue;
      }
      for (const member of stage.cards) {
        const drawn = ranks.includes(member.rank);
        if (drawn && !row.suppliedText.includes(member.role)) add(row, 'missing_drawn_role', member.name);
        if (!drawn && row.suppliedText.includes(member.role)) add(row, 'absent_member_role', member.name);
        if (drawn) {
          const label = getDeckAlias(MINOR_ARCANA.find(card => card.name === member.name), row.deckStyle);
          if (!row.suppliedText.includes(`${label}${row.kind === 'directMinor' ? ' (' : ':'}`)) add(row, 'missing_deck_label', label);
        }
      }
      const complete = ranks.length === stage.cards.length;
      if (complete !== row.suppliedText.includes(`Complete symbolic grouping: ${stage.completeTheme}`)) add(row, 'stage_completion_mismatch', row.patternId);
      if (!complete && !row.suppliedText.includes('absent members supply no theme')) add(row, 'missing_partial_boundary', row.patternId);
      if (!row.suppliedText.includes('without assuming chronological order')) add(row, 'missing_order_boundary', row.patternId);
    }
    if (row.kind === 'directCourt') {
      const [suit, , sizeText] = row.patternId.split(':');
      const size = Number(sizeText);
      if (![2, 3].includes(size) || !Object.hasOwn(SUIT_PROGRESSIONS, suit)) {
        add(row, 'invalid_court_membership', row.patternId);
        continue;
      }
      for (const rank of ['Page', 'Queen', 'King'].slice(3 - size)) {
        const card = MINOR_ARCANA.find(card => card.name === `${rank} of ${suit}`);
        const alias = getDeckAlias(card, row.deckStyle);
        if (!row.suppliedText.includes(alias)) add(row, 'missing_court_label', alias);
      }
      if (!row.suppliedText.includes('do not infer actual people, family history, or events')) add(row, 'missing_court_boundary', row.patternId);
    }
    if (row.kind === 'referenceCourt') {
      const [suit, , membership] = row.patternId.split(':');
      const ranks = membership?.split('-') || [];
      if (!Object.hasOwn(COURT_MEMBER_ROLES, suit) || ranks.length < 2 || new Set(ranks).size !== ranks.length
        || !ranks.every(rank => Object.hasOwn(COURT_MEMBER_ROLES[suit], rank))) {
        add(row, 'invalid_court_membership', row.patternId);
        continue;
      }
      for (const [rank, role] of Object.entries(COURT_MEMBER_ROLES[suit])) {
        const drawn = ranks.includes(rank);
        if (drawn && !row.suppliedText.includes(role)) add(row, 'missing_court_role', rank);
        if (!drawn && row.suppliedText.includes(role)) add(row, 'absent_court_role', rank);
        const label = getDeckAlias(MINOR_ARCANA.find(card => card.name === `${rank} of ${suit}`), row.deckStyle);
        if (drawn && !row.suppliedText.includes(`${label}:`)) add(row, 'missing_court_label', label);
      }
      if ((ranks.length === 4) !== row.suppliedText.includes('Complete symbolic grouping:')) add(row, 'court_completion_mismatch', row.patternId);
      if (ranks.length < 4 && !row.suppliedText.includes('absent members supply no theme')) add(row, 'missing_partial_boundary', row.patternId);
      if (!row.suppliedText.includes('do not infer actual people, family history, or events')) add(row, 'missing_court_boundary', row.patternId);
    }
  }
  return { checkedRows: rows.length, status: issues.length ? 'failed' : 'passed', issues };
}

/** Grouping reduces repeated reading; every member still participates in identity and checks. */
export function buildGroupedEditorialReview(rows, { verdicts = [] } = {}) {
  const grouped = new Map();
  for (const row of rows) {
    const id = groupKey(row);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  const mechanical = checkEditorialMechanics(rows);
  const groups = [...grouped].map(([id, members]) => {
    const material = members.map(reviewMaterial).sort((a, b) => a.reviewId.localeCompare(b.reviewId));
    const inputHash = digest(material);
    const variants = new Map();
    for (const row of members) {
      const variantHash = digest([row.kind, row.title, row.theme, row.suppliedText, row.anchors]);
      if (!variants.has(variantHash)) variants.set(variantHash, { kind: row.kind, title: row.title, theme: row.theme, suppliedText: row.suppliedText, anchors: row.anchors, rowIds: [], decks: [] });
      const variant = variants.get(variantHash);
      variant.rowIds.push(row.reviewId);
      if (!variant.decks.includes(row.deckStyle)) variant.decks.push(row.deckStyle);
    }
    const candidates = verdicts.filter(verdict => verdict.groupId === id && verdict.inputHash === inputHash && verdict.reviewerType === 'agent');
    const decision = candidates.length === 1 ? candidates[0] : null;
    const validChoice = decision?.status !== 'owner_decision' || (decision.question?.trim() && decision.recommendation?.trim() && decision.alternatives?.length >= 2);
    const validCorrection = decision?.status !== 'correction_required' || (decision.findingIds?.length > 0);
    const review = decision && reviewStatuses.has(decision.status) && decision.notes?.trim() && validChoice && validCorrection
      ? { ...decision } : { reviewerType: null, status: 'pending', notes: '' };
    const rowIds = members.map(row => row.reviewId);
    return { id, category: id.split(':')[0], inputHash, rowIds, variants: [...variants.values()],
      mechanicalIssues: mechanical.issues.filter(issue => rowIds.includes(issue.rowId)), review };
  });
  const summary = {
    accepted: groups.filter(group => group.review.status === 'accepted').length,
    corrections: groups.filter(group => group.review.status === 'correction_required').length,
    ownerDecisions: groups.filter(group => group.review.status === 'owner_decision').length,
    pending: groups.filter(group => group.review.status === 'pending').length
  };
  return { schemaVersion: 1, policy: 'agent-review-with-owner-exceptions', humanApprovalRequired: false,
    rowCount: rows.length, groupCount: groups.length, inputHash: digest(groups.map(group => [group.id, group.inputHash])),
    status: summary.pending ? 'review_pending' : mechanical.issues.length || summary.corrections || summary.ownerDecisions ? 'review_complete_with_findings' : 'review_complete',
    mechanical, summary, groups };
}

export function renderGroupedEditorialReview(review) {
  const grouped = review.groupedReview;
  const escape = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    '# Reading pipeline grouped editorial review', '',
    `Status: **${grouped.status}**. ${grouped.rowCount} coverage rows are grouped into **${grouped.groupCount} editorial units**. Human approval of every row is not required.`, '',
    'The user authorized agent review with owner exceptions. Reviewer identity remains explicit; legacy human fields in the raw JSON record only whether a human verdict exists. They are not a human task queue. Regenerate with `node scripts/evaluation/buildCanonProjectionReview.js --pipeline`.', '',
    `Mechanical checks: **${grouped.mechanical.status}**, ${grouped.mechanical.checkedRows} rows, ${grouped.mechanical.issues.length} issues. These checks establish identity, available text, selected Minor labels/roles, pair membership and visual-anchor boundaries; they do not judge meaning.`, '',
    `Agent verdicts: ${grouped.summary.accepted} accepted; ${grouped.summary.corrections} require correction; ${grouped.summary.ownerDecisions} require owner judgment; ${grouped.summary.pending} unreviewed.`, '',
    'Each canon source groups its deck projections. Each pair groups its three projections and direct Major theme. Minor groups retain every direct and retrieved membership/deck rendering under the authored suit/stage template; court groups include the direct highlights and every two-, three- and four-member retrieved subset. Exact duplicate supplied text is displayed once. All row identities, original text and per-variant material remain in [the raw inventory](READING_PIPELINE_EDITORIAL_REVIEW.json). Any changed, added or removed member invalidates the group verdict.', '',
    'Read the [agent findings and scope](READING_PIPELINE_AGENT_REVIEW.md) for concrete defects, proposed corrections and owner exceptions. Explicit source-bound agent verdicts are in [the verdict file](READING_PIPELINE_AGENT_VERDICTS.json). Human approval of external enrichment remains a separate publication policy and is unchanged.', '',
    '| Group | Rows | Distinct rendered variants | Agent verdict | Notes |',
    '| --- | ---: | ---: | --- | --- |',
    ...grouped.groups.map(group => `| ${escape(group.id)} | ${group.rowIds.length} | ${group.variants.length} | ${group.review.status} | ${escape(group.review.notes)} |`), '',
    '## Mechanical findings', '',
    ...(grouped.mechanical.issues.length ? grouped.mechanical.issues.map(issue => `- ${issue.code}: ${issue.rowId} — ${issue.detail}`) : ['No mechanical issue found in the current inventory.']), '',
    '## Owner decisions', '',
    ...(grouped.summary.ownerDecisions ? grouped.groups.filter(group => group.review.status === 'owner_decision').map(group => `- ${group.id}: ${group.review.question} Recommendation: ${group.review.recommendation}`) : ['No owner decision recorded. Missing human metadata never creates an owner decision.']), ''
  ].join('\n');
}
