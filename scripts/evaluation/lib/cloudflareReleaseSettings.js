import { configEnabled, configEnvironment, getFeature, publicTextRestriction } from '../../../functions/lib/aiConfigCatalog.js';
import { resolveFeatureRevision } from '../../../functions/lib/aiConfigStore.js';
import { describeReleaseReading } from '../../../functions/lib/aiConfigRelease.js';
import { getDeploymentEnvironment, runProjectWrangler, variableValue } from '../../lib/deploySettings.js';
import { OPENAI_EVAL_KEY_VARIABLE, UNIT_SUITE_CREDENTIAL_ENV_KEYS } from './subscriptionNarrative.js';

export const PRODUCTION_ORIGIN = 'https://tarot.lakefrontdev.com';

// These are deployment settings consumed by the Readings policy and deadline.
// Provider credentials are resolved inside the live Worker by its health check.
const readingVariables = new Set([
  'AI_CONFIG_ENABLED', 'AI_CONFIG_ENVIRONMENT', 'TEXT_PROVIDER',
  'OPENAI_MODEL', 'OPENAI_REASONING_EFFORT', 'OPENAI_STREAMING_ENABLED', 'OPENAI_TIMEOUT_MS',
  'ANTHROPIC_MODEL', 'ANTHROPIC_EFFORT', 'ANTHROPIC_TIMEOUT_MS', 'READING_TASK_TIMEOUT_MS',
  'MODAL_MODEL', 'MODAL_REASONING_EFFORT'
]);

const latestReading = "SELECT revision, catalog_version, policy_json FROM ai_feature_config_revisions WHERE environment = 'production' AND feature_id = 'readings' ORDER BY revision DESC LIMIT 1";

function readWranglerJson(args, config) {
  const env = getDeploymentEnvironment(config, process.env);
  for (const name of ['ADMIN_API_KEY', 'BROWSERBASE_API_KEY', OPENAI_EVAL_KEY_VARIABLE, ...UNIT_SUITE_CREDENTIAL_ENV_KEYS]) delete env[name];
  const result = runProjectWrangler([...args, '--config', 'wrangler.jsonc', '--json'], {
    env: { ...env, CI: 'true', WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false' },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000
  });
  if (result.status !== 0) throw new Error('The Cloudflare deployment login could not read ' + args.slice(0, 2).join(' ') + ' for release QA.');
  return JSON.parse(result.stdout);
}

async function versionSettings(config, bindings, read) {
  if (!Array.isArray(bindings)) throw new Error('Cloudflare did not return the deployed Worker bindings.');
  const env = {};
  for (const binding of bindings) {
    if (!readingVariables.has(binding.name)) continue;
    if (!['plain_text', 'json'].includes(binding.type)) {
      throw new Error('Cloudflare cannot read the deployed reading setting ' + binding.name + '.');
    }
    env[binding.name] = variableValue(binding);
  }
  if (configEnvironment(env) !== 'production' || publicTextRestriction(env)) {
    throw new Error('The active Worker is not configured for public production readings.');
  }

  const feature = getFeature(env, 'readings');
  let assignment = { policy: feature.policy, revision: 0 };
  if (configEnabled(env)) {
    const database = bindings.find(binding => binding.name === 'DB' && binding.type === 'd1');
    const target = config.d1_databases?.find(db => db.binding === 'DB');
    if (!database?.id || target?.database_id !== database.id) {
      throw new Error('The release database does not match the active production Worker binding.');
    }
    const response = await read(['d1', 'execute', 'DB', '--remote', '--command', latestReading], config);
    const statement = response?.[0];
    if (!statement?.success || !Array.isArray(statement.results) || statement.results.length > 1) {
      throw new Error('Cloudflare did not return the production Readings assignment.');
    }
    if (statement.results.length) {
      const row = statement.results[0];
      if (!Number.isSafeInteger(row.revision) || row.revision <= 0) throw new Error('Invalid production Readings revision.');
      assignment = resolveFeatureRevision(feature, row);
    }
  }
  return describeReleaseReading(env, assignment);
}

export async function readCloudflareReleaseSettings(config, { read = readWranglerJson, fetcher = fetch } = {}) {
  if (config.name !== 'tableau') throw new Error('Expected the Tableu production Worker for release QA.');
  const deployment = await read(['deployments', 'status', '--name', config.name], config);
  const versions = deployment?.versions;
  if (!Array.isArray(versions) || versions.some(v => !Number.isFinite(v?.percentage) || v.percentage < 0 || v.percentage > 100)
    || Math.abs(versions.reduce((sum, v) => sum + v.percentage, 0) - 100) > 0.00001) {
    throw new Error('Cloudflare did not return the production traffic allocation.');
  }
  const active = versions.filter(version => version.percentage > 0);
  let settings;
  for (const activeVersion of active) {
    const id = activeVersion.version_id;
    if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) throw new Error('Invalid active Worker version ID.');
    const version = await read(['versions', 'view', id, '--name', config.name], config);
    if (version.id !== id) throw new Error('Cloudflare returned a different Worker version.');
    const next = await versionSettings(config, version.resources?.bindings, read);
    if (settings && settings.fingerprint !== next.fingerprint) throw new Error('Active production versions have different Readings assignments.');
    settings = next;
  }

  const health = await fetcher(PRODUCTION_ORIGIN + '/api/health/tarot-reading', {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  const state = health.ok && await health.json();
  if (state?.status !== 'ok' || state.provider !== settings.providerId) {
    throw new Error('The live reading service is not serving the configured production primary.');
  }
  return settings;
}
