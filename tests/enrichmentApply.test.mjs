import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { mergeEnrichedPassages } from '../functions/lib/knowledgeBase.js';
import { applyCandidates, selectApprovedRows, renderModule } from '../scripts/enrichment/applyPassageCandidates.js';
import { stringifyRow } from '../scripts/evaluation/lib/csv.js';

const prose = 'Bring curiosity to a manageable experiment while keeping a useful boundary in place. Notice what you learn before deciding how much time or energy to commit.';
const projection = 'A practical experiment can offer information while preserving your choices. Keep curiosity connected to a useful boundary and review what you learn before committing more energy.';
const header = ['candidate_id', 'card_number', 'card_name', 'context', 'draft_text', 'draft_tags', 'human_verdict', 'source_id', 'source_url', 'source_title', 'source_method', 'projection_text', 'projection_version', 'projection_verdict'];
const row = (id = 'first', number = '0', overrides = {}) => ({ candidate_id: id, card_number: number, card_name: MAJOR_ARCANA.find(card => String(card.number) === number)?.name || 'The Star', context: 'career', draft_text: prose, draft_tags: 'curiosity experiment boundaries', human_verdict: 'approve', source_id: `research:${id}`, source_url: 'https://example.com/background', source_title: 'Reviewed background', source_method: 'fetch', projection_text: projection, projection_version: 'meaning-v1', projection_verdict: 'approve', ...overrides });
const csv = rows => `${header.join(',')}\n${rows.map(entry => stringifyRow(header.map(key => entry[key] ?? ''))).join('\n')}\n`;
const hash = text => createHash('sha256').update(text).digest('hex');

async function workspace(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tableu-enrichment-apply-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const options = { queue: path.join(dir, 'queue.csv'), out: path.join(dir, 'registry.mjs'), provenance: path.join(dir, 'provenance.json'), log: () => {} };
  return { ...options, dir, write: rows => fs.writeFile(options.queue, csv(rows)), apply: extra => applyCandidates({ ...options, ...extra }) };
}

async function registry(out) {
  return (await import(`${pathToFileURL(out).href}?digest=${hash(await fs.readFile(out))}`)).ENRICHED_MAJOR_ARCANA_PASSAGES;
}

async function snapshot(options) {
  return Promise.all([fs.readFile(options.out, 'utf8'), fs.readFile(options.provenance, 'utf8')]);
}

for (const number of ['17.9', '17junk', '22', '-1', '+17', '017', '1e1', '0x11', '', 'NaN', 'Infinity']) {
  test(`approved noncanonical Major number cannot compile: ${JSON.stringify(number)}`, () => {
    const selected = selectApprovedRows(csv([row('bad', number)]));
    assert.equal(selected.approved.length, 0);
    assert.equal(selected.validationErrors.length, 1);
    assert.equal(selected.rejected.length, 0, 'invalid approval is distinct from deliberate revocation');
  });
}

for (const number of ['0', '21', ' 17 ']) {
  test(`canonical Major number remains accepted: ${JSON.stringify(number)}`, async () => {
    const selected = selectApprovedRows(csv([row('valid', number, { card_name: MAJOR_ARCANA[Number(number)].name })]));
    assert.deepEqual(selected.validationErrors, []);
    const module = await import(`data:text/javascript,${encodeURIComponent(renderModule(selected.approved))}`);
    assert.equal(module.ENRICHED_MAJOR_ARCANA_PASSAGES[Number(number)].passages.length, 1);
  });
}

for (const fields of [{ card_name: 'The Moon' }, { context: 'general' }, { draft_text: 'Too short.' }, { draft_tags: 'Bad tags' }, { projection_text: '', projection_verdict: 'approve' }]) {
  test(`malformed approved row aborts all application: ${JSON.stringify(fields)}`, async t => {
    const w = await workspace(t);
    await w.write([row()]);
    await w.apply();
    const before = await snapshot(w);
    await w.write([row('second', '1'), row('invalid', '17', fields)]);
    await assert.rejects(w.apply(), /validation/i);
    assert.deepEqual(await snapshot(w), before);
  });
}

test('partial and pending queues preserve absent approvals; explicit rejection revokes the matching candidate only', async t => {
  const w = await workspace(t);
  await w.write([row(), row('second', '17')]);
  assert.equal((await w.apply()).applied, 2);
  const first = (await registry(w.out))[0].passages[0];
  await w.write([row('second', '17', { human_verdict: '' })]);
  const pending = await w.apply();
  assert.equal(pending.preserved, 2);
  assert.equal(pending.removed, 0);
  assert.deepEqual((await registry(w.out))[0].passages[0], first);
  await w.write([row('unknown', '0', { human_verdict: 'reject' })]);
  assert.equal((await w.apply()).removed, 0, 'a rejected different candidate cannot erase an approved slot');
  await w.write([row('second', '17', { human_verdict: 'reject' })]);
  const removal = await w.apply();
  assert.equal(removal.removed, 1);
  assert.deepEqual(Object.keys(await registry(w.out)), ['0']);
  await w.write([row('first', '0', { human_verdict: 'reject' })]);
  const cleared = await w.apply();
  assert.equal(cleared.applied, 0);
  assert.equal(cleared.cleared, true);
  assert.deepEqual(await registry(w.out), {});
  assert.deepEqual(JSON.parse(await fs.readFile(w.provenance, 'utf8')).applied, []);
});

test('approved updates preserve missing projection approval; independent approval is never manufactured', async t => {
  const w = await workspace(t);
  await w.write([row(), row('second', '17', { projection_verdict: '' })]);
  await w.apply();
  const original = (await registry(w.out))[0].passages[0];
  await w.write([row('second', '17', { draft_text: `${prose} Keep listening.`, projection_verdict: '' })]);
  const result = await w.apply();
  assert.equal(result.updated, 1);
  assert.equal(result.preserved, 1);
  const generated = await registry(w.out);
  assert.deepEqual(generated[0].passages[0], original);
  assert.equal(generated[17].passages[0].projectionReviewStatus, 'pending');
});

test('duplicate approvals are validation errors and cannot partially overwrite the registry', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const before = await snapshot(w);
  await w.write([row('conflict-a', '17'), row('conflict-b', '17')]);
  await assert.rejects(w.apply(), /duplicate slot/i);
  assert.deepEqual(await snapshot(w), before);
});

test('replacement requires a complete manifest bound to queue bytes, current module hash, and full inventory', async t => {
  const w = await workspace(t);
  await w.write([row(), row('second', '17')]);
  const initial = await w.apply();
  await w.write([row('first', '0', { human_verdict: '' }), row('second', '17', { human_verdict: '' })]);
  const before = await snapshot(w);
  await assert.rejects(w.apply({ mode: 'replace' }), /manifest/i);
  const completenessManifest = { version: 1, complete: true, queueSha256: hash(await fs.readFile(w.queue)), previousOutputHash: initial.outputHash, candidateIds: ['first', 'second'], slots: ['0#career', '17#career'] };
  for (const overrides of [{ queueSha256: '0'.repeat(64) }, { previousOutputHash: '0'.repeat(64) }, { candidateIds: ['first'] }, { slots: ['0#career'] }, { complete: false }]) {
    await assert.rejects(w.apply({ mode: 'replace', completenessManifest: { ...completenessManifest, ...overrides } }), /manifest|identity|complete/i);
    assert.deepEqual(await snapshot(w), before);
  }
  const dry = await w.apply({ mode: 'replace', completenessManifest, dryRun: true });
  assert.equal(dry.removed, 2);
  assert.equal(dry.cleared, true);
  assert.deepEqual(await snapshot(w), before);
  const result = await w.apply({ mode: 'replace', completenessManifest });
  assert.equal(result.removed, 2);
  assert.deepEqual(await registry(w.out), {});
});

test('a partial queue cannot claim replacement completeness by omitting an applied candidate from its manifest', async t => {
  const w = await workspace(t);
  await w.write([row(), row('second', '17')]);
  const initial = await w.apply();
  await w.write([row('first', '0')]);
  await assert.rejects(w.apply({ mode: 'replace', completenessManifest: { version: 1, complete: true, queueSha256: hash(await fs.readFile(w.queue)), previousOutputHash: initial.outputHash, candidateIds: ['first'], slots: ['0#career'] } }), /complete|inventory/i);
});

test('module digest binds provenance; mismatch fails without writes, including dry runs', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  const result = await w.apply();
  const record = JSON.parse(await fs.readFile(w.provenance, 'utf8'));
  assert.equal(record.moduleSha256, hash(await fs.readFile(w.out)));
  assert.equal(result.outputHash, record.moduleSha256);
  await fs.appendFile(w.out, '\n// interrupted external edit\n');
  const before = await snapshot(w);
  await assert.rejects(w.apply({ dryRun: true }), /hash|identity|mismatch/i);
  assert.deepEqual(await snapshot(w), before);
});

for (const operation of ['writeFile', 'rename']) {
  test(`handled ${operation} failure preserves the prior pair and a later rerun succeeds`, async t => {
    const w = await workspace(t);
    await w.write([row()]);
    await w.apply();
    const before = await snapshot(w);
    await w.write([row('second', '17')]);
    const original = fs[operation];
    let failed = false;
    const mock = t.mock.method(fs, operation, async (...args) => {
      const target = String(args[operation === 'rename' ? 1 : 0]);
      if (!failed && (operation === 'rename' ? target === w.provenance : target.includes('.stage-'))) {
        failed = true;
        throw new Error('synthetic publication failure');
      }
      return original(...args);
    });
    await assert.rejects(w.apply(), /synthetic publication failure/);
    mock.mock.restore();
    assert.deepEqual(await snapshot(w), before);
    assert.equal((await w.apply()).applied, 2);
  });
}

test('missing and malformed queues preserve output; an empty valid merge preserves approvals', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const before = await snapshot(w);
  await fs.unlink(w.queue);
  await assert.rejects(w.apply(), /not found/i);
  await fs.writeFile(w.queue, `${header.join(',')}\n"unterminated\n`);
  await assert.rejects(w.apply(), /CSV|queue|quoted/i);
  assert.deepEqual(await snapshot(w), before);
  await w.write([]);
  assert.equal((await w.apply()).preserved, 1);
  assert.deepEqual((await registry(w.out))[0].passages.length, 1);
});

test('serialized metadata cannot become module instructions or uncontrolled comments', async t => {
  const w = await workspace(t);
  const id = 'candidate */ globalThis.enrichmentInjected = true; /*';
  await w.write([row(id, '0', { source_title: 'Background\n*/ export const injected = true; //' })]);
  await w.apply();
  const generated = await registry(w.out);
  assert.equal(globalThis.enrichmentInjected, undefined);
  assert.equal(generated[0].passages[0].provenance.candidateId, id);
  assert.equal(generated[0].passages[0].provenance.sourceTitle, 'Background\n*/ export const injected = true; //');
});

test('external generated code is rejected as data before it can run', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await fs.writeFile(w.out, 'globalThis.enrichmentInjected = true; export const ENRICHED_MAJOR_ARCANA_PASSAGES = {};');
  await assert.rejects(w.apply(), /module|registry|data/i);
  assert.equal(globalThis.enrichmentInjected, undefined);
});

test('defensive runtime merge rejects malformed identities and shapes without touching hand-written canon', () => {
  const base = { 0: { passages: [] }, 17: { passages: [] } };
  mergeEnrichedPassages(base, { '-1': { passages: [{ text: 'Bad', context: 'career' }] }, '017': { passages: [{ text: 'Bad', context: 'career' }] }, 0: { passages: [{ text: {}, context: 'career' }, { text: 'Bad', context: {} }, { text: 'Bad', context: 'career', tags: 'bad' }, { text: 'Good', context: 'career', tags: ['valid'] }] } });
  assert.equal(base[17].passages.length, 0);
  assert.deepEqual(base[0].passages.map(entry => entry.text), ['Good']);
});

test('CLI rejects unknown apply mode and missing replacement manifests with a nonzero exit', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  const script = path.resolve('scripts/enrichment/applyPassageCandidates.js');
  for (const extra of [['--mode', 'unknown'], ['--mode', 'replace']]) {
    const result = spawnSync(process.execPath, [script, '--queue', w.queue, '--out', w.out, '--provenance', w.provenance, ...extra], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mode|manifest/i);
    await assert.rejects(fs.stat(w.out), { code: 'ENOENT' });
  }
});

test('a scoped approved slot update preserves other slots and reports the replaced candidate accurately', async t => {
  const w = await workspace(t);
  await w.write([row(), row('second', '17')]);
  await w.apply();
  const prior = (await registry(w.out))[17].passages[0];
  await w.write([row('replacement')]);
  const result = await w.apply();
  assert.equal(result.updated, 1);
  assert.equal(result.preserved, 1);
  assert.equal(result.removed, 1);
  assert.equal(result.revoked, 0);
  assert.equal((await registry(w.out))[0].passages[0].provenance.candidateId, 'replacement');
  assert.deepEqual((await registry(w.out))[17].passages[0], prior);
});

test('a fresh dry run validates the proposed module without creating either destination', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  const result = await w.apply({ dryRun: true });
  assert.equal(result.applied, 1);
  assert.equal(result.added, 1);
  assert.match(result.outputHash, /^[a-f0-9]{64}$/);
  assert.deepEqual((await fs.readdir(w.dir)).sort(), ['queue.csv']);
});

test('matching legacy object-literal data and provenance preserve independent projection approval while gaining hashes', async t => {
  const w = await workspace(t);
  const legacyPassage = { source: 'Tableu Tarot Canon (research-informed interpretation)', sourceId: 'research:first', sourceUrls: ['https://example.com/background'], provenance: { candidateId: 'first', sourceTitle: 'Reviewed background', sourceMethod: 'fetch' }, archetypalText: projection, projectionVersion: 'meaning-v1', projectionReviewStatus: 'approved', context: 'career', text: prose, tags: ['curiosity', 'experiment', 'boundaries'] };
  const legacy = `// legacy generator\nexport const ENRICHED_MAJOR_ARCANA_PASSAGES = {\n  0: { passages: [{\n    source: 'Tableu Tarot Canon (research-informed interpretation)',\n    ${Object.entries(legacyPassage).filter(([key]) => key !== 'source').map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(',\n')},\n  }] },\n};\n`;
  const priorRecord = { applied: [{ candidateId: 'first', cardNumber: 0, cardName: 'The Fool', context: 'career', sourceId: legacyPassage.sourceId, sourceUrls: legacyPassage.sourceUrls, sourceUrl: legacyPassage.sourceUrls[0], sourceTitle: 'Reviewed background', sourceMethod: 'fetch', archetypalText: projection, projectionVersion: 'meaning-v1', projectionReviewStatus: 'approved', model: '' }] };
  await fs.writeFile(w.out, legacy);
  await fs.writeFile(w.provenance, JSON.stringify(priorRecord));
  await w.write([row('first', '0', { human_verdict: '' })]);
  const result = await w.apply();
  assert.equal(result.preserved, 1);
  assert.deepEqual((await registry(w.out))[0].passages[0], legacyPassage);
  const after = JSON.parse(await fs.readFile(w.provenance, 'utf8'));
  assert.equal(after.schemaVersion, 1);
  assert.equal(after.moduleSha256, hash(await fs.readFile(w.out)));
  assert.equal(after.applied[0].projectionReviewStatus, 'approved');
});

test('a missing provenance sidecar cannot authorize adoption of a nonempty existing module', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const before = await fs.readFile(w.out, 'utf8');
  await fs.unlink(w.provenance);
  await assert.rejects(w.apply(), /provenance.*missing/i);
  assert.equal(await fs.readFile(w.out, 'utf8'), before);
});

test('an interrupted publication marker stops the next apply and preserves all recovery evidence', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const before = await snapshot(w);
  const marker = `${w.out}.apply-recovery.json`;
  await fs.writeFile(marker, '{"version":1,"recovery":"synthetic"}');
  await assert.rejects(w.apply(), /unfinished.*publication|recovery/i);
  assert.deepEqual(await snapshot(w), before);
  assert.equal(await fs.readFile(marker, 'utf8'), '{"version":1,"recovery":"synthetic"}');
});

test('failed restoration retains the prior backups and a recovery marker instead of guessing state', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const before = await snapshot(w);
  await w.write([row('second', '17')]);
  const original = fs.rename;
  const mock = t.mock.method(fs, 'rename', async (...args) => {
    if (String(args[1]) === w.provenance) throw new Error('synthetic persistent rename failure');
    return original(...args);
  });
  await assert.rejects(w.apply(), /recovery required/i);
  mock.mock.restore();
  const recovery = JSON.parse(await fs.readFile(`${w.out}.apply-recovery.json`, 'utf8'));
  assert.equal(await fs.readFile(recovery.backupModule, 'utf8'), before[0]);
  assert.equal(await fs.readFile(recovery.backupProvenance, 'utf8'), before[1]);
  assert.equal(recovery.previousOutputHash, hash(before[0]));
  await assert.rejects(w.apply(), /unfinished.*publication|recovery/i);
});

test('staged bytes are checked before publication and cannot add executable content', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const before = await snapshot(w);
  await w.write([row('second', '17')]);
  const original = fs.writeFile;
  const mock = t.mock.method(fs, 'writeFile', async (file, data, ...args) => original(file, String(file).includes('.stage-') && String(file).endsWith('.mjs') ? `${data}\nglobalThis.enrichmentInjected = true;` : data, ...args));
  await assert.rejects(w.apply(), /staged module identity/i);
  mock.mock.restore();
  assert.deepEqual(await snapshot(w), before);
  assert.equal(globalThis.enrichmentInjected, undefined);
});

test('new provenance cannot lose its module hash or change independent projection decisions', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  const record = JSON.parse(await fs.readFile(w.provenance, 'utf8'));
  const moduleBytes = await fs.readFile(w.out, 'utf8');
  const withoutHash = { ...record };
  delete withoutHash.moduleSha256;
  await fs.writeFile(w.provenance, JSON.stringify(withoutHash));
  await assert.rejects(w.apply(), /hash/i);
  record.applied[0].projectionReviewStatus = 'pending';
  await fs.writeFile(w.provenance, JSON.stringify(record));
  await assert.rejects(w.apply(), /identity mismatch/i);
  assert.equal(await fs.readFile(w.out, 'utf8'), moduleBytes);
});

test('CLI check validates the applied pair without requiring a review queue and rejects an externally malformed module', async t => {
  const w = await workspace(t);
  await w.write([row()]);
  await w.apply();
  await fs.unlink(w.queue);
  const script = path.resolve('scripts/enrichment/applyPassageCandidates.js');
  const check = () => spawnSync(process.execPath, [script, '--check', '--out', w.out, '--provenance', w.provenance], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  const good = check();
  assert.equal(good.status, 0, good.stderr);
  await fs.writeFile(w.out, 'export const ENRICHED_MAJOR_ARCANA_PASSAGES = { "-1": { passages: [] } };');
  const invalid = check();
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /registry.*identity|validation/i);
});

test('applied-module checking rejects joined export keywords that are not executable JavaScript', async t => {
  const w = await workspace(t);
  await fs.writeFile(w.out, 'exportconstENRICHED_MAJOR_ARCANA_PASSAGES={};');
  const result = spawnSync(process.execPath, [path.resolve('scripts/enrichment/applyPassageCandidates.js'), '--check', '--out', w.out, '--provenance', w.provenance], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /module|data|export/i);
});

test('successful publication cleanup cannot leave a marker referencing deleted backups or block a valid rerun', async t => {
  const w = await workspace(t);
  await w.write([row()]); await w.apply();
  await w.write([row(), row('second', '17')]);
  const originalRm = fs.rm;
  let injected = false;
  const mocked = t.mock.method(fs, 'rm', async (file, ...args) => {
    const result = await originalRm(file, ...args);
    if (!injected && String(file).includes('.backup-')) { injected = true; throw new Error('synthetic cleanup failure after deleting backup'); }
    return result;
  });
  await assert.rejects(w.apply(), /synthetic cleanup/);
  mocked.mock.restore();
  assert.equal(injected, true);
  assert.equal((await registry(w.out))[17].passages.length, 1);
  await assert.rejects(fs.readFile(`${w.out}.apply-recovery.json`), { code: 'ENOENT' });
  await assert.rejects(fs.readFile(`${w.out}.apply.lock`), { code: 'ENOENT' });
  assert.equal((await w.apply()).applied, 2);
});
