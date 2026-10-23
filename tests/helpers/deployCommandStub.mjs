import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { basename, resolve } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import fs from 'node:fs';

const bindings = [
  { name: 'LOG_LLM_PROMPTS', type: 'plain_text', text: 'true' },
  { name: 'MODAL_TEMPERATURE', type: 'plain_text', text: '1' },
  { name: 'OPENAI_MODEL', type: 'plain_text', text: 'dashboard-model' },
  { name: 'DASHBOARD_ONLY', type: 'plain_text', text: 'dashboard-canary-value' },
  { name: 'JSON_CONFIG', type: 'json', json: '{"enabled":false,"limit":0}' },
  // A local plaintext default must never replace an existing secret.
  { name: 'TEXT_PROVIDER', type: 'secret_text' }
];
const observability = {
  enabled: true,
  head_sampling_rate: 0.25,
  redact_query_string: true,
  issues: { enabled: process.env.TEST_ISSUES_DISABLED !== 'true' },
  logs: { enabled: true, persist: false, invocation_logs: false },
  traces: { enabled: false, head_sampling_rate: 0.1, persist: true }
};
let settings = { bindings, observability };
let deployed = false;
let attempts = 0;
let built = false;
const originalReadFile = fs.readFileSync;
fs.readFileSync = (path, ...args) => {
  if (process.env.TEST_BROWSERBASE_NO_KEY === '1' && resolve(String(path)) === resolve('.dev.vars')) {
    throw Object.assign(new Error('No test credentials'), { code: 'ENOENT' });
  }
  const content = originalReadFile(path, ...args);
  if (built && process.env.TEST_CONFIG_TARGET_CHANGE === 'true' && String(path).replaceAll('\\', '/').endsWith('/wrangler.jsonc')) {
    return String(content).replace('"name": "tableau"', '"name": "different-worker"');
  }
  return content;
};
if (process.env.TEST_BINDING_COLLISION === 'true') bindings.push({ name: 'ASSETS', type: 'plain_text', text: 'dashboard' });

globalThis.fetch = async (url, options) => {
  process.stdout.write(`REQUEST:${JSON.stringify({ url: String(url), method: options?.method || 'GET' })}\n`);
  if (options?.method && options.method !== 'GET') throw new Error('Unexpected remote mutation');
  if (!String(url).endsWith('/workers/scripts/tableau/settings')) throw new Error('Unexpected endpoint');
  if (process.env.TEST_SETTINGS_READ_FAIL === 'true' || (deployed && process.env.TEST_POST_READ_FAIL === 'true')) {
    return Response.json({ success: false, errors: [{ code: 10000, message: 'private-error-canary' }] }, { status: 403 });
  }
  if (process.env.TEST_SETTINGS_MALFORMED === 'true') return Response.json({ success: true, result: {} });
  if (process.env.TEST_SETTINGS_MISSING === 'true' && !deployed) {
    return Response.json({ success: false, errors: [{ code: 10007 }] }, { status: 404 });
  }
  return Response.json({ success: true, result: settings });
};

// Loaded only in the subprocess integration test. No child command, network
// operation, migration, build or deployment is actually executed.
childProcess.spawnSync = (command, args, options = {}) => {
  // Record the same logical npm/npx command on Windows and Unix.
  if (basename(command).toLowerCase() === 'cmd.exe' && args.slice(0, 3).join(' ') === '/d /s /c') {
    [command, ...args] = args.slice(3);
  }
  const isSmoke = args.includes('test:e2e:browserbase');
  const call = { command: basename(command), args };
  if (isSmoke) call.targetUrl = options.env?.BROWSERBASE_SMOKE_URL;
  process.stdout.write(`COMMAND:${JSON.stringify(call)}\n`);
  if (isSmoke) return { status: Number(process.env.TEST_BROWSERBASE_SMOKE_EXIT || 0), stdout: '[]', stderr: '' };
  if (args[0] === 'wrangler' && args[1] === 'deploy' && Number(process.env.TEST_WORKER_DEPLOY_EXIT || 0)) {
    return { status: Number(process.env.TEST_WORKER_DEPLOY_EXIT), stdout: '', stderr: 'Upload rejected' };
  }
  if (args.includes('auth') && args.includes('token')) {
    if (process.env.TEST_AUTH_FAIL === 'true') return { status: 1, stdout: 'private-auth-canary', stderr: 'private-auth-canary' };
    return { status: 0, stdout: '{"type":"oauth","token":"credential-canary"}', stderr: '' };
  }
  if (args[0] === 'wrangler' && args[1] === 'deploy') {
    attempts++;
    const configPath = args[args.indexOf('--config') + 1];
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    process.stdout.write(`CONFIG:${JSON.stringify({ configPath, mode: statSync(configPath).mode & 0o777, keepVars: config.keep_vars, vars: Object.keys(config.vars || {}), observability: config.observability })}\n`);
    if (process.env.TEST_RETRY_ONCE === 'true' && attempts === 1) {
      bindings.push({ name: 'ANTHROPIC_MODEL', type: 'plain_text', text: 'updated-between-attempts' });
      settings = { bindings, observability };
      return { status: 1, stdout: '', stderr: '503 Service Unavailable' };
    }
    if (process.env.TEST_UPLOAD_FAIL === 'true') return { status: 1, stdout: '', stderr: 'Upload rejected' };
    const retained = config.keep_vars && process.env.TEST_SETTINGS_MISSING !== 'true' ? bindings : [];
    const replacements = Object.entries(config.vars || {}).map(([name, value]) => ({ name, type: 'plain_text', text: String(value) }));
    settings = {
      bindings: [...retained.filter(binding => !replacements.some(item => item.name === binding.name)), ...replacements],
      observability: config.observability
    };
    if (process.env.TEST_DRIFT === 'vars') settings.bindings = settings.bindings.filter(binding => binding.name !== 'DASHBOARD_ONLY');
    if (process.env.TEST_DRIFT === 'issues') settings.observability = { ...settings.observability, issues: { enabled: false } };
    deployed = true;
  }
  if (args.includes('build')) {
    built = true;
    if (process.env.TEST_CHANGE_DURING_BUILD === 'true') {
      bindings.push({ name: 'ANTHROPIC_MODEL', type: 'plain_text', text: 'updated-during-build' });
      settings = { bindings, observability };
    }
  }
  const isQualityCheck = args.includes('ci:release-check');
  return { status: isQualityCheck ? Number(process.env.TEST_RELEASE_QA_EXIT || 0) : 0, stdout: args.includes('deploy') ? '' : '[]', stderr: '' };
};
syncBuiltinESMExports();
