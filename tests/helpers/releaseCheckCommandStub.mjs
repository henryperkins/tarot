import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { UNIT_SUITE_CREDENTIAL_ENV_KEYS } from '../../scripts/evaluation/lib/subscriptionNarrative.js';

let settingsReads = 0;
globalThis.fetch = async (url, options) => {
  if (url !== 'https://tarot.lakefrontdev.com/api/admin/ai-configuration/release-settings'
    || options?.redirect !== 'error' || options?.headers?.Authorization !== 'Bearer offline-admin-test-key') {
    throw new Error('Unexpected release settings request');
  }
  settingsReads++;
  const claude = process.env.TEST_RELEASE_PRIMARY === 'claude-api';
  const settings = {
    environment: 'production',
    revision: process.env.TEST_RELEASE_SETTINGS_DRIFT && settingsReads > 1 ? 8 : 7,
    providerId: claude ? 'claude-api' : 'openai-native',
    modelId: claude ? 'claude-opus-5-5' : 'gpt-6.1-sol',
    reasoningEffort: 'medium',
    deadlineMs: 75000
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(settings)).digest('hex');
  process.stdout.write(`SETTINGS_READ:${fingerprint}\n`);
  return Response.json({ ...settings, fingerprint });
};

// Exercise the real preflight and subscription validation without a host login.
childProcess.spawn = (_command, args) => {
  if (!args.includes('auth') || !args.includes('status')) throw new Error('Unexpected inference during preflight');
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  queueMicrotask(() => {
    process.stdout.write('LOGIN_CHECK\n');
    child.stdout.end(JSON.stringify({ loggedIn: !process.env.TEST_RELEASE_LOGIN_FAIL,
      authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max' }));
    child.emit('close', 0);
  });
  return child;
};

// Record the environment of each npm check without executing it.
childProcess.spawnSync = (_command, args, options) => {
  const script = args[args.indexOf('run') + 1];
  process.stdout.write(`CHECK:${JSON.stringify({ script, backend: options.env.NARRATIVE_EVAL_BACKEND, textProvider: options.env.TEXT_PROVIDER,
    adminKey: Object.hasOwn(options.env, 'ADMIN_API_KEY'),
    openaiKey: Object.hasOwn(options.env, 'OPENAI_API_KEY'), evalOpenaiKey: Boolean(options.env.NARRATIVE_EVAL_OPENAI_API_KEY),
    openaiTimeoutMs: options.env.OPENAI_TIMEOUT_MS ?? null,
    model: options.env.NARRATIVE_EVAL_BACKEND === 'claude-code' ? options.env.ANTHROPIC_MODEL : options.env.OPENAI_MODEL,
    effort: options.env.NARRATIVE_EVAL_BACKEND === 'claude-code' ? options.env.ANTHROPIC_EFFORT : options.env.OPENAI_REASONING_EFFORT,
    anthropicTimeoutMs: options.env.ANTHROPIC_TIMEOUT_MS, fingerprint: options.env.NARRATIVE_CONFIG_FINGERPRINT,
    revision: options.env.NARRATIVE_CONFIG_REVISION,
    credentialKeys: UNIT_SUITE_CREDENTIAL_ENV_KEYS.filter(name => Object.hasOwn(options.env, name)) })}\n`);
  return { status: script === process.env.TEST_RELEASE_CHECK_FAIL ? 7 : 0, stdout: '', stderr: '' };
};
syncBuiltinESMExports();
