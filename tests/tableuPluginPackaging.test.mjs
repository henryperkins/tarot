import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = join(root, 'docs/integrations/openai/submission/1.0.1');
const lock = JSON.parse(readFileSync(join(packagePath, 'package-lock.json'), 'utf8'));
const script = join(root, 'scripts/integrations/package_tableu_plugin.py');
const source = resolve(packagePath, lock.sourceDirectory);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function scratch(t) {
  const path = mkdtempSync(join(tmpdir(), 'tableu-plugin-package-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

test('preserved upload reconstructs identical bytes and valid metadata after round-trip', (t) => {
  const path = scratch(t);
  const output = join(path, 'plugin.zip');
  const copiedSource = join(path, 'source');
  cpSync(source, copiedSource, { recursive: true });
  utimesSync(join(copiedSource, '.codex-plugin/plugin.json'), new Date(), new Date());
  const result = JSON.parse(execFileSync('python3', [script, '--source', copiedSource, '--output', output], { encoding: 'utf8' }));
  assert.equal(result.files, 17);
  assert.equal(readFileSync(output).length, lock.archive.bytes);
  assert.equal(sha256(readFileSync(output)), lock.archive.sha256);
  const members = JSON.parse(execFileSync('python3', ['-c', [
    'import json,sys',
    'from zipfile import ZipFile',
    'with ZipFile(sys.argv[1]) as z:',
    ' print(json.dumps({i.filename: z.read(i).decode() for i in z.infolist() if not i.filename.endswith(".png")}))'
  ].join('\n'), output], { encoding: 'utf8' }));
  const prefix = `${lock.name}/`;
  const manifest = JSON.parse(members[`${prefix}.codex-plugin/plugin.json`]);
  assert.equal(manifest.name, lock.name);
  assert.equal(manifest.version, lock.version);
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.equal(manifest.apps, undefined);
  assert.equal(manifest.extensions['com.openai'].apps, undefined);
  assert.equal(manifest.interface.shortDescription.length <= 30, true);
  assert.equal(manifest.interface.longDescription.length <= 4000, true);
  for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    const url = new URL(manifest.interface[field]);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.username + url.password, '');
  }
  const cases = manifest.extensions['com.openai'].review.test_cases;
  assert.equal(cases.positive.length, 5);
  assert.equal(cases.negative.length, 3);
  for (const item of [...cases.positive, ...cases.negative]) {
    assert.ok(item.description && item.prompt);
  }
  for (const item of cases.positive) {
    assert.equal(typeof item.tools_triggered, 'string');
    assert.equal(typeof item.expected_behavior, 'string');
  }
  const mcp = JSON.parse(members[`${prefix}.mcp.json`]);
  assert.equal(mcp.mcpServers.tableu.url, 'https://tarot.lakefrontdev.com/mcp');
  const index = JSON.parse(members[`${prefix}skills/instructions/lookup/knowledge-index.json`]);
  for (const reference of index.files) {
    assert.ok(members[`${prefix}skills/instructions/${reference.path}`]);
  }
  for (const [field, dimension] of [['logo', 512], ['composerIcon', 192]]) {
    const relative = manifest.interface[field].replace(/^\.\//, '');
    const png = readFileSync(join(copiedSource, relative));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), dimension);
    assert.equal(png.readUInt32BE(20), dimension);
    assert.ok(png.length <= 5 * 1024 * 1024);
  }
  const tools = new Set([
    'get_profile', 'draw_tarot_reading', 'start_tarot_reading',
    'wait_for_tarot_reading', 'get_tarot_reading_status', 'cancel_tarot_reading',
    'save_reading_to_journal', 'add_reflection_to_journal_entry'
  ]);
  for (const item of cases.positive) {
    for (const tool of item.tools_triggered.split(', ')) assert.ok(tools.has(tool));
  }
  for (const [name, content] of Object.entries(members)) {
    if (name.endsWith('.json')) JSON.parse(content);
    if (name.endsWith('.yaml')) yaml.load(content);
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatter) yaml.load(frontmatter[1]);
    assert.doesNotMatch(content, /https:\/\/chatgpt\.com\/(?:c\/|g\/[\w-]+\/invite\/)/);
  }
  execFileSync('python3', [script, '--output', output]);
  assert.equal(sha256(readFileSync(output)), lock.archive.sha256);
});

for (const variant of ['modified', 'extra', 'symlink', 'different output']) {
  test(`packaging rejects ${variant} without producing or replacing an archive`, (t) => {
    const path = scratch(t);
    const copiedSource = join(path, 'source');
    const output = join(path, 'plugin.zip');
    cpSync(source, copiedSource, { recursive: true });
    if (variant === 'modified') writeFileSync(join(copiedSource, '.mcp.json'), '{}\n');
    if (variant === 'extra') writeFileSync(join(copiedSource, 'unreviewed.txt'), 'extra');
    if (variant === 'symlink') symlinkSync('/etc/hosts', join(copiedSource, 'linked.txt'));
    if (variant === 'different output') writeFileSync(output, 'existing output');
    const result = spawnSync('python3', [script, '--source', copiedSource, '--output', output], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Tableu packaging failed:/);
    if (variant === 'different output') assert.equal(readFileSync(output, 'utf8'), 'existing output');
  });
}

test('public 1.0.2 package rebuilds from its lock without internal fields or plan language', (t) => {
  const v2Path = join(root, 'docs/integrations/openai/submission/1.0.2');
  const v2Lock = JSON.parse(readFileSync(join(v2Path, 'package-lock.json'), 'utf8'));
  const output = join(scratch(t), 'plugin-1.0.2.zip');
  const result = JSON.parse(execFileSync('python3', [script, '--version', '1.0.2', '--output', output], { encoding: 'utf8' }));
  assert.equal(result.files, Object.keys(v2Lock.files).length);
  assert.equal(sha256(readFileSync(output)), v2Lock.archive.sha256);

  const v2Source = resolve(v2Path, v2Lock.sourceDirectory);
  const manifest = JSON.parse(readFileSync(join(v2Source, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.version, '1.0.2');
  assert.equal(manifest.name, lock.name, 'the plugin identity is unchanged');
  const review = manifest.extensions['com.openai'].review;
  assert.equal(review.commerce, false);
  assert.deepEqual(manifest.extensions['com.openai'].publication.countries, [], 'available in every country');
  assert.equal(review.test_cases.positive.length, 5);
  assert.equal(review.test_cases.negative.length, 3);
  assert.deepEqual(JSON.parse(readFileSync(join(v2Source, '.mcp.json'), 'utf8')).mcpServers.tableu.url, 'https://tarot.lakefrontdev.com/mcp');

  const textMembers = Object.keys(v2Lock.files).filter((name) => /\.(md|json|yaml)$/.test(name));
  for (const name of textMembers) {
    const text = readFileSync(join(v2Source, name), 'utf8');
    assert.doesNotMatch(text, /jobToken|requestId/, name);
    if (name !== '.codex-plugin/plugin.json') {
      assert.doesNotMatch(text, /\b(Seeker|Enlightened|Mystic)\b|\$\d|readings\/month/, `${name} carries no plan or pricing details`);
    }
  }
  const index = JSON.parse(readFileSync(join(v2Source, 'skills/instructions/lookup/knowledge-index.json'), 'utf8'));
  for (const file of index.files) {
    assert.ok(v2Lock.files[`skills/instructions/${file.path}`], `${file.path} is packaged`);
  }
  assert.equal(Object.keys(v2Lock.files).some((name) => /migration|ActionsGPT|capabilities-audit/.test(name)), false);
});
