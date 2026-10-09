import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';

const sha = text => createHash('sha256').update(text).digest('hex');
const binding = {
  readingResultId: 'reading-one', sourceRevision: 0, spreadHash: sha('spread'),
  contextHash: sha('context'), artworkEdition: 'rws-immanuelle-vector', catalogVersion: '1'
};
const raw = 'The Star. Water pours into the pool. The pool may hold your memories. Both pours stay in balance.';
const context = { cards: [{ index: 0, canonicalName: 'The Star' }],
  getSupportedDetails: () => ['pool-pour', 'land-pour'], reflections: 'I miss home.' };
const literal = () => ({ localAlias: 'pool', kind: 'literal', quote: 'Water pours into the pool',
  targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] });
const memory = reference => ({ localAlias: 'memory', kind: 'interpretation', quote: 'The pool may hold your memories',
  targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }], establishedBy: [reference] });
const request = (ledger, batchId, source = raw, extra = {}) => ({ binding: ledger.binding,
  status: 'active', batchId, requestSequence: ledger.receipts.length + 1, analyzedEnd: source.length,
  analyzedHash: sha(source), baseLedgerRevision: ledger.ledgerRevision, ...extra });
const apply = (ledger, batchId, proposals, extra = {}) => applyVisualCueBatch({ ledger,
  issuedRequest: request(ledger, batchId), response: { proposals }, authoritativeRaw: raw,
  validationContext: context, ...extra });

test('cross_batch_literal_return retains the first literal and references its application ID', async () => {
  const first = await apply(createVisualCueLedger(binding), 'one', [literal()]);
  const id = first.ledger.cues[0].id;
  const snapshot = JSON.stringify(first.ledger);
  const second = await apply(first.ledger, 'two', [memory({ acceptedCueId: id })]);
  assert.equal(second.rejected.length, 0);
  assert.equal(second.ledger.cues.length, 2);
  assert.deepEqual(second.ledger.cues[1].establishedBy, [id]);
  assert.match(id, /^vc:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(first.ledger), snapshot);
  assert.deepEqual(second.ledger.cues[0], first.ledger.cues[0]);
});

test('same_batch_retry is a no-op while conflicting_retry cannot replace accepted cues', async () => {
  const empty = createVisualCueLedger(binding);
  const issuedRequest = request(empty, 'one');
  const first = await apply(empty, 'one', [literal()], { issuedRequest });
  const retry = await apply(first.ledger, 'one', [literal()], { issuedRequest });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.ledger, first.ledger);
  assert.deepEqual(retry.addedCueIds, []);
  const conflict = await apply(first.ledger, 'one', [], { issuedRequest });
  assert.equal(conflict.ledger, first.ledger);
  assert.ok(conflict.rejected.some(item => item.code === 'batch-conflict'));
});

test('equivalent_new_batch coalesces aliases without changing public revision or provenance', async () => {
  const first = await apply(createVisualCueLedger(binding), 'one', [literal()]);
  const second = await apply(first.ledger, 'two', [{ ...literal(), localAlias: 'again' }]);
  assert.deepEqual(second.addedCueIds, []);
  assert.equal(second.ledger.ledgerRevision, first.ledger.ledgerRevision);
  assert.deepEqual(second.ledger.cues, first.ledger.cues);
  assert.equal(second.ledger.receipts.length, 2);
  assert.equal(second.ledger.receipts[1].aliases.again, first.ledger.cues[0].id);
});

test('accepted_span_overlap leaves prior cues byte-identical and retains unrelated valid proposals', async () => {
  const first = await apply(createVisualCueLedger(binding), 'one', [literal()]);
  const second = await apply(first.ledger, 'two', [
    { ...literal(), localAlias: 'overlap', quote: 'pours into the pool' },
    memory({ acceptedCueId: first.ledger.cues[0].id })
  ]);
  assert.ok(second.rejected.some(item => item.code === 'overlap' && item.localAlias === 'overlap'));
  assert.equal(second.ledger.cues.length, 2);
  assert.deepEqual(second.ledger.cues[0], first.ledger.cues[0]);
});

test('rejected_literal_dependency never launders an invalid local alias or an unrelated reference', async () => {
  for (const bad of [
    { ...literal(), targets: [{ spreadIndex: 0, detailIds: ['imaginary'] }] },
    { ...literal(), quote: 'not in the reading' }
  ]) {
    const empty = createVisualCueLedger(binding);
    const issuedRequest = request(empty, 'one');
    const result = await apply(empty, 'one', [bad, memory({ localAlias: 'pool' })], { issuedRequest });
    assert.equal(result.ledger.cues.length, 0);
    assert.ok(result.rejected.some(item => item.localAlias === 'memory'));
    assert.equal(result.ledger.receipts.length, 1);
    const retry = await apply(result.ledger, 'one', [bad, memory({ localAlias: 'pool' })], { issuedRequest });
    assert.equal(retry.duplicate, true);
  }
  const result = await apply(createVisualCueLedger(binding), 'one', [literal(),
    memory({ localAlias: 'pool' }),
    { localAlias: 'bad-balance', kind: 'balance', quote: 'Both pours stay in balance',
      targets: [{ spreadIndex: 0, detailIds: ['land-pour'] }], establishedBy: [{ localAlias: 'pool' }] }
  ]);
  assert.equal(result.ledger.cues.length, 2);
  assert.ok(result.rejected.some(item => item.localAlias === 'bad-balance'));
});

test('growing_prefix_keeps_ids and accepts a stale-base batch against the current cumulative ledger', async () => {
  const empty = createVisualCueLedger(binding);
  const prefix = raw.slice(0, raw.indexOf(' The pool'));
  const issuedRequest = request(empty, 'one', prefix);
  const first = await apply(empty, 'one', [literal()], { issuedRequest });
  const second = await apply(first.ledger, 'two', [literal(), memory({ acceptedCueId: first.ledger.cues[0].id })], {
    issuedRequest: request(empty, 'two')
  });
  assert.equal(second.ledger.cues[0].id, first.ledger.cues[0].id);
  assert.equal(second.ledger.cues.length, 2);
  assert.equal(second.ledger.raw, raw);
  assert.equal(second.ledger.analyzedHash, sha(raw));
  const latePrefix = await apply(second.ledger, 'three', [literal()], {
    issuedRequest: request(empty, 'three', prefix)
  });
  assert.equal(latePrefix.ledger.raw, raw);
  assert.equal(latePrefix.ledger.ledgerRevision, second.ledger.ledgerRevision);
});

test('replaced_source_rejects_old_result and non-prefix substitutions fail closed', async () => {
  const empty = createVisualCueLedger(binding);
  const oldRequest = request(empty, 'one');
  for (const nextBinding of [
    { ...binding, readingResultId: 'reading-two' }, { ...binding, sourceRevision: 1 },
    { ...binding, catalogVersion: '2' }, { ...binding, artworkEdition: 'another-deck' },
    { ...binding, spreadHash: sha('another spread') }, { ...binding, contextHash: sha('another context') }
  ]) {
    const ledger = createVisualCueLedger(nextBinding);
    const result = await apply(ledger, 'one', [literal()], { issuedRequest: oldRequest });
    assert.equal(result.ledger, ledger);
    assert.ok(result.rejected.some(item => item.code === 'binding-mismatch'));
  }
  const result = await apply(empty, 'one', [literal()], { authoritativeRaw: raw.replace('Water', 'Flame') });
  assert.equal(result.ledger, empty);
  assert.ok(result.rejected.some(item => item.code === 'source-mismatch'));
});

test('unknown, cancelled and replaced application requests cannot create receipts or cues', async () => {
  const empty = createVisualCueLedger(binding);
  for (const issuedRequest of [undefined, request(empty, 'one', raw, { status: 'cancelled' }),
    request(empty, 'one', raw, { status: 'replaced' })]) {
    const result = await apply(empty, 'one', [literal()], { issuedRequest });
    assert.equal(result.ledger, empty);
    assert.equal(result.addedCueIds.length, 0);
    assert.ok(result.rejected.length);
  }
});

test('local literals are resolved in source order and invalid overlaps do not invalidate independent cues', async () => {
  const result = await apply(createVisualCueLedger(binding), 'one', [
    memory({ localAlias: 'pool' }), literal(),
    { ...literal(), localAlias: 'longer', quote: 'Water pours into the pool.' }
  ]);
  assert.equal(result.ledger.cues.length, 2);
  assert.equal(result.ledger.cues[0].kind, 'literal');
  assert.deepEqual(result.ledger.cues[1].establishedBy, [result.ledger.cues[0].id]);
  assert.ok(result.rejected.some(item => item.localAlias === 'longer' && item.code === 'overlap'));
});

test('repeated quotes require explicit occurrence and use exact UTF-16 source offsets', async () => {
  const source = '🌟 Water pours. Water pours.';
  const cue = { ...literal(), quote: 'Water pours' };
  const empty = createVisualCueLedger(binding);
  const ambiguous = await apply(empty, 'one', [cue], { issuedRequest: request(empty, 'one', source), authoritativeRaw: source });
  assert.equal(ambiguous.ledger.cues.length, 0);
  const second = await apply(ambiguous.ledger, 'two', [{ ...cue, occurrence: 1 }], {
    issuedRequest: request(empty, 'two', source), authoritativeRaw: source
  });
  assert.deepEqual(second.ledger.cues[0].passage, { start: 16, end: 27, quote: 'Water pours' });
});

test('the model cannot assert source ownership and invalid response retries are deterministic', async () => {
  const empty = createVisualCueLedger(binding);
  const response = { proposals: [literal()], binding };
  const issuedRequest = request(empty, 'one');
  const first = await apply(empty, 'one', [], { response, issuedRequest });
  assert.equal(first.ledger.cues.length, 0);
  assert.equal(first.ledger.receipts.length, 1);
  const second = await apply(first.ledger, 'one', [], { response, issuedRequest });
  assert.equal(second.duplicate, true);
  assert.equal(second.ledger, first.ledger);
});

test('invented personal context is stripped without changing the stable cue identity', async () => {
  const cue = { ...literal(), personalContext: { type: 'querent-reflection', quote: 'I have a diagnosis.' } };
  const first = await apply(createVisualCueLedger(binding), 'one', [cue]);
  assert.equal(first.ledger.cues[0].personalContext, undefined);
  const second = await apply(first.ledger, 'two', [literal()]);
  assert.deepEqual(second.addedCueIds, []);
  assert.equal(second.ledger.cues[0].id, first.ledger.cues[0].id);
});

test('an existing batch ID cannot be rebound to another request even with an identical response', async () => {
  const first = await apply(createVisualCueLedger(binding), 'one', [literal()]);
  const result = await apply(first.ledger, 'one', [literal()], {
    issuedRequest: request(first.ledger, 'one', raw, { requestSequence: 99 })
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.ledger, first.ledger);
  assert.ok(result.rejected.some(item => item.code === 'batch-conflict'));
});

test('missing, forward and cross-occurrence references fail while independent siblings survive', async () => {
  const empty = createVisualCueLedger(binding);
  const invalidReturns = [
    memory({ acceptedCueId: `vc:${'0'.repeat(64)}` }),
    memory({ localAlias: 'future' }),
    { ...memory({ localAlias: 'pool' }), targets: [{ spreadIndex: 1, detailIds: ['pool-pour'] }] }
  ];
  for (const invalid of invalidReturns) {
    const result = await apply(empty, 'one', [literal(), invalid,
      { ...literal(), localAlias: 'future', quote: 'Both pours stay in balance' }
    ], { validationContext: { ...context, cards: [...context.cards, { index: 1, canonicalName: 'The Star' }] } });
    assert.equal(result.ledger.cues.length, 2);
    assert.ok(result.rejected.some(item => item.localAlias === 'memory'));
  }
});

test('malformed siblings and duplicate local aliases cannot supply grounding for a return', async () => {
  const result = await apply(createVisualCueLedger(binding), 'one', [literal(), literal(),
    memory({ localAlias: 'pool' }), { localAlias: 'malformed' },
    { localAlias: 'identity', kind: 'identity', quote: 'The Star', targets: [{ spreadIndex: 0, detailIds: [] }] }
  ]);
  assert.deepEqual(result.ledger.cues.map(cue => cue.kind), ['identity']);
  assert.ok(result.rejected.some(item => item.localAlias === 'memory'));
  assert.ok(result.rejected.some(item => item.localAlias === 'malformed'));
});

test('canonical detail ordering keeps stable IDs and rejected context cannot rename an equivalent cue', async () => {
  const empty = createVisualCueLedger(binding);
  const first = await apply(empty, 'one', [{ ...literal(), targets: [{ spreadIndex: 0, detailIds: ['pool-pour', 'land-pour'] }] }]);
  const second = await apply(first.ledger, 'two', [{ ...literal(),
    targets: [{ spreadIndex: 0, detailIds: ['land-pour', 'pool-pour'] }],
    personalContext: { type: 'querent-reflection', quote: 'not supplied' }
  }]);
  assert.deepEqual(second.addedCueIds, []);
  assert.deepEqual(second.ledger.cues, first.ledger.cues);
});

test('cumulative ledgers retain more than one complete-document batch without a lifetime cue quota', async () => {
  const sentences = Array.from({ length: 245 }, (_, index) => `Passage number ${index}.`);
  const source = sentences.join(' ');
  const proposals = sentences.map((quote, index) => ({ localAlias: `passage-${index}`, kind: 'identity', quote,
    targets: [{ spreadIndex: 0, detailIds: [] }] }));
  const empty = createVisualCueLedger(binding);
  const first = await apply(empty, 'one', proposals.slice(0, 240), {
    issuedRequest: request(empty, 'one', source), authoritativeRaw: source
  });
  const second = await apply(first.ledger, 'two', proposals.slice(240), {
    issuedRequest: request(first.ledger, 'two', source), authoritativeRaw: source
  });
  assert.equal(first.ledger.cues.length, 240);
  assert.equal(second.ledger.cues.length, 245);
  assert.deepEqual(second.ledger.cues.slice(0, 240), first.ledger.cues);
});
