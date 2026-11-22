import { validateCodexModelList } from '../../shared/inference/codexSubscription.js';
import { ConfigError } from './aiConfigCatalog.js';
import { ensureCodexSubscriptionConfig } from './codexSubscription.js';
import { readFeatureJsonBody } from './featureUsage.js';

export async function fetchCodexSubscriptionModels(env, signal) {
  let gateway;
  try {
    gateway = ensureCodexSubscriptionConfig(env);
  } catch {
    throw new ConfigError(503, 'subscription_gateway_unconfigured', 'Configure the ChatGPT subscription gateway URL and token to fetch models.');
  }
  const url = new URL(gateway.url);
  url.pathname = url.pathname.replace(/\/v1\/generate$/, '/v1/models');
  const timeout = AbortSignal.timeout(Math.min(gateway.timeoutMs, 20000));
  try {
    const response = await fetch(url, {
      headers: { Authorization: 'Bearer ' + gateway.token, Accept: 'application/json' },
      redirect: 'manual', signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) throw new ConfigError(503, 'subscription_catalog_unsupported', 'Update the ChatGPT subscription gateway to a version that supports fetching models.');
      if (response.status === 429) throw new ConfigError(429, 'subscription_gateway_busy', 'The ChatGPT subscription gateway is busy. Try again shortly.');
      throw new Error('Gateway unavailable');
    }
    return validateCodexModelList(await readFeatureJsonBody(response, 128 * 1024));
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(503, 'subscription_catalog_unavailable', 'Could not fetch ChatGPT subscription models. Check the gateway connection and sign-in, then try again.');
  }
}
