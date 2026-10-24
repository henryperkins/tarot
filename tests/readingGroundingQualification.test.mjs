import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const moduleUrl = new URL('../functions/lib/readingGroundingQualification.js', import.meta.url);
const grounding = existsSync(moduleUrl) ? await import(moduleUrl) : {};
const corpus = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-context-v3-cases.json', import.meta.url), 'utf8'));

for (const fixture of corpus.groundingProbes) {
  test(`bounded grounding ${fixture.id}`, () => {
    assert.equal(typeof grounding.evaluateReadingGroundingFixture, 'function');
    const result = grounding.evaluateReadingGroundingFixture({ fixture, reading: fixture.reading, promptCapture: fixture.promptCapture });
    assert.deepEqual(result.violations.map(row => row.code), fixture.expectedViolations);
    assert.equal(result.passed, fixture.expectedViolations.length === 0);
    assert.equal(result.requiresHumanReview, true, 'Known syntax controls do not constitute human editorial approval');
    assert.doesNotMatch(JSON.stringify(result), /red-robed figure|daughter|collection of coastal shells/);
  });
}

test('grounding compares retained memory counts with actual final blocks and abstains on missing observations', () => {
  assert.equal(typeof grounding.evaluateReadingGroundingFixture, 'function');
  const fixture = { acceptedInputs: { cards: [] }, expectations: {}, requiresHumanReview: true };
  const result = grounding.evaluateReadingGroundingFixture({ fixture, reading: 'Consider one reversible next step.', promptCapture: { userPrompt: 'No retained memory blocks.' }, sourceUsage: { memories: { memoriesUsedInPrompt: 1 } } });
  assert.deepEqual(result.violations.map(row => row.code), ['memory_retention_mismatch']);
  const historical = grounding.evaluateReadingGroundingFixture({ fixture, reading: 'Consider one reversible next step.' });
  assert.equal(historical.passed, true);
  assert.equal(historical.requiresHumanReview, true);
});

test('fixture-owned untrusted markers may remain quoted data but never become system or reference authority', () => {
  const fixture = { acceptedInputs: { cards: [] }, expectations: { untrustedMarkers: ['UNTRUSTED MARKER'] } };
  const check = promptCapture => grounding.evaluateReadingGroundingFixture({ fixture, promptCapture });
  assert.equal(check({ userPrompt: '<user_context source="question">"UNTRUSTED MARKER"</user_context>' }).passed, true);
  assert.deepEqual(check({ systemPrompt: 'UNTRUSTED MARKER' }).violations.map(row => row.code), ['untrusted_marker_authority']);
  assert.deepEqual(check({ userPrompt: '<reference>UNTRUSTED MARKER</reference>' }).violations.map(row => row.code), ['untrusted_marker_authority']);
});

test('v3 metadata preserves baseline identity and labels every migration and executor', () => {
  assert.equal(corpus.schemaVersion, 3);
  assert.equal(corpus.candidateSourceIdentity, null);
  const fixtures = [...corpus.cases, ...corpus.groundingProbes];
  assert.equal(new Set(fixtures.map(row => row.id)).size, fixtures.length);
  for (const fixture of fixtures) {
    assert.equal(fixture.sourceRevision, corpus.reviewedSourceRevision);
    for (const key of ['deckStyle', 'spreadKey', 'subscriptionTier', 'acceptedInputs', 'executor', 'expectations']) assert.ok(fixture[key], `${fixture.id}: ${key}`);
  }
  assert.deepEqual(Object.values(corpus.expectationMigrations).filter(row => row.type === 'temporal-age-admission').map(row => row.ownerTask), [4, 4]);
  assert.equal(corpus.expectationMigrations['boundary-removed-memory'].newExecutor, 'admission-error');
  for (const migration of corpus.contractMigrations) assert.ok(migration.reason && migration.oldExpected && migration.newExpected && migration.ownerTask);
});
