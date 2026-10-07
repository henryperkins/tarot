import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  INTENTION_DEPTH_OPTIONS,
  buildCreativeQuestion,
  buildGuidedQuestion,
  buildLocalCreativeQuestion
} from '../src/lib/intentionCoach.js';
import { ensureQuestionMark } from '../src/lib/themeText.js';
import { SPREADS } from '../src/data/spreads.js';
import { buildSpreadQuestionVariants } from '../shared/coach/spreadQuestions.js';

const SPREAD_KEYS = Object.keys(SPREADS);

// Missing, unknown, miscased and prototype keys all keep the generic templates.
const UNKNOWN_SPREAD_KEYS = [
  undefined, null, '', 'unknown', 'Decision', 42, {}, [], '__proto__', 'constructor', 'toString'
];

// Master (bcdc828) output for these inputs, before the coach knew the spread.
const MASTER_GUIDED_QUESTIONS = {
  pulse: 'What would help me hold space for my career direction and purpose over the next month with calm awareness?',
  guided: 'What next step would move my career direction and purpose forward over the next month with confidence?',
  lesson: 'How can I interpret my career direction and purpose over the next month as guidance?',
  deep: 'What must I release to renew my career direction and purpose over the next month so I can honor my growth?'
};
const MASTER_LOCAL_QUESTIONS = {
  support: 'Where should I focus to steady my creative practice this week with calm awareness?',
  navigate: 'What should I prioritize to move through my creative practice this week with confidence?',
  lesson: 'What am I being shown about my creative practice this week?',
  transform: 'How might I nurture my creative practice this week so I can honor my growth?'
};

const FOCUS = 'my studio launch';
const TIMEFRAME_PHRASE = 'over the next month';

function guidedInput(depth) {
  return { topic: 'career', timeframe: 'month', depth: depth.value, customFocus: FOCUS, seed: 'spread-aware' };
}

function localInput(depth) {
  return {
    focus: FOCUS,
    timeframePhrase: TIMEFRAME_PHRASE,
    depthLabel: depth.label,
    topicLabel: 'Career & Purpose',
    pattern: depth.pattern,
    closing: depth.closing,
    seed: 'spread-aware'
  };
}

// The closing joins the question the way both builders join it.
function closingSuffixFor({ pattern, closing }) {
  if (!closing) return '';
  return pattern === 'transform' ? ` so I can ${closing}` : ` ${closing}`;
}

// Every question a spread's templates can give for these parts, as shown.
function spreadQuestions(spreadKey, pattern, parts) {
  return buildSpreadQuestionVariants(spreadKey, pattern, parts).map(ensureQuestionMark);
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

describe('Spread-aware guided questions', () => {
  it('uses each spread\'s own templates, so the spreads differ for identical inputs', () => {
    for (const depth of INTENTION_DEPTH_OPTIONS) {
      const generic = buildGuidedQuestion(guidedInput(depth));
      const questions = SPREAD_KEYS.map(spreadKey => {
        const question = buildGuidedQuestion({ ...guidedInput(depth), spreadKey });
        const expected = spreadQuestions(spreadKey, depth.pattern, {
          focus: FOCUS,
          timeframeText: ` ${TIMEFRAME_PHRASE}`,
          closingSuffix: closingSuffixFor(depth)
        });
        assert.ok(expected.includes(question), `${spreadKey}/${depth.value} should use its spread's templates: ${question}`);
        return question;
      });

      assert.strictEqual(new Set(questions).size, SPREAD_KEYS.length, `${depth.value}: one distinct question per spread`);
      assert.ok(!questions.includes(generic), `${depth.value}: no spread falls back to the generic question`);
    }
  });

  it('keeps today\'s generic question for a missing or unknown spread', () => {
    for (const depth of INTENTION_DEPTH_OPTIONS) {
      const generic = buildGuidedQuestion(guidedInput(depth));
      const golden = { topic: 'career', timeframe: 'month', depth: depth.value, seed: 'golden-seed' };
      assert.strictEqual(buildGuidedQuestion(golden), MASTER_GUIDED_QUESTIONS[depth.value]);

      for (const spreadKey of UNKNOWN_SPREAD_KEYS) {
        assert.strictEqual(buildGuidedQuestion({ ...guidedInput(depth), spreadKey }), generic, `${String(spreadKey)}/${depth.value}`);
        assert.strictEqual(
          buildGuidedQuestion({ ...golden, spreadKey }),
          MASTER_GUIDED_QUESTIONS[depth.value],
          `${String(spreadKey)}/${depth.value} matches master`
        );
      }
    }
  });

  it('is deterministic with a seed for every spread and depth', () => {
    for (const spreadKey of SPREAD_KEYS) {
      for (const depth of INTENTION_DEPTH_OPTIONS) {
        const params = { ...guidedInput(depth), spreadKey };
        assert.strictEqual(buildGuidedQuestion(params), buildGuidedQuestion(params), `${spreadKey}/${depth.value}`);
      }
    }
  });

  it('inserts the querent\'s own detail literally', () => {
    const customFocus = 'a $& and {timeframe} plan';
    for (const spreadKey of SPREAD_KEYS) {
      const question = buildGuidedQuestion({ topic: 'career', timeframe: 'week', depth: 'guided', customFocus, seed: 'literal', spreadKey });
      assert.ok(question.includes(customFocus), `${spreadKey}: ${question}`);
    }
  });
});

describe('Spread-aware local creative fallback', () => {
  it('uses each spread\'s own templates, so the spreads differ for identical inputs', () => {
    for (const depth of INTENTION_DEPTH_OPTIONS) {
      const generic = buildLocalCreativeQuestion(localInput(depth));
      const questions = SPREAD_KEYS.map(spreadKey => {
        const question = buildLocalCreativeQuestion({ ...localInput(depth), spreadKey });
        const expected = spreadQuestions(spreadKey, depth.pattern, {
          focus: FOCUS,
          timeframeText: ` ${TIMEFRAME_PHRASE}`,
          closingSuffix: closingSuffixFor(depth)
        });
        assert.ok(expected.includes(question), `${spreadKey}/${depth.pattern} should use its spread's templates: ${question}`);
        return question;
      });

      assert.strictEqual(new Set(questions).size, SPREAD_KEYS.length, `${depth.pattern}: one distinct question per spread`);
      assert.ok(!questions.includes(generic), `${depth.pattern}: no spread falls back to the generic question`);
    }
  });

  it('keeps today\'s generic question for a missing or unknown spread', () => {
    for (const depth of INTENTION_DEPTH_OPTIONS) {
      const generic = buildLocalCreativeQuestion(localInput(depth));
      const golden = { ...localInput(depth), focus: 'my creative practice', timeframePhrase: 'this week', seed: 'golden-seed' };
      assert.strictEqual(buildLocalCreativeQuestion(golden), MASTER_LOCAL_QUESTIONS[depth.pattern]);

      for (const spreadKey of UNKNOWN_SPREAD_KEYS) {
        assert.strictEqual(buildLocalCreativeQuestion({ ...localInput(depth), spreadKey }), generic, `${String(spreadKey)}/${depth.pattern}`);
        assert.strictEqual(
          buildLocalCreativeQuestion({ ...golden, spreadKey }),
          MASTER_LOCAL_QUESTIONS[depth.pattern],
          `${String(spreadKey)}/${depth.pattern} matches master`
        );
      }
    }
  });

  it('is deterministic with a seed for every spread and depth', () => {
    for (const spreadKey of SPREAD_KEYS) {
      for (const depth of INTENTION_DEPTH_OPTIONS) {
        const params = { ...localInput(depth), spreadKey };
        assert.strictEqual(buildLocalCreativeQuestion(params), buildLocalCreativeQuestion(params), `${spreadKey}/${depth.pattern}`);
      }
    }
  });
});

describe('buildCreativeQuestion and the selected spread', () => {
  const creativeParams = { topic: 'career', timeframe: 'week', depth: 'guided', seed: 'creative-spread' };
  // What buildCreativeQuestion derives from creativeParams for its fallback.
  const fallbackParts = { focus: 'my career direction and purpose', timeframeText: ' this week', closingSuffix: ' with confidence' };

  it('sends only the spread key; the server resolves the spread itself', async (t) => {
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return jsonResponse({ question: 'What does each path ask of me this week?', provider: 'workers-ai', model: '@cf/zai-org/glm-5.3' });
    });

    const result = await buildCreativeQuestion({ ...creativeParams, spreadKey: 'decision' });

    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].url, '/api/generate-question');
    const { metadata } = requests[0].body;
    assert.strictEqual(metadata.spreadKey, 'decision');
    // No client-side spread name or positions for the prompt to trust.
    assert.deepStrictEqual(Object.keys(metadata).filter(key => /spread|position/i.test(key)), ['spreadKey']);
    assert.ok(!JSON.stringify(requests[0].body).includes(SPREADS.decision.name));
    assert.deepStrictEqual(result, { question: 'What does each path ask of me this week?', source: 'workers-ai', forecast: null });
  });

  it('sends null for a missing or non-string spread key', async (t) => {
    const sent = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      sent.push(JSON.parse(options.body).metadata.spreadKey);
      return jsonResponse({ question: 'What is mine to explore this week?', provider: 'workers-ai' });
    });

    for (const spreadKey of [undefined, null, 42, {}, ['decision']]) {
      await buildCreativeQuestion({ ...creativeParams, spreadKey });
    }
    // An unknown string is the server's to reject; it keeps the generic prompt.
    await buildCreativeQuestion({ ...creativeParams, spreadKey: 'unknown' });

    assert.deepStrictEqual(sent, [null, null, null, null, null, 'unknown']);
  });

  it('falls back to the spread\'s own local template when the request fails', async (t) => {
    // callLlmApi logs each failure; keep the test output quiet.
    t.mock.method(console, 'error', () => {});
    const failures = [
      async () => { throw new TypeError('Failed to fetch'); },
      async () => jsonResponse({ error: 'unavailable' }, { ok: false, status: 503 }),
      async () => jsonResponse({ question: '' })
    ];
    const expected = spreadQuestions('decision', 'navigate', fallbackParts);
    const fetchMock = t.mock.method(globalThis, 'fetch', failures[0]);

    for (const failure of failures) {
      fetchMock.mock.mockImplementation(failure);
      const result = await buildCreativeQuestion({ ...creativeParams, spreadKey: 'decision' });

      assert.strictEqual(result.source, 'local');
      assert.strictEqual(result.forecast, null);
      assert.ok(expected.includes(result.question), `decision-shaped fallback: ${result.question}`);
      assert.strictEqual(result.question, buildLocalCreativeQuestion({
        focus: fallbackParts.focus,
        timeframePhrase: 'this week',
        depthLabel: 'Focused guidance',
        topicLabel: 'Career & Purpose',
        pattern: 'navigate',
        closing: 'with confidence',
        seed: creativeParams.seed,
        spreadKey: 'decision'
      }));
    }
  });

  it('falls back to the generic local template for an unknown spread', async (t) => {
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });

    const generic = await buildCreativeQuestion(creativeParams);
    for (const spreadKey of UNKNOWN_SPREAD_KEYS) {
      const result = await buildCreativeQuestion({ ...creativeParams, spreadKey });
      assert.strictEqual(result.source, 'local');
      assert.strictEqual(result.question, generic.question, String(spreadKey));
    }
  });
});
