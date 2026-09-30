import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ensureAzureConfig } from '../functions/lib/azureResponses.js';
import { isAzureTokenStreamingEnabled } from '../functions/lib/readingTelemetry.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkEnvScript = path.join(repoRoot, 'scripts/checkEnv.js');

function runConfigCheck(devVarsText, wranglerConfigText = null, envVars = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tarot-config-check-'));
  try {
    if (devVarsText !== null) {
      writeFileSync(path.join(dir, '.dev.vars'), devVarsText);
    }
    if (wranglerConfigText !== null) {
      writeFileSync(path.join(dir, 'wrangler.jsonc'), wranglerConfigText);
    }
    return execFileSync(process.execPath, [checkEnvScript], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...envVars
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('native OpenAI provider configuration', () => {
  it('accepts a complete Modal proxy token pair without a legacy token', () => {
    const output = runConfigCheck(
      'MODAL_PROXY_TOKEN_ID=wk-pair-fixture\nMODAL_PROXY_TOKEN_SECRET=ws-pair-fixture',
      JSON.stringify({ vars: {
        MODAL_ENDPOINT_URL: 'https://example.modal.direct/v1',
        MODAL_MODEL: 'Qwen/Qwen3.8-Max-VL-Thinking'
      } })
    );

    assert.match(output, /MODAL_PROXY_TOKEN_ID \(\.dev\.vars\)/);
    assert.match(output, /MODAL_PROXY_TOKEN_SECRET \(\.dev\.vars\)/);
    assert.match(output, /All required environment variables for AI-generated readings are present \(Modal\)/);
    assert.doesNotMatch(output, /wk-pair-fixture|ws-pair-fixture/);
  });

  it('resolves a Modal token pair across shell and local configuration without printing values', () => {
    const output = runConfigCheck(
      'MODAL_PROXY_TOKEN_SECRET=ws-local-fixture',
      JSON.stringify({ vars: {
        MODAL_ENDPOINT_URL: 'https://example.modal.direct/v1',
        MODAL_MODEL: 'Qwen/Qwen3.8-Max-VL-Thinking'
      } }),
      { MODAL_PROXY_TOKEN_ID: 'wk-shell-fixture' }
    );

    assert.match(output, /MODAL_PROXY_TOKEN_ID \(process\.env\)/);
    assert.match(output, /MODAL_PROXY_TOKEN_SECRET \(\.dev\.vars\)/);
    assert.match(output, /All required environment variables for AI-generated readings are present \(Modal\)/);
    assert.doesNotMatch(output, /wk-shell-fixture|ws-local-fixture/);
  });

  for (const credential of ['MODAL_PROXY_TOKEN_ID', 'MODAL_PROXY_TOKEN_SECRET']) {
    it(`rejects an incomplete Modal pair containing only ${credential}, even with fallback credentials`, () => {
      assert.throws(() => runConfigCheck([
        `${credential}=incomplete-pair-fixture`,
        'MODAL_PROXY_TOKEN=legacy-fixture',
        'OPENAI_API_KEY=openai-fixture',
        'MODAL_ENDPOINT_URL=https://example.modal.direct/v1',
        'MODAL_MODEL=Qwen/Qwen3.8-Max-VL-Thinking'
      ].join('\n')), (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /Modal proxy token pair is incomplete/);
        assert.match(error.stderr, /MODAL_PROXY_TOKEN_ID.*MODAL_PROXY_TOKEN_SECRET/);
        assert.doesNotMatch(`${error.stdout}\n${error.stderr}`, /incomplete-pair-fixture|legacy-fixture|openai-fixture/);
        return true;
      });
    });
  }

  it('rejects explicitly empty Modal pair credentials instead of using a legacy token', () => {
    assert.throws(() => runConfigCheck([
      'MODAL_PROXY_TOKEN_ID=',
      'MODAL_PROXY_TOKEN_SECRET=',
      'MODAL_PROXY_TOKEN=legacy-fixture',
      'MODAL_ENDPOINT_URL=https://example.modal.direct/v1',
      'MODAL_MODEL=Qwen/Qwen3.8-Max-VL-Thinking'
    ].join('\n')), (error) => {
      assert.equal(error.status, 1);
      assert.match(error.stderr, /Modal proxy token pair is incomplete/);
      return true;
    });
  });

  for (const [label, settings] of [
    ['embedded token whitespace', { MODAL_PROXY_TOKEN_ID: 'fixture id' }],
    ['an invalid stream flag', { MODAL_STREAM: 'invalid' }],
    ['an invalid sampling bound', { MODAL_TOP_P: '2' }]
  ]) {
    it(`rejects ${label} when Modal is the only configured provider`, () => {
      const values = {
        MODAL_PROXY_TOKEN_ID: 'fixture-id',
        MODAL_PROXY_TOKEN_SECRET: 'fixture-secret',
        MODAL_ENDPOINT_URL: 'https://example.modal.direct/v1',
        MODAL_MODEL: 'Qwen/Qwen3.8-Max-VL-Thinking',
        ...settings
      };
      assert.throws(() => runConfigCheck(Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')), (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /Modal configuration/);
        assert.doesNotMatch(`${error.stdout}\n${error.stderr}`, /fixture-id|fixture-secret|fixture id/);
        return true;
      });
    });
  }

  it('uses the shared default model when no explicit Modal model is configured', () => {
    const output = runConfigCheck([
      'MODAL_PROXY_TOKEN=legacy-fixture',
      'MODAL_ENDPOINT_URL=https://example.modal.direct/v1'
    ].join('\n'));
    assert.match(output, /MODAL_MODEL \(default: Qwen\/Qwen3\.8-Max-VL-Thinking\)/);
    assert.match(output, /All required environment variables for AI-generated readings are present \(Modal\)/);
  });

  it('selects a valid fallback when optional Modal settings make Modal unavailable', () => {
    const output = runConfigCheck([
      'MODAL_PROXY_TOKEN=legacy-fixture',
      'MODAL_ENDPOINT_URL=https://example.modal.direct/v1',
      'MODAL_MODEL=Qwen/Qwen3.8-Max-VL-Thinking',
      'MODAL_STREAM=invalid',
      'OPENAI_API_KEY=openai-fixture'
    ].join('\n'));
    assert.match(output, /All required environment variables for AI-generated readings are present \(OpenAI native\)/);
    assert.doesNotMatch(output, /legacy-fixture|openai-fixture/);
  });

  it('combines a Modal secret from .dev.vars with non-secret Wrangler vars', () => {
    const output = runConfigCheck(
      'MODAL_PROXY_TOKEN=wk-test.ws-test',
      `{
        // Non-secret provider settings belong in Wrangler configuration.
        "vars": {
          "MODAL_ENDPOINT_URL": "https://example.modal.direct",
          "MODAL_MODEL": "Qwen/Qwen3.8-Max-VL-Thinking"
        }
      }`
    );

    assert.match(output, /AI-generated readings \(Modal\):/);
    assert.match(output, /MODAL_PROXY_TOKEN \(\.dev\.vars\)/);
    assert.match(output, /MODAL_ENDPOINT_URL \(wrangler\.jsonc\)/);
    assert.match(output, /MODAL_MODEL \(wrangler\.jsonc\)/);
    assert.match(output, /All required environment variables for AI-generated readings are present \(Modal\)/);
  });

  it('uses gpt-5.6-sol as the default native OpenAI Responses model', () => {
    const config = ensureAzureConfig({
      OPENAI_API_KEY: 'openai-test-key'
    });

    assert.equal(config.provider, 'openai-native');
    assert.equal(config.model, 'gpt-5.6-sol');
    assert.equal(config.url, 'https://api.openai.com/v1/responses');
    assert.deepEqual(config.authHeaders, { Authorization: 'Bearer openai-test-key' });
  });

  it('honors an explicit OPENAI_MODEL override', () => {
    const config = ensureAzureConfig({
      OPENAI_API_KEY: 'openai-test-key',
      OPENAI_MODEL: 'gpt-5.6-sol-preview'
    });
    assert.equal(config.model, 'gpt-5.6-sol-preview');
  });

  it('accepts OPENAI_API_KEY as sufficient for AI-generated readings in config checks', () => {
    const output = runConfigCheck([
      'OPENAI_API_KEY=sk-test',
      'OPENAI_MODEL=gpt-5.6-sol'
    ].join('\n'));

    assert.match(output, /AI-generated readings \(OpenAI native\):/);
    assert.match(output, /OPENAI_API_KEY \(\.dev\.vars\)/);
    assert.match(output, /All required environment variables for AI-generated readings are present/);
  });

  it('uses OPENAI_STREAMING_ENABLED before the legacy Azure streaming flag', () => {
    assert.equal(isAzureTokenStreamingEnabled({ OPENAI_STREAMING_ENABLED: 'true' }), true);
    assert.equal(isAzureTokenStreamingEnabled({
      OPENAI_STREAMING_ENABLED: 'false',
      AZURE_OPENAI_STREAMING_ENABLED: 'true'
    }), false);
  });
});
