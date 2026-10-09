#!/usr/bin/env node
/** Offline measurement only: no providers, generated readings, or score gates. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getVectorGestureDetails } from '../../src/data/cardGestureArtwork.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const options = new Map(process.argv.slice(2).map(argument => {
  const separator = argument.indexOf('=');
  if (separator < 0) throw new Error(`Expected --option=value: ${argument}`);
  return [argument.slice(0, separator), argument.slice(separator + 1)];
}));
for (const key of options.keys()) {
  if (!['--output', '--baseline-aligner', '--baseline-label'].includes(key)) throw new Error(`Unknown option ${key}`);
}
const samplePath = join(root, 'data/evaluations/narrative-samples.json');
const corpusPath = join(root, 'scripts/evaluation/fixtures/gestureAlignmentCases.json');
const recorded = JSON.parse(readFileSync(samplePath, 'utf8'));
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const edition = 'rws-immanuelle-vector';
const digest = value => createHash('sha256').update(value).digest('hex');
const ratio = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(4)) : null;
const sum = (values, field) => values.reduce((total, value) => total + value[field], 0);
const sourceHashes = alignerPath => Object.fromEntries([
  alignerPath,
  join(dirname(alignerPath), '../data/cardGestureDetails/majors.js'),
  join(dirname(alignerPath), '../data/cardGestureDetails/cupsPentacles.js'),
  join(dirname(alignerPath), '../data/cardGestureDetails/wandsSwords.js'),
  join(dirname(alignerPath), '../data/cardGestureArtwork.js')
].map(path => [relative(resolve(dirname(alignerPath), '..'), path), digest(readFileSync(path))]));

function expectedMentions(sample) {
  return (corpus.recorded[sample.id] || []).map(([card, detailId, quote]) => {
    const start = sample.reading.indexOf(quote);
    if (start < 0 || sample.reading.indexOf(quote, start + quote.length) >= 0) {
      throw new Error(`Recorded label must identify one exact quote: ${sample.id} / ${quote}`);
    }
    if (!sample.cardsInfo.some(value => value.card === card)) throw new Error(`Card outside recorded spread: ${card}`);
    if (!getVectorGestureDetails(card).some(value => value.id === detailId)) throw new Error(`Unsupported labelled detail: ${card}/${detailId}`);
    return { card, detailId, quote, start, end: start + quote.length };
  });
}

function literalMentions(result) {
  return result.associations.filter(value => value.kind === 'literal').flatMap(association =>
    association.targets.flatMap(target => target.detailIds.map(detailId => ({
      card: target.canonicalName, detailId, quote: association.passage.quote,
      start: association.passage.start, end: association.passage.end
    }))));
}
const matches = (expected, actual) => expected.card === actual.card && expected.detailId === actual.detailId
  && actual.start < expected.end && actual.end > expected.start;

async function evaluate(alignerPath, label) {
  const { alignReadingPassages } = await import(pathToFileURL(alignerPath));
  const samples = recorded.samples.map(sample => {
    const artworkEdition = sample.deckStyle === 'rws-1909' ? edition : sample.deckStyle;
    const cards = sample.cardsInfo.map((card, index) => ({ ...card, index, name: card.card, canonicalName: card.card, artworkEdition }));
    const result = alignReadingPassages({ rawText: sample.reading, cards, deckStyle: sample.deckStyle, artworkEdition,
      userQuestion: sample.userQuestion, querentReflections: sample.reflectionsText, sourceComplete: true });
    const literal = literalMentions(result);
    const expected = expectedMentions(sample).map(mention => ({ ...mention, matched: literal.some(actual => matches(mention, actual)) }));
    const identities = cards.map(card => ({ card: card.name, orientation: card.orientation,
      introduced: result.introductions.some(intro => intro.spreadIndex === card.index),
      selectedLiteralExpected: expected.filter(mention => mention.card === card.name).length,
      selectedLiteralMatched: expected.filter(mention => mention.card === card.name && mention.matched).length
    }));
    return {
      id: sample.id, originalDeckStyle: sample.deckStyle, evaluatedArtworkEdition: artworkEdition,
      identityExpected: cards.length, identityMatched: identities.filter(card => card.introduced).length, cards: identities,
      selectedLiteralExpected: expected.length, selectedLiteralMatched: expected.filter(mention => mention.matched).length,
      selectedMentions: expected, emittedLiteralMentions: literal,
      unadjudicatedLiteralMentions: literal.filter(actual => !expected.some(mention => matches(mention, actual))),
      interpretationAssociations: result.associations.filter(cue => ['interpretation', 'balance'].includes(cue.kind)).length,
      personalContextAssociations: result.associations.filter(cue => cue.personalContext).length,
      namedRelationships: result.associations.filter(cue => cue.kind === 'relationship').length,
      unsupportedEditionDetailLeaks: artworkEdition === edition ? 0 : result.associations.flatMap(cue => cue.targets).filter(target => target.detailIds.length).length
    };
  });
  const independent = corpus.independent.map(item => {
    for (const detailId of item.expected) {
      if (!getVectorGestureDetails(item.card).some(value => value.id === detailId)) throw new Error(`Unknown independent detail ${item.card}/${detailId}`);
    }
    const result = alignReadingPassages({ rawText: item.text,
      cards: [{ index: 0, name: item.card, canonicalName: item.card, orientation: item.orientation || 'Upright', artworkEdition: edition }],
      artworkEdition: edition, sourceComplete: true });
    const actual = literalMentions(result);
    const emitted = [...new Set(actual.map(value => value.detailId))];
    const matched = item.expected.filter(value => emitted.includes(value));
    return { ...item, identityMatched: result.introductions.length === 1, actual,
      expectedCount: item.expected.length, truePositives: matched.length,
      falseNegatives: item.expected.filter(value => !emitted.includes(value)),
      falsePositives: emitted.filter(value => !item.expected.includes(value)) };
  });
  const english = samples.filter(sample => sample.originalDeckStyle === 'rws-1909' && sample.id !== 'non-english-spanish');
  const selectedExpected = sum(samples, 'selectedLiteralExpected');
  const selectedMatched = sum(samples, 'selectedLiteralMatched');
  const positiveExpected = sum(independent, 'expectedCount');
  const truePositives = sum(independent, 'truePositives');
  const falsePositives = independent.reduce((total, sample) => total + sample.falsePositives.length, 0);
  const negatives = independent.filter(sample => !sample.expected.length);
  return {
    label, sourceHashes: sourceHashes(alignerPath),
    summary: {
      recorded: {
        samples: samples.length, identityExpected: sum(samples, 'identityExpected'), identityMatched: sum(samples, 'identityMatched'),
        selectedLiteralExpected: selectedExpected, selectedLiteralMatched: selectedMatched,
        selectedLiteralRecall: ratio(selectedMatched, selectedExpected),
        englishRwsSelectedExpected: sum(english, 'selectedLiteralExpected'), englishRwsSelectedMatched: sum(english, 'selectedLiteralMatched'),
        englishRwsSelectedRecall: ratio(sum(english, 'selectedLiteralMatched'), sum(english, 'selectedLiteralExpected')),
        unadjudicatedLiteralMentions: samples.reduce((total, sample) => total + sample.unadjudicatedLiteralMentions.length, 0),
        interpretationAssociations: sum(samples, 'interpretationAssociations'), personalContextAssociations: sum(samples, 'personalContextAssociations'),
        unsupportedEditionDetailLeaks: sum(samples, 'unsupportedEditionDetailLeaks')
      },
      independent: {
        passages: independent.length, positivePassages: independent.filter(sample => sample.expected.length).length, negativePassages: negatives.length,
        expectedDetails: positiveExpected, truePositives, falseNegatives: positiveExpected - truePositives, falsePositives,
        recall: ratio(truePositives, positiveExpected), precision: ratio(truePositives, truePositives + falsePositives),
        negativePassagesWithFalsePositive: negatives.filter(sample => sample.falsePositives.length).length,
        identityExpected: independent.length, identityMatched: independent.filter(sample => sample.identityMatched).length
      }
    }, samples, independent
  };
}

const current = await evaluate(join(root, 'src/lib/narrativePassageAligner.js'), 'working-tree');
const baselinePath = options.get('--baseline-aligner');
const baseline = baselinePath ? await evaluate(resolve(baselinePath), options.get('--baseline-label') || 'supplied-baseline') : null;
const report = {
  generatedAt: new Date().toISOString(),
  worktreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceRevisionNote: 'Working-tree files may differ from HEAD; sourceHashes identify the actual evaluated implementations.',
  provenance: { recordedPath: relative(root, samplePath), recordedGeneratedAt: recorded.generatedAt, recordedSha256: digest(readFileSync(samplePath)),
    corpusPath: relative(root, corpusPath), corpusSha256: digest(readFileSync(corpusPath)), method: corpus.method },
  interpretationPolicy: 'Current dynamic fallback is intentionally literal/identity-only. Zero interpretation or personal-context associations is not evidence that the full semantic product requirement is fulfilled; generated association documents need their own evaluation.',
  limitations: [
    'Recorded gold is a selected set of supported physical-detail mentions, not an exhaustive literal or interpretation annotation. Unadjudicated outputs are listed, not counted automatically as false positives.',
    'Independent passages were authored for this review, separately from runtime EXAMPLES, and frozen before measuring. They are synthetic and not unseen live model generations.',
    'RWS recordings are evaluated with the supported vector edition selected. Thoth and Marseille retain their original edition and should yield identity-only accompaniment.',
    'The Spanish RWS reading is included in the overall denominator and also separable from the English-only fallback result.',
    'This evaluates completed text alignment only, not streaming timing, mask geometry, physical devices, motion perception, or generated semantic associations.',
    'Baseline comparison, when supplied, uses its own imported rule modules and the same fixed recorded and independent corpus.'
  ],
  current,
  ...(baseline ? { baseline } : {})
};
const output = resolve(root, options.get('--output') || 'output/reading-motion/evidence/remediation-2026-10-09/alignment-evaluation.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: relative(root, output), current: current.summary, ...(baseline ? { baseline: baseline.summary } : {}) }, null, 2));
