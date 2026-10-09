import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { runClaudeCode, verifySubscriptionLogin } from '../../services/claude-code/runner.mjs';
import { generatedPassageDocumentSchema, compilePassageAnnotations } from '../../shared/contracts/generatedPassageAnnotations.js';
import { buildPassageAnnotationPrompt, PASSAGE_ANNOTATION_PROMPT_VERSION } from '../../shared/generation/passageAnnotationPrompt.js';
import { getVectorGestureDetails } from '../../src/data/cardGestureArtwork.js';
import { alignReadingPassages } from '../../src/lib/narrativePassageAligner.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputPath = path.join(root, 'output/reading-motion/fixtures/generated-gesture-readings.json');
const reportDirectory = path.join(root, 'output/reading-motion/evidence/2026-10-09-generated-associations');
const edition = 'rws-immanuelle-vector';
const model = 'claude-opus-5-5';
const effort = 'xhigh';
const digest = text => createHash('sha256').update(text).digest('hex');
const cards = (names, reversed = []) => names.map((card, index) => ({ card, position: names.length === 3 ? ['Situation', 'Invitation', 'Direction'][index] : ['Core', 'Challenge', 'Hidden', 'Support', 'Direction'][index], orientation: reversed.includes(index) ? 'Reversed' : 'Upright' }));

export const GENERATION_CASES = [
  { id: 'new-home-rhythm', language: 'en', userQuestion: 'How can I find a sustainable rhythm after moving to a new city?', reflectionsText: 'I miss familiar routines, but I also want room to explore.', cards: cards(['The Star', 'The Hermit', 'Three of Pentacles'], [1]) },
  { id: 'creative-boundaries', language: 'en', userQuestion: 'What would help me share my creative work without losing my own voice?', reflectionsText: 'Feedback helps until I start trying to please everyone.', cards: cards(['Ace of Wands', 'Queen of Cups', 'Seven of Swords'], [2]) },
  { id: 'fair-leadership', language: 'en', userQuestion: 'How can I lead a small team with clearer boundaries and more fairness?', reflectionsText: '', cards: cards(['The Emperor', 'Justice', 'Six of Pentacles'], [0]) },
  { id: 'first-small-step', language: 'en', userQuestion: 'What should I consider before beginning an evening class?', reflectionsText: '', cards: cards(['The Fool', 'Eight of Pentacles', 'Two of Wands']) },
  { id: 'community-project', language: 'en', userQuestion: 'How can our community project gain momentum without burning people out?', reflectionsText: 'We have many ideas, but meetings keep getting longer.', cards: cards(['The Magician', 'Five of Wands', 'Temperance', 'Four of Wands', 'Wheel of Fortune'], [1, 4]) },
  { id: 'gentle-departure', language: 'en', userQuestion: 'What might help me leave an old volunteer role thoughtfully?', reflectionsText: 'I care about the people and still need more space.', cards: cards(['Eight of Cups', 'Four of Pentacles', 'Six of Swords'], [1]) },
  { id: 'uncertain-choice', language: 'en', userQuestion: 'How can I approach a decision when neither option feels fully clear?', reflectionsText: '', cards: cards(['Two of Swords', 'The High Priestess', 'Page of Pentacles'], [0]) },
  { id: 'friendship-repair', language: 'en', userQuestion: 'What can I bring to a conversation with a friend after a misunderstanding?', reflectionsText: 'I want to listen without pretending I was not hurt.', cards: cards(['Three of Swords', 'Two of Cups', 'Strength'], [0]) },
  { id: 'rest-and-courage', language: 'en', userQuestion: 'How can I make space for rest while preparing for a demanding month?', reflectionsText: '', cards: cards(['Nine of Wands', 'Four of Swords', 'The Sun'], [0]) },
  { id: 'changing-routine', language: 'en', userQuestion: 'How can I respond when a familiar routine no longer fits?', reflectionsText: 'I am relieved by the possibility of change and uneasy about losing structure.', cards: cards(['Death', 'The Hanged Man', 'Knight of Pentacles', 'Queen of Wands', 'The World'], [1, 2]) },
  { id: 'shared-resources', language: 'en', userQuestion: 'What should I pay attention to as my housemates and I divide shared responsibilities?', reflectionsText: '', cards: cards(['Ten of Wands', 'King of Swords', 'Three of Cups'], [0]) },
  { id: 'speaking-clearly', language: 'en', userQuestion: 'How can I explain an unpopular idea with care?', reflectionsText: 'I rush when I feel misunderstood.', cards: cards(['Knight of Swords', 'Queen of Swords', 'Page of Cups'], [0]) },
  { id: 'slow-recognition', language: 'en', userQuestion: 'What can help me notice progress when a long project moves slowly?', reflectionsText: '', cards: cards(['Seven of Pentacles', 'Six of Wands', 'Nine of Cups'], [1]) },
  { id: 'ritmo-compartido', language: 'es', userQuestion: '¿Cómo puedo encontrar un ritmo más amable al comenzar a convivir?', reflectionsText: 'Quiero cuidar el vínculo sin abandonar mis propios espacios.', cards: cards(['Temperance', 'Four of Wands', 'The Hermit'], [2]) },
  { id: 'voz-creativa', language: 'es', userQuestion: '¿Qué podría ayudarme a compartir mi trabajo creativo con más confianza?', reflectionsText: '', cards: cards(['The Empress', 'Page of Wands', 'Judgement'], [1]) }
];

function counts(associations) {
  return Object.fromEntries(['identity', 'literal', 'interpretation', 'balance', 'relationship'].map(kind => [kind, associations.filter(cue => cue.kind === kind).length]));
}

export function validateGeneratedSample(sample) {
  if (!sample.document) return { generationError: sample.generationError };
  const normalized = sample.cards.map((card, index) => ({ ...card, index, canonicalName: card.card }));
  const compiled = compilePassageAnnotations(sample.document, { cards: normalized, artworkEdition: edition, getSupportedDetails: getVectorGestureDetails, userQuestion: sample.userQuestion, reflections: sample.reflectionsText });
  const associations = compiled.payload?.associations || [];
  const fallback = alignReadingPassages({ rawText: sample.document.raw, cards: normalized, artworkEdition: edition, userQuestion: sample.userQuestion, querentReflections: sample.reflectionsText });
  const literalReferences = associations.filter(cue => cue.kind === 'literal').flatMap(cue => cue.targets.flatMap(target => target.detailIds.map(detailId => ({ passage: cue.passage, spreadIndex: target.spreadIndex, detailId }))));
  const fallbackLiteralMatches = literalReferences.filter(reference => fallback.associations.some(cue => cue.kind === 'literal'
    && cue.passage.start < reference.passage.end && cue.passage.end > reference.passage.start
    && cue.targets.some(target => target.spreadIndex === reference.spreadIndex && target.detailIds.includes(reference.detailId)))).length;
  return { errors: compiled.errors, suppliedAnnotations: sample.document.annotations.length, acceptedAnnotations: associations.length, compiledCounts: counts(associations), fallbackCounts: counts(fallback.associations), personalContextCount: associations.filter(cue => cue.personalContext).length, introducedCards: compiled.payload?.introductions?.length || 0, modelLiteralReferences: literalReferences.length, fallbackLiteralMatches, rawSha256: digest(sample.document.raw), wordCount: sample.document.raw.trim().split(/\s+/u).length };
}

export async function main(args = process.argv.slice(2)) {
  const limitFlag = args.indexOf('--limit');
  const limit = limitFlag >= 0 ? Number(args[limitFlag + 1]) : GENERATION_CASES.length;
  if (!Number.isInteger(limit) || limit < 1 || limit > GENERATION_CASES.length) throw new Error('Limit must be between 1 and 15.');
  const evaluateOnly = args.includes('--evaluate-only');
  const retryFailed = args.includes('--retry-failed');
  let dataset;
  try { dataset = JSON.parse(await readFile(outputPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const initial = { provenance: { experiment: 'Fresh reading and annotation generation; no regex fixtures or prior reading prose supplied', provider: 'claude-code', model, effort, authentication: 'Existing subscription verified by runClaudeCode; paid API fallback unavailable', promptVersion: PASSAGE_ANNOTATION_PROMPT_VERSION, startedAt: new Date().toISOString(), plannedCases: GENERATION_CASES.length, languageScope: ['en', 'es'], limitations: 'Structural acceptance does not establish semantic accuracy, psychological truth, all-card recall, or production integration. Synthetic questions only; no user PII.' }, samples: [] };
  dataset = { ...initial, ...dataset, provenance: { ...initial.provenance, ...dataset?.provenance, status: 'running', model, effort, promptVersion: PASSAGE_ANNOTATION_PROMPT_VERSION } };
  let saves = Promise.resolve();
  const saveIncrement = () => {
    const text = `${JSON.stringify(dataset, null, 2)}\n`;
    saves = saves.then(async () => { await writeFile(`${outputPath}.tmp`, text); await rename(`${outputPath}.tmp`, outputPath); });
    return saves;
  };
  const responseSchema = z.toJSONSchema(generatedPassageDocumentSchema, { target: 'draft-7' });
  dataset.provenance.responseSchemaDraft = 'draft-7';
  dataset.provenance.responseSchemaSha256 = digest(JSON.stringify(responseSchema));
  dataset.provenance.compilerSha256 = digest(await readFile(path.join(root, 'shared/contracts/generatedPassageAnnotations.js'), 'utf8'));
  dataset.provenance.promptModuleSha256 = digest(await readFile(path.join(root, 'shared/generation/passageAnnotationPrompt.js'), 'utf8'));
  let cursor = 0;
  const pending = GENERATION_CASES.slice(0, limit).filter(sample => !dataset.samples.some(saved => saved.id === sample.id && (!retryFailed || saved.document)));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(reportDirectory, { recursive: true });
  if (!evaluateOnly && pending.length) {
    await verifySubscriptionLogin({ signal: AbortSignal.timeout(30000) });
    console.log(`Subscription verified; generating ${pending.length} cases with ${model}/${effort}, concurrency 2.`);
    await Promise.all([0, 1].map(async () => {
      while (cursor < pending.length) {
        const sample = pending[cursor++];
        const detailCatalog = sample.cards.map((card, spreadIndex) => ({ spreadIndex, canonicalName: card.card, details: getVectorGestureDetails(card.card).map(({ id, terms }) => ({ id, terms })) }));
        const prompt = buildPassageAnnotationPrompt({ ...sample, detailCatalog });
        const startedAt = new Date().toISOString();
        let saved;
        try {
          const result = await runClaudeCode({ task: 'reading', ...prompt, responseSchema, model, effort, maxOutputTokens: 12000 }, { signal: AbortSignal.timeout(600000) });
          saved = { ...sample, document: result.structured, generation: { startedAt, completedAt: new Date().toISOString(), actualModel: result.model, usage: result.usage, promptSha256: digest(JSON.stringify(prompt)), responseText: result.text } };
          await writeFile(path.join(reportDirectory, `${sample.id}.json`), `${JSON.stringify({ input: { ...sample, detailCatalog }, prompt, result }, null, 2)}\n`);
        } catch (error) {
          saved = { ...sample, generationError: error.message, generation: { startedAt, completedAt: new Date().toISOString() } };
        }
        saved.validation = validateGeneratedSample(saved);
        const prior = dataset.samples.find(item => item.id === sample.id);
        if (prior) {
          saved.priorAttempts = [...(prior.priorAttempts || []), { generationError: prior.generationError, generation: prior.generation }];
          dataset.samples[dataset.samples.indexOf(prior)] = saved;
        } else dataset.samples.push(saved);
        // Per-sample evidence is immutable; queued atomic snapshots also let
        // the local study inspect completed cases while generation continues.
        await writeFile(path.join(reportDirectory, `${sample.id}.sample.json`), `${JSON.stringify(saved, null, 2)}\n`);
        await saveIncrement();
        console.log(`${sample.id}: ${saved.generationError ? 'generation failed' : `${saved.validation.acceptedAnnotations}/${saved.validation.suppliedAnnotations} annotations accepted; ${saved.validation.errors.length} validation errors`}`);
      }
    }));
  }
  dataset.samples.sort((a, b) => GENERATION_CASES.findIndex(sample => sample.id === a.id) - GENERATION_CASES.findIndex(sample => sample.id === b.id));
  for (const sample of dataset.samples) sample.validation = validateGeneratedSample(sample);
  dataset.provenance.lastEvaluatedAt = new Date().toISOString();
  dataset.provenance.completedCases = dataset.samples.filter(sample => sample.document).length;
  dataset.provenance.status = dataset.provenance.completedCases === GENERATION_CASES.length ? 'complete' : dataset.samples.length === GENERATION_CASES.length ? 'completed-with-errors' : 'partial';
  await saveIncrement();
  const summary = { ...dataset.provenance, samples: dataset.samples.map(({ id, language, validation }) => ({ id, language, ...validation })) };
  await writeFile(path.join(reportDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  const completed = dataset.samples.filter(sample => sample.document);
  const total = field => completed.reduce((sum, sample) => sum + (sample.validation[field] || 0), 0);
  const kinds = Object.fromEntries(['identity', 'literal', 'interpretation', 'balance', 'relationship'].map(kind => [kind, completed.reduce((sum, sample) => sum + sample.validation.compiledCounts[kind], 0)]));
  const report = [
    '# Fresh reading and semantic annotation experiment',
    '',
    `Evaluated ${dataset.provenance.lastEvaluatedAt}. Completed ${completed.length}/${GENERATION_CASES.length} independent generation cases, including ${completed.filter(sample => sample.language === 'es').length} Spanish readings. Actual models: ${[...new Set(completed.map(sample => sample.generation.actualModel))].join(', ')}. Requested effort: ${effort}.`,
    '',
    'Documents: [unaltered generated fixture](../../fixtures/generated-gesture-readings.json). Machine-readable evaluation: [summary.json](summary.json).',
    '',
    'Each subscription-only request generated its reading and annotations together in a fresh, tool-free Claude session. Inputs supplied synthetic questions, optional reflections, spread positions/orientations, and supported artwork IDs/terms. They did not supply recorded reading prose, regex patterns, authored EXAMPLES, or prior critique. The raw model results and prompts are preserved in the per-case JSON files. No reading or annotation was repaired after generation.',
    '',
    `Structural validation accepted ${total('acceptedAnnotations')}/${total('suppliedAnnotations')} supplied annotations. Accepted kinds: ${Object.entries(kinds).map(([kind, count]) => `${kind} ${count}`).join(', ')}. Exact supplied personal-context references: ${total('personalContextCount')}.`,
    '',
    `The conservative fallback matched ${total('fallbackLiteralMatches')}/${total('modelLiteralReferences')} model-annotated literal references at overlapping source quotes with the same card and detail. This denominator is model-provided, not independent human ground truth; it is a mechanism comparison, not a measured semantic-accuracy score. Interpretive returns in these documents come from the model's explicit associations, not memorized regex phrases.`,
    '',
    '| Case | Language | Accepted / supplied | Errors | Fallback literal overlap |',
    '| --- | --- | --- | --- | --- |',
    ...dataset.samples.map(sample => `| [${sample.id}](${sample.id}.${sample.document ? '' : 'sample.'}json) | ${sample.language} | ${sample.document ? `${sample.validation.acceptedAnnotations} / ${sample.validation.suppliedAnnotations}` : 'generation failed'} | ${sample.validation.errors?.length ?? 'n/a'} | ${sample.document ? `${sample.validation.fallbackLiteralMatches} / ${sample.validation.modelLiteralReferences}` : 'n/a'} |`),
    '',
    'The compiler checks exact quotes, card occurrence ownership, supported artwork IDs, nonoverlap, prior literal references, and supplied-context quotations. It does not judge whether a reading is helpful, whether a painted detail is described accurately, or whether an interpretive connection is forced. Human review, browser behavior, and production provider integration remain separate evidence. This experiment does not cover all 78 cards or prove a streaming provider contract.',
    '',
    'The first two attempts failed before inference because the Claude CLI rejected JSON Schema draft 2020-12. The generator now serializes the same Zod contract as draft 7. Those failures are retained under priorAttempts; no API fallback was used.',
    '',
    'Regenerate new missing cases: `node scripts/evaluation/generateGestureReadings.mjs` (subscription required). Retry recorded generation failures explicitly with `--retry-failed`. Revalidate existing unchanged documents without inference: `node scripts/evaluation/generateGestureReadings.mjs --evaluate-only`.',
    ''
  ].join('\n');
  await writeFile(path.join(reportDirectory, 'README.md'), report);
  console.log(`Saved ${dataset.samples.length} cases to ${path.relative(root, outputPath)}.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
