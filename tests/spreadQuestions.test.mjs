import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SPREADS } from '../src/data/spreads.js';
import {
  RELATIONSHIP_SPREAD_CLARIFIER_POSITIONS,
  RELATIONSHIP_SPREAD_CORE_POSITIONS
} from '../shared/contracts/spreadContracts.js';
import {
  buildSpreadQuestionVariants,
  DECISION_QUESTION_INSTRUCTION,
  resolveSpreadQuestionContext
} from '../shared/coach/spreadQuestions.js';
import { ensureQuestionMark } from '../shared/utils.js';
import { scoreQuestion } from '../src/lib/questionQuality.js';

const SPREAD_KEYS = Object.keys(SPREADS);
const PATTERNS = ['support', 'navigate', 'lesson', 'transform'];
const UNKNOWN_KEYS = [undefined, null, '', 'unknown', 42, {}, [], '__proto__', 'constructor', 'toString', 'Decision'];

// The shapes the coach passes: the timeframe and closing carry their own
// leading space, or are empty.
const PARTS = [
  { focus: 'my career direction', timeframeText: ' over the next month', closingSuffix: ' with confidence' },
  { focus: 'my sister', timeframeText: '', closingSuffix: '' },
  { focus: 'the move I am weighing', timeframeText: ' this week', closingSuffix: ' so I can honor my growth' }
];

describe('resolveSpreadQuestionContext', () => {
  // A spread added to SPREADS without a question profile fails here.
  it('resolves every spread in SPREADS', () => {
    for (const key of SPREAD_KEYS) {
      const context = resolveSpreadQuestionContext(key);
      assert.ok(context, `${key} has no question profile`);
      assert.equal(context.key, key);
      assert.equal(context.name, SPREADS[key].name);
      for (const field of ['shortName', 'hint', 'promptShape']) {
        assert.ok(typeof context[field] === 'string' && context[field].trim(), `${key} lacks ${field}`);
      }
      assert.equal(context.cardCount, context.corePositions.length);
    }
  });

  it('takes names and positions from the canonical spread definitions', () => {
    for (const key of SPREAD_KEYS.filter((spreadKey) => spreadKey !== 'relationship')) {
      const context = resolveSpreadQuestionContext(key);
      assert.deepEqual(context.corePositions, SPREADS[key].positions);
      assert.deepEqual(context.optionalPositions, []);
      assert.equal(context.cardCount, SPREADS[key].positions.length);
    }
    const decision = resolveSpreadQuestionContext('decision');
    assert.equal(decision.name, 'Decision / Two-Path');
    assert.equal(decision.cardCount, 5);
  });

  it('keeps the Relationship Snapshot core positions apart from its optional clarifiers', () => {
    const relationship = resolveSpreadQuestionContext('relationship');
    assert.equal(relationship.name, 'Relationship Snapshot');
    assert.deepEqual(relationship.corePositions, RELATIONSHIP_SPREAD_CORE_POSITIONS);
    assert.deepEqual(relationship.optionalPositions, RELATIONSHIP_SPREAD_CLARIFIER_POSITIONS);
    assert.equal(relationship.cardCount, 3);
  });

  it('returns copies, so callers cannot change the canonical positions', () => {
    const context = resolveSpreadQuestionContext('threeCard');
    context.corePositions.push('Injected');
    assert.equal(SPREADS.threeCard.positions.length, 3);
    assert.equal(resolveSpreadQuestionContext('threeCard').corePositions.length, 3);
  });

  it('returns null for missing and unknown keys instead of a default spread', () => {
    for (const key of UNKNOWN_KEYS) {
      assert.equal(resolveSpreadQuestionContext(key), null, `key ${JSON.stringify(key)}`);
    }
  });
});

describe('buildSpreadQuestionVariants', () => {
  it('renders every spread and depth as an open question with no template artifacts', () => {
    for (const key of SPREAD_KEYS) {
      for (const pattern of PATTERNS) {
        for (const parts of PARTS) {
          const variants = buildSpreadQuestionVariants(key, pattern, parts);
          assert.ok(Array.isArray(variants) && variants.length > 0, `${key}/${pattern}`);
          for (const variant of variants) {
            assert.ok(!variant.endsWith('?'), `callers add the question mark: ${variant}`);
            const question = ensureQuestionMark(variant);
            const label = `${key}/${pattern}: ${question}`;
            assert.ok(question.endsWith('?'), label);
            assert.ok(!/[{}]/.test(question), label);
            assert.ok(!/undefined/.test(question), label);
            assert.ok(!/ {2}/.test(question), label);
            assert.equal(question, question.trim(), label);
            assert.ok(question.includes(parts.focus), label);
            assert.ok(question.includes(parts.timeframeText.trim()), label);
            const score = scoreQuestion(question);
            assert.equal(score.openEnded, true, label);
            assert.equal(score.deterministicLanguage, false, label);
          }
        }
      }
    }
  });

  it('inserts the querent’s words literally, even when they look like placeholders', () => {
    const focus = 'money $& {timeframe} {closing} $1 $$';
    for (const key of SPREAD_KEYS) {
      for (const pattern of PATTERNS) {
        const variants = buildSpreadQuestionVariants(key, pattern, {
          focus,
          timeframeText: ' this week',
          closingSuffix: ' with confidence'
        });
        for (const variant of variants) {
          assert.ok(variant.includes(focus), `${key}/${pattern}: ${variant}`);
        }
      }
    }
  });

  // The bug being fixed: every spread used to get the same questions.
  it('gives each spread its own templates for the same inputs', () => {
    for (const pattern of PATTERNS) {
      for (const parts of PARTS) {
        const templateSets = SPREAD_KEYS.map((key) => JSON.stringify(buildSpreadQuestionVariants(key, pattern, parts)));
        assert.equal(new Set(templateSets).size, SPREAD_KEYS.length, `${pattern} ${JSON.stringify(parts)}`);
      }
    }
  });

  it('returns null for an unknown spread or depth pattern', () => {
    for (const key of UNKNOWN_KEYS) {
      assert.equal(buildSpreadQuestionVariants(key, 'support', PARTS[0]), null, `key ${JSON.stringify(key)}`);
    }
    for (const key of SPREAD_KEYS) {
      for (const pattern of ['unknown', 'Support', '', undefined, '__proto__', 'constructor', 'toString']) {
        assert.equal(buildSpreadQuestionVariants(key, pattern, PARTS[0]), null, `${key}/${String(pattern)}`);
      }
    }
  });
});

describe('DECISION_QUESTION_INSTRUCTION', () => {
  it('replaces the generic rule with one that lets a question weigh two paths', () => {
    assert.ok(DECISION_QUESTION_INSTRUCTION.startsWith('Avoid yes/no phrasing;'));
    assert.ok(!/avoid listing options/i.test(DECISION_QUESTION_INSTRUCTION));
    assert.match(DECISION_QUESTION_INSTRUCTION, /never invent options/);
  });
});
