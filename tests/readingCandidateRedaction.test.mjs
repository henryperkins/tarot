import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as promptEngineering from '../functions/lib/promptEngineering.js';
import { scheduleEvaluation } from '../functions/lib/evaluation.js';

const nameAt = index => `Person${String.fromCharCode(97 + Math.floor(index / 676))}${String.fromCharCode(97 + Math.floor(index / 26) % 26)}${String.fromCharCode(97 + index % 26)}`;

test('possessive current-source name extraction uses a word boundary', () => {
  const options = promptEngineering.buildPromptRedactionOptions({ reflectionsText: "Sarah's silence still hurts." });
  assert.ok(options.additionalNames.includes('Sarah'));
  assert.doesNotMatch(promptEngineering.redactPII("Sarah's silence", options), /Sarah/);
});

test('candidate hints have separate per-candidate and pool bounds without changing generic prompt limits', () => {
  assert.equal(typeof promptEngineering.buildMemoryCandidateRedactionNames, 'function');
  const candidates = Array.from({ length: 101 }, (_, candidateIndex) => ({
    text: Array.from({ length: 25 }, (_, nameIndex) => `User (${nameAt(candidateIndex * 25 + nameIndex)})`).join('. ')
  }));
  const hints = promptEngineering.buildMemoryCandidateRedactionNames(candidates);
  assert.equal(hints.length, 2400, 'at most 24 hints from each of the first 100 candidates');
  assert.ok(hints.includes(nameAt(99 * 25 + 23)), 'the final admitted candidate retains its own extraction budget');
  assert.ok(!hints.includes(nameAt(24)), 'per-candidate hint overflow is bounded');
  assert.ok(!hints.includes(nameAt(100 * 25)), 'candidate pool overflow is bounded');
  assert.equal(promptEngineering.buildPromptRedactionOptions({ nameHints: hints }).additionalNames.length, 24, 'generic prompt redaction cap remains unchanged');
});

test('candidate hint union preserves all current hints and deduplicates within its separate bound', () => {
  const currentNames = Array.from({ length: 24 }, (_, index) => nameAt(index + 3000));
  const candidateNames = Array.from({ length: 2400 }, (_, index) => nameAt(index));
  const options = promptEngineering.buildReadingRedactionOptions({
    personalization: { additionalNames: currentNames },
    candidateNameHints: [...candidateNames, 'Beyondlimit', ...currentNames]
  });
  assert.deepEqual(options.additionalNames.slice(0, 24), currentNames);
  assert.equal(options.additionalNames.length, 2424);
  assert.ok(!options.additionalNames.includes('Beyondlimit'));
  const text = [...currentNames, ...candidateNames].join(' ');
  assert.equal(promptEngineering.redactPII(text, options), Array(2424).fill('[NAME]').join(' '), 'maximum bounded union compiles and redacts every recognized name');
  const duplicateOptions = promptEngineering.buildReadingRedactionOptions({
    personalization: { additionalNames: ['Sarah'] },
    candidateNameHints: ['sarah', 'Henry', 'henry', null, '', 42]
  });
  assert.deepEqual(duplicateOptions.additionalNames, ['Sarah', 'Henry']);
});

test('evaluation storage consumes the full bounded union for reading and evaluator notes', async t => {
  t.mock.method(console, 'log', () => {});
  const currentNames = Array.from({ length: 24 }, (_, index) => nameAt(index + 3000));
  const candidateNames = Array.from({ length: 2400 }, (_, index) => nameAt(index));
  const { additionalNames } = promptEngineering.buildReadingRedactionOptions({
    personalization: { additionalNames: currentNames }, candidateNameHints: candidateNames
  });
  const text = additionalNames.join(' ');
  let bindings;
  const pending = [];
  scheduleEvaluation({ EVAL_ENABLED: 'true', DB: {
    prepare() { return { bind(...values) { bindings = values; return { async run() {} }; } }; }
  } }, {
    reading: text, userQuestion: '', cardsInfo: [], requestId: 'bounded-union', spreadKey: 'single', redactionNames: additionalNames
  }, { requestId: 'bounded-union', spreadKey: 'single' }, {
    waitUntil: promise => pending.push(promise),
    precomputedEvalResult: {
      mode: 'model', scores: { personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false, notes: text }
    }
  });
  await Promise.all(pending);
  const stored = JSON.parse(bindings.find(value => typeof value === 'string' && value.startsWith('{')));
  assert.equal(stored.readingText, Array(2424).fill('[NAME]').join(' '));
  assert.equal(stored.eval.scores.notes, stored.readingText);
});

test('private candidate hints do not override explicitly permitted raw prompt storage', async () => {
  const response = 'Henry and Sarah choose their next step.';
  const payload = await promptEngineering.buildPromptEngineeringPayload({
    systemPrompt: 'Tarot', userPrompt: 'A question', response,
    candidateNameHints: ['Henry', 'Sarah'], skipPIIRedaction: true
  });
  assert.equal(payload.redacted.response, response);
  assert.equal(payload.privacy.piiRedacted, false);
});
