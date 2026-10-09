import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  PASSAGE_ASSOCIATION_KINDS,
  passageAssociationSchema,
  cardIntroductionSchema,
  passageAssociationsPayloadSchema,
  validatePassageAssociationsPayload
} from '../shared/contracts/readingPassageAssociations.js';
import { alignReadingPassages, resolveDynamicPassages } from '../src/lib/narrativePassageAligner.js';

describe('production passage associations contract schema', () => {
  test('defines all expected association kinds', () => {
    assert.deepEqual([...PASSAGE_ASSOCIATION_KINDS].sort(), [
      'balance',
      'identity',
      'interpretation',
      'literal',
      'relationship'
    ]);
  });

  test('validates a well-formed passage association', () => {
    const association = {
      id: 'pool-pour',
      label: 'The pool pour',
      kind: 'literal',
      targets: [
        {
          spreadIndex: 2,
          canonicalName: 'The Star',
          detailIds: ['pool-pour']
        }
      ],
      passage: {
        start: 10,
        end: 35,
        quote: 'one pitcher into a pool'
      }
    };
    const parsed = passageAssociationSchema.parse(association);
    assert.equal(parsed.id, 'pool-pour');
    assert.equal(parsed.kind, 'literal');
    assert.equal(parsed.targets[0].spreadIndex, 2);
  });

  test('rejects association with invalid kind or invalid span', () => {
    assert.throws(
      () =>
        passageAssociationSchema.parse({
          id: 'test',
          kind: 'unsupported-kind',
          targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: [] }],
          passage: { start: 0, end: 10, quote: 'test' }
        }),
      /kind/
    );

    assert.throws(
      () =>
        passageAssociationSchema.parse({
          id: 'test',
          kind: 'literal',
          targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: [] }],
          passage: { start: 10, end: 5, quote: 'inverted' }
        }),
      /strictly greater than start offset/
    );

    assert.throws(
      () =>
        passageAssociationSchema.parse({
          id: 'test',
          kind: 'literal',
          targets: [],
          passage: { start: 0, end: 5, quote: 'valid' }
        }),
      /at least one target/
    );
  });

  test('validates introduction boundary progression', () => {
    const validIntro = {
      spreadIndex: 0,
      canonicalName: 'The Star',
      start: 10,
      namedEnd: 20,
      descriptionStart: 30,
      midpoint: 50,
      end: 80
    };
    assert.deepEqual(cardIntroductionSchema.parse(validIntro), validIntro);

    const outOfOrder = {
      ...validIntro,
      namedEnd: 35,
      descriptionStart: 30 // namedEnd > descriptionStart is invalid
    };
    assert.throws(() => cardIntroductionSchema.parse(outOfOrder), /order/);
  });
});

describe('runtime invariant validation via validatePassageAssociationsPayload', () => {
  const rawText =
    'The Star rises over the hill. A maiden pours water into a pool and onto the land. Memory and hope join.';
  const cards = [
    { index: 0, canonicalName: 'The Star', name: 'The Star' }
  ];

  test('validates exact UTF-16 substring quotes and returns clean payload', () => {
    const passageText = 'water into a pool';
    const start = rawText.indexOf(passageText);
    const end = start + passageText.length;

    const payload = {
      artworkEdition: 'rws-immanuelle-vector',
      expectedRaw: rawText,
      associations: [
        {
          id: 'star-pool',
          kind: 'literal',
          targets: [
            { spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }
          ],
          passage: { start, end, quote: passageText }
        }
      ],
      introductions: [
        {
          spreadIndex: 0,
          canonicalName: 'The Star',
          start: 0,
          namedEnd: 8,
          descriptionStart: 31,
          midpoint: start,
          end: rawText.length
        }
      ]
    };

    const result = validatePassageAssociationsPayload(payload, { rawText, cards });
    assert.equal(result.valid, true);
    assert.equal(result.associations.length, 1);
    assert.equal(result.introductions.length, 1);
    assert.equal(result.droppedAssociationIds.length, 0);
  });

  test('rejects mismatched quote and drops invalid association', () => {
    const payload = {
      artworkEdition: 'rws-immanuelle-vector',
      associations: [
        {
          id: 'bad-quote',
          kind: 'literal',
          targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: [] }],
          passage: { start: 0, end: 8, quote: 'The Moon' } // actual slice is 'The Star'
        }
      ],
      introductions: []
    };

    const result = validatePassageAssociationsPayload(payload, { rawText, cards });
    assert.equal(result.valid, false);
    assert.equal(result.associations.length, 0);
    assert.deepEqual(result.droppedAssociationIds, ['bad-quote']);
    assert.match(result.errors[0].message, /quote mismatch/);
  });

  test('drops overlapping spans to prevent markdown AST rendering conflicts', () => {
    const payload = {
      artworkEdition: 'rws-immanuelle-vector',
      associations: [
        {
          id: 'first',
          kind: 'identity',
          targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: [] }],
          passage: { start: 0, end: 8, quote: 'The Star' }
        },
        {
          id: 'overlap',
          kind: 'literal',
          targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: [] }],
          passage: { start: 4, end: 14, quote: 'Star rises' } // overlaps [0, 8]
        }
      ],
      introductions: []
    };

    const result = validatePassageAssociationsPayload(payload, { rawText, cards });
    assert.equal(result.associations.length, 1);
    assert.equal(result.associations[0].id, 'first');
    assert.deepEqual(result.droppedAssociationIds, ['overlap']);
  });

  test('rejects target when card canonicalName or spreadIndex does not match drawn cards', () => {
    const payload = {
      artworkEdition: 'rws-immanuelle-vector',
      associations: [
        {
          id: 'wrong-card',
          kind: 'identity',
          targets: [{ spreadIndex: 0, canonicalName: 'The Moon', detailIds: [] }],
          passage: { start: 0, end: 8, quote: 'The Star' }
        }
      ],
      introductions: []
    };

    const result = validatePassageAssociationsPayload(payload, { rawText, cards });
    assert.equal(result.associations.length, 0);
    assert.deepEqual(result.droppedAssociationIds, ['wrong-card']);
    assert.match(result.errors[0].message, /canonicalName "The Moon" does not match/);
  });

  test('filters detailIds against getSupportedDetails', () => {
    const passageText = 'water into a pool';
    const start = rawText.indexOf(passageText);
    const end = start + passageText.length;

    const payload = {
      artworkEdition: 'rws-immanuelle-vector',
      associations: [
        {
          id: 'details-check',
          kind: 'literal',
          targets: [
            {
              spreadIndex: 0,
              canonicalName: 'The Star',
              detailIds: ['pool-pour', 'unsupported-detail']
            }
          ],
          passage: { start, end, quote: passageText }
        }
      ],
      introductions: []
    };

    const getSupportedDetails = (name) =>
      name === 'The Star' ? [{ id: 'pool-pour' }, { id: 'land-pour' }] : [];

    const result = validatePassageAssociationsPayload(payload, {
      rawText,
      cards,
      getSupportedDetails
    });
    assert.equal(result.associations.length, 1);
    assert.deepEqual(result.associations[0].targets[0].detailIds, ['pool-pour']);
  });
});

describe('fixtures verification against the contract', () => {
  test('all 3 recorded study sidecars conform to the contract', async () => {
    const sidecarsJson = await readFile(
      new URL('../output/reading-motion/fixtures/gesture-sidecars.json', import.meta.url),
      'utf8'
    );
    const sidecars = JSON.parse(sidecarsJson);

    for (const key of ['star', 'related', 'fiveCard']) {
      const sidecar = sidecars[key];
      assert.ok(sidecar, `sidecar ${key} exists`);

      // 1. Zod parse succeeds
      const parsed = passageAssociationsPayloadSchema.parse(sidecar);
      assert.ok(parsed.associations.length > 0);

      // 2. Validate against expectedRaw
      const rawText = sidecar.expectedRaw;
      const result = validatePassageAssociationsPayload(parsed, { rawText });
      assert.equal(
        result.errors.length,
        0,
        `sidecar ${key} has validation errors: ${JSON.stringify(result.errors)}`
      );
      assert.equal(
        result.associations.length,
        sidecar.associations.length,
        `sidecar ${key} retained all associations`
      );
      assert.equal(
        result.introductions.length,
        sidecar.introductions.length,
        `sidecar ${key} retained all introductions`
      );
    }
  });
});

describe('alignReadingPassages dynamic passage alignment', () => {
  test('aligns arbitrary reading with card introductions and details', async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL('../output/reading-motion/fixtures/three-card-transition.json', import.meta.url),
        'utf8'
      )
    );
    const rawText = fixture.excerpt;
    const cards = fixture.cards;

    const aligned = alignReadingPassages({
      rawText,
      cards,
      artworkEdition: 'rws-immanuelle-vector',
      userQuestion: fixture.userQuestion,
      querentReflections: fixture.reflectionsText
    });

    assert.equal(aligned.expectedRaw, rawText);
    assert.ok(aligned.introductions.length > 0, 'emits card introduction');
    assert.equal(aligned.introductions[0].canonicalName, 'The Star');
    assert.ok(aligned.associations.length > 0, 'emits associations');

    // Invariant check on every produced association and introduction:
    for (const assoc of aligned.associations) {
      assert.equal(
        rawText.slice(assoc.passage.start, assoc.passage.end),
        assoc.passage.quote,
        `quote slice matches rawText for ${assoc.id}`
      );
    }
    for (const intro of aligned.introductions) {
      assert.ok(
        intro.start <= intro.namedEnd &&
          intro.namedEnd <= intro.descriptionStart &&
          intro.descriptionStart <= intro.midpoint &&
          intro.midpoint <= intro.end &&
          intro.end <= rawText.length,
        `introduction boundaries valid for ${intro.canonicalName}`
      );
    }
  });

  test('aligns five-card reading discovering multi-card relationships and returns', async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL('../output/reading-motion/fixtures/gestures-five-card-creative-project.json', import.meta.url),
        'utf8'
      )
    );
    const rawText = fixture.reading;
    const cards = fixture.cards;

    const aligned = alignReadingPassages({
      rawText,
      cards,
      artworkEdition: 'rws-immanuelle-vector',
      userQuestion: fixture.userQuestion
    });

    assert.ok(aligned.introductions.length >= 3, 'introduces multiple cards');
    assert.ok(aligned.associations.length >= 5, 'discovers associations');

    // Check relationship detection
    const relationships = aligned.associations.filter((a) => a.kind === 'relationship');
    assert.ok(relationships.length > 0, 'discovers multi-card relationships');
    for (const rel of relationships) {
      assert.ok(rel.targets.length >= 2, 'relationship targets 2+ cards');
    }

    // Invariant check on every produced association and introduction:
    for (const assoc of aligned.associations) {
      assert.equal(
        rawText.slice(assoc.passage.start, assoc.passage.end),
        assoc.passage.quote,
        `quote slice matches rawText for ${assoc.id}`
      );
    }
  });

  test('handles empty text, unknown cards, and missing details gracefully', () => {
    const empty = alignReadingPassages({ rawText: '', cards: [] });
    assert.equal(empty.associations.length, 0);
    assert.equal(empty.introductions.length, 0);

    const unknownCardText = 'The Void whispers in the dark.';
    const result = alignReadingPassages({
      rawText: unknownCardText,
      cards: [{ index: 0, name: 'The Star', canonicalName: 'The Star' }]
    });
    assert.equal(result.associations.length, 0);
    assert.equal(result.introductions.length, 0);
  });

  test('resolveDynamicPassages injects occurrenceId into targets and introductions', () => {
    const raw = 'The Star shines bright. Water flows into the pool.';
    const cards = [{ index: 0, name: 'The Star', canonicalName: 'The Star' }];
    const source = { runId: 'run-prod-123', raw, status: 'streaming' };

    const resolved = resolveDynamicPassages({ source, cards });
    assert.ok(resolved.introductions.length > 0);
    assert.equal(resolved.introductions[0].occurrenceId, 'run-prod-123:0');

    assert.ok(resolved.associations.length > 0);
    for (const assoc of resolved.associations) {
      for (const target of assoc.targets) {
        assert.equal(target.occurrenceId, 'run-prod-123:0');
      }
    }
    assert.deepEqual(resolved.invalid, []);
  });

  test('aligns all 11 evaluation samples conforming to contract invariants', async () => {
    const data = JSON.parse(
      await readFile(
        new URL('../data/evaluations/narrative-samples.json', import.meta.url),
        'utf8'
      )
    );

    assert.equal(data.samples.length, 11, 'has 11 evaluation samples');

    for (const sample of data.samples) {
      const rawText = sample.reading;
      const cards = (sample.cardsInfo || sample.cards || []).map((c, i) => ({
        ...c,
        index: i,
        name: c.card || c.name || c.canonicalName
      }));

      const deckStyle = sample.deckStyle || 'rws-1909';
      const aligned = alignReadingPassages({
        rawText,
        cards,
        deckStyle,
        userQuestion: sample.userQuestion,
        querentReflections: sample.reflectionsText
      });

      assert.equal(aligned.expectedRaw, rawText);
      assert.deepEqual(aligned.errors, [], `Sample ${sample.id}: no hidden alignment validation errors`);

      // Validate all produced associations
      for (const assoc of aligned.associations) {
        assert.equal(
          rawText.slice(assoc.passage.start, assoc.passage.end),
          assoc.passage.quote,
          `Sample ${sample.id}: quote slice matches for ${assoc.id}`
        );
        for (const target of assoc.targets) {
          assert.ok(
            target.spreadIndex >= 0 && target.spreadIndex < cards.length,
            `Sample ${sample.id}: target spreadIndex ${target.spreadIndex} in range`
          );
        }
      }

      // Validate all produced introductions
      for (const intro of aligned.introductions) {
        assert.ok(
          intro.start <= intro.namedEnd &&
            intro.namedEnd <= intro.descriptionStart &&
            intro.descriptionStart <= intro.midpoint &&
            intro.midpoint <= intro.end &&
            intro.end <= rawText.length,
          `Sample ${sample.id}: introduction boundaries valid for ${intro.canonicalName}`
        );
      }

      // Verify the whole payload passes contract validator
      const validation = validatePassageAssociationsPayload(aligned, {
        rawText,
        cards,
        userQuestion: sample.userQuestion,
        reflections: sample.reflectionsText
      });
      assert.equal(
        validation.errors.length,
        0,
        `Sample ${sample.id} validation errors: ${JSON.stringify(validation.errors)}`
      );
    }
  });
});
