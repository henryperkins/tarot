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

function runConfigCheck(devVarsText, wranglerConfigText = null) {
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
        HOME: process.env.HOME
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('native OpenAI provider configuration', () => {
  it('combines a Modal secret from .dev.vars with non-secret Wrangler vars', () => {
    const output = runConfigCheck(
      'MODAL_PROXY_TOKEN=wk-test.ws-test',
      `{
        // Non-secret provider settings belong in Wrangler configuration.
        "vars": {
          "MODAL_ENDPOINT_URL": "https://example.modal.direct",
          "MODAL_MODEL": "Qwen/Qwen3.8-2.4T-A95B"
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
