import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MAJOR_ARCANA_PASSAGES, getPassagesForPattern } from '../functions/lib/knowledgeBase.js';
import {
  PASSAGE_CONTEXTS,
  assessEvidence,
  buildDigest,
  detectCard,
  extractEvidence
} from '../scripts/enrichment/lib/knowledgeExtraction.js';
import { DRAFT_LIMITS, validateDraft } from '../scripts/enrichment/lib/passageDraft.js';
import { selectApprovedRows } from '../scripts/enrichment/applyPassageCandidates.js';
import { buildCandidates, normalizeSourceUrl } from '../scripts/enrichment/buildPassageCandidates.js';
import { stringifyRow } from '../scripts/evaluation/lib/csv.js';

const BIDDY_TEXT = `
# The Fool Tarot Card Meanings

## The Fool Keywords

UPRIGHT: Beginnings, innocence, spontaneity, a free spirit

REVERSED: Holding back, recklessness, risk-taking

## The Fool Description

The Fool is numbered 0 and stands on the edge of a cliff. The white rose in his
left hand represents his purity and innocence.
`;

const PLAYING_CARD_DECKS_TEXT = `
Skip to content
Fool Tarot Card Meanings
Tarot Blog
The Fool is normally the first card in the major arcana group.
Point 1 – ZERO
The number of The Fool offers some initial insights.
Point 2 – YELLOW SKY
The yellow sky could represent the dawning day.
Point 5 – WHITE ROSE
The white rose could illustrate The Fool's innocence and purity.
Point 8 – WHITE DOG
The dog that is at The Fool's heels.
Tarot Reading
Upright
In Tarot readings, if The Fool card is upright, then it is a sign of new
beginnings and fresh starts.
Reverse
If The Fool is reverse, then it is a sign of hesitation and or a lack of
confidence.
`;

async function candidateWorkspace(t, runs) {
  const prefix = path.join(os.tmpdir(), 'passage-review-test-');
  const dir = await fs.mkdtemp(prefix);
  assert.ok(path.resolve(dir).startsWith(prefix));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const sourceDir = path.join(dir, 'sources');
  const queue = path.join(dir, 'queue.csv');
  await fs.mkdir(sourceDir);
  for (const [name, run] of Object.entries(runs)) {
    await fs.writeFile(path.join(sourceDir, name), JSON.stringify(run));
  }
  return { sourceDir, queue, draft: false, log: () => {} };
}

const FOOL_SOURCE = {
  url: 'https://example.com/fool',
  title: 'The Fool Tarot Card Meanings',
  statusCode: 200,
  content: BIDDY_TEXT
};

for (const verdict of ['approve', 'approved', 'reject']) {
  test(`regenerating candidates preserves the exact ${verdict} row and its reviewed draft`, async (t) => {
    const options = await candidateWorkspace(t, { 'run.json': { sources: [FOOL_SOURCE] } });
    const initial = await buildCandidates(options);
    const reviewed = {
      ...initial.rows[0],
      context: 'transition',
      draft_text: 'A leap asks for trust before it asks for proof. Let curiosity lead the way and keep learning part of the path rather than a test you can fail.',
      draft_tags: 'beginnings trust curiosity',
      validation: 'ok',
      generated_at: '2026-10-20T12:00:00.000Z',
      model: 'reviewed-model',
      human_verdict: verdict,
      human_notes: 'Keep this exact wording, tags, and context.'
    };
    const columns = Object.keys(reviewed);
    const reviewedCsv = `${columns.join(',')}\n${stringifyRow(columns.map((column) => reviewed[column]))}\n`;
    await fs.writeFile(options.queue, reviewedCsv);

    await buildCandidates(options);

    assert.equal(await fs.readFile(options.queue, 'utf8'), reviewedCsv);
    const selected = selectApprovedRows(await fs.readFile(options.queue, 'utf8'));
    assert.equal(selected.approved.length, verdict === 'reject' ? 0 : 1);
  });
}

for (const blocked of [
  { url: FOOL_SOURCE.url, error: 'Source returned HTTP 403' },
  { ...FOOL_SOURCE, content: '# Just a moment...\nThe Fool tarot\nUPRIGHT: Beginnings\nREVERSED: Holding back' }
]) {
  test(`a ${blocked.error ? 'failed' : 'challenge'} capture cannot hide a newer usable copy`, async (t) => {
    const options = await candidateWorkspace(t, {
      'a-old.json': { fetchedAt: '2026-10-20T12:00:00.000Z', sources: [blocked] },
      'z-new.json': { fetchedAt: '2026-10-21T12:00:00.000Z', sources: [{ ...FOOL_SOURCE, url: `${FOOL_SOURCE.url}/` }] }
    });
    const result = await buildCandidates({ ...options, limit: 1 });
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].source_url, `${FOOL_SOURCE.url}/`);
    assert.match(result.rows[0].evidence, /innocence/);
  });
}

test('source selection uses the newest usable capture regardless of filename order', async (t) => {
  const options = await candidateWorkspace(t, {
    'z-new.json': { fetchedAt: '2026-10-21T12:00:00.000Z', sources: [{ ...FOOL_SOURCE, title: 'Newest Fool tarot source' }] },
    'a-old.json': { fetchedAt: '2026-10-20T12:00:00.000Z', sources: [FOOL_SOURCE] },
    'zz-failed.json': { fetchedAt: '2026-10-22T12:00:00.000Z', sources: [{ url: FOOL_SOURCE.url, error: 'Blocked' }] }
  });
  const result = await buildCandidates(options);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].source_title, 'Newest Fool tarot source');
});

test('a newer blocked capture cannot replace usable evidence from an older run', async (t) => {
  const options = await candidateWorkspace(t, {
    'a-new.json': {
      fetchedAt: '2026-10-21T12:00:00.000Z',
      sources: [{ ...FOOL_SOURCE, statusCode: 403, title: 'Blocked Fool tarot source' }]
    },
    'z-old.json': { fetchedAt: '2026-10-20T12:00:00.000Z', sources: [FOOL_SOURCE] }
  });
  const result = await buildCandidates({ ...options, limit: 1 });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].source_title, 'The Fool Tarot Card Meanings');
  assert.ok(result.skipped.some((entry) => /HTTP 403/.test(entry.reason)));
});

test('detectCard identifies the card and requires a tarot context signal', () => {
  const detected = detectCard({ title: 'The Fool Tarot Card Meanings', content: BIDDY_TEXT }, MAJOR_ARCANA);
  assert.equal(detected.cardNumber, 0);
  assert.equal(detected.cardName, 'The Fool');
  assert.equal(detected.confidence, 'high');
  assert.equal(detectCard({ title: 'The Sun', content: 'The Sun was warm today and the world went on.' }, MAJOR_ARCANA), null);
});

test('detectCard does not confuse one major with another', () => {
  const detected = detectCard({
    title: 'The Magician Tarot Card Meanings',
    content: 'The Magician upright is about skill and focus. The Fool can appear too.'
  }, MAJOR_ARCANA);
  assert.equal(detected.cardName, 'The Magician');
});

test('extractEvidence reads inline keyword lines', () => {
  const evidence = extractEvidence(BIDDY_TEXT);
  assert.deepEqual(evidence.uprightKeywords, ['Beginnings', 'innocence', 'spontaneity', 'a free spirit']);
  assert.deepEqual(evidence.reversedKeywords, ['Holding back', 'recklessness', 'risk-taking']);
});

test('extractEvidence reads point headings and orientation sections', () => {
  const evidence = extractEvidence(PLAYING_CARD_DECKS_TEXT);
  assert.deepEqual(evidence.symbols, ['ZERO', 'YELLOW SKY', 'WHITE ROSE', 'WHITE DOG']);
  assert.match(evidence.uprightText, /new beginnings and fresh starts/);
  assert.match(evidence.reversedText, /hesitation and or a lack of confidence/);
});

test('assessEvidence rejects sources without any orientation signal', () => {
  assert.equal(assessEvidence(extractEvidence('A general article about tarot history.')).sufficient, false);
  assert.equal(assessEvidence(extractEvidence(BIDDY_TEXT)).sufficient, true);
});

test('buildDigest stays bounded and carries the extracted facts', () => {
  const card = { cardNumber: 0, cardName: 'The Fool' };
  const digest = buildDigest({ card, evidence: extractEvidence(PLAYING_CARD_DECKS_TEXT), maxChars: 400 });
  assert.ok(digest.length <= 400);
  assert.match(digest, /Card: The Fool \(Major Arcana 0\)/);
  assert.match(digest, /Symbols depicted: ZERO/);
});

test('validateDraft accepts a canon-shaped passage and rejects predictive or source phrasing', () => {
  const good = {
    text: 'A leap asks for trust before it asks for proof. Let curiosity lead the way and keep learning part of the path rather than a test you can fail.',
    tags: ['beginnings', 'trust', 'curiosity'],
    context: 'transition'
  };
  assert.equal(validateDraft(good).valid, true);

  const predictive = { ...good, text: 'You will definitely find new beginnings and the universe has your back forever in this transition.' };
  const errors = validateDraft(predictive).errors.join(' ');
  assert.match(errors, /predictive phrasing/);
  assert.match(errors, /source voice/);

  assert.match(validateDraft({ ...good, text: 'Too short.' }).errors.join(' '), /minimum is/);
  assert.match(validateDraft({ ...good, text: `${good.text} ${'x'.repeat(200)}` }).errors.join(' '), /maximum is/);
  assert.match(validateDraft({ ...good, tags: ['a', 'b'] }).errors.join(' '), /Expected 3 to 5 tags/);
  assert.match(validateDraft({ ...good, tags: ['Beginnings', 'Trust'] }).errors.join(' '), /lowercase/);
  assert.match(validateDraft({ ...good, context: 'general' }).errors.join(' '), /is not one of/);
  assert.match(validateDraft({ ...good, text: 'Take that leap of faith!' }).errors.join(' '), /source voice/);
});

test('every approved context is a real reading context', () => {
  assert.ok(PASSAGE_CONTEXTS.includes('career'));
  assert.ok(!PASSAGE_CONTEXTS.includes('general'));
  assert.ok(PASSAGE_LIMITS_SANE());
});

function PASSAGE_LIMITS_SANE() {
  return DRAFT_LIMITS.minChars < DRAFT_LIMITS.maxChars
    && DRAFT_LIMITS.minTags <= DRAFT_LIMITS.maxTags;
}

test('the review queue only applies rows a reviewer approved', () => {
  const header = 'candidate_id,card_number,card_name,context,source_url,source_title,draft_text,draft_tags,generated_at,model,human_verdict,human_notes';
  const valid = 'A leap asks for trust before it asks for proof. Let curiosity lead the way and keep learning part of the path rather than a test you can fail.';
  const csv = [
    header,
    `c1,0,The Fool,transition,https://example.com/a,Title A,"${valid}",beginnings trust curiosity,2026-10-21T00:00:00.000Z,claude-opus-5-5,approve,`,
    `c2,1,The Magician,career,https://example.com/b,Title B,"${valid}",skill focus agency,2026-10-21T00:00:00.000Z,claude-opus-5-5,reject,`,
    `c3,2,The High Priestess,general,https://example.com/c,Title C,"${valid}",intuition patience,2026-10-21T00:00:00.000Z,claude-opus-5-5,approve,`,
    `c4,3,The Empress,,https://example.com/d,Title D,"${valid}",nurture abundance,2026-10-21T00:00:00.000Z,claude-opus-5-5,,`
  ].join('\n');

  const { approved, rejected } = selectApprovedRows(csv);
  assert.equal(approved.length, 1);
  assert.equal(approved[0].candidateId, 'c1');
  assert.equal(approved[0].context, 'transition');
  assert.deepEqual(approved[0].tags, ['beginnings', 'trust', 'curiosity']);
  assert.equal(rejected.length, 2);
  assert.ok(rejected.some((entry) => entry.candidateId === 'c2' && entry.verdict === 'reject'));
  assert.ok(rejected.some((entry) => entry.candidateId === 'c3' && /validation failed/.test(entry.verdict)));
  assert.ok(!rejected.some((entry) => entry.candidateId === 'c4'));
});

test('the review queue rejects rows whose required columns are missing', () => {
  assert.throws(() => selectApprovedRows('candidate_id,card_number\nc1,0\n'), /missing the "card_name" column/);
});

test('source URLs normalize so the same page is only enriched once', () => {
  assert.equal(
    normalizeSourceUrl('https://biddytarot.com/tarot-card-meanings/major-arcana/fool/'),
    normalizeSourceUrl('https://biddytarot.com/tarot-card-meanings/major-arcana/fool')
  );
  assert.equal(
    normalizeSourceUrl('https://www.biddytarot.com/tarot-card-meanings/major-arcana/fool/'),
    normalizeSourceUrl('https://biddytarot.com/tarot-card-meanings/major-arcana/fool')
  );
  assert.notEqual(
    normalizeSourceUrl('https://example.com/fool'),
    normalizeSourceUrl('https://example.com/magician')
  );
  assert.equal(normalizeSourceUrl('https://example.com/a#section'), 'https://example.com/a');
});

test('only one approved passage can occupy a card and context slot', () => {
  const header = 'candidate_id,card_number,card_name,context,source_url,source_title,draft_text,draft_tags,generated_at,model,human_verdict,human_notes';
  const valid = 'A leap asks for trust before it asks for proof. Let curiosity lead the way and keep learning part of the path rather than a test you can fail.';
  const csv = [
    header,
    `c1,0,The Fool,transition,https://example.com/a,Title A,"${valid}",beginnings trust curiosity,2026-10-21T00:00:00.000Z,claude-opus-5-5,approve,`,
    `c2,0,The Fool,transition,https://example.com/b,Title B,"${valid}",beginnings trust courage,2026-10-21T00:00:00.000Z,claude-opus-5-5,approve,`,
    `c3,0,The Fool,career,https://example.com/c,Title C,"${valid}",skill focus agency,2026-10-21T00:00:00.000Z,claude-opus-5-5,approve,`
  ].join('\n');

  const { approved, rejected } = selectApprovedRows(csv);
  assert.equal(approved.length, 2);
  assert.deepEqual(approved.map((entry) => entry.candidateId), ['c1', 'c3']);
  assert.ok(rejected.some((entry) => entry.candidateId === 'c2' && /duplicate slot/.test(entry.verdict)));
});

test('the knowledge base keeps one general canon passage per major card', () => {
  for (const card of MAJOR_ARCANA) {
    const entry = MAJOR_ARCANA_PASSAGES[card.number];
    assert.ok(entry, `Missing canon entry for ${card.name}`);
    const general = entry.passages.filter((passage) => passage.context === 'general');
    assert.equal(general.length, 1, `${card.name} should keep exactly one general passage`);
  }
  const entry = getPassagesForPattern('major-arcana', '0');
  assert.equal(entry.title, 'The Fool');
  assert.equal(entry.theme, 'Beginnings & Open Faith');
});
