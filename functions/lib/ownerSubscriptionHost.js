import { ownerGatewayToken, ownerHostUrlBinding } from '../../shared/contracts/ownerSubscriptionHost.js';

export async function withOwnerHostGateway(env, provider) {
  const value = env[ownerHostUrlBinding(provider)];
  if (env.AI_CONFIG_ENVIRONMENT !== 'local' || typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(value)) {
    throw new Error('Local subscription host is unavailable.');
  }
  const token = await ownerGatewayToken(env.LOCAL_OWNER_HOST_SECRET, env.OWNER_HOST_INSTANCE, provider);
  const prefix = provider === 'codex-subscription' ? 'CODEX_SUBSCRIPTION' : 'CLAUDE_CODE';
  return { ...env, [prefix + '_GATEWAY_URL']: value, [prefix + '_GATEWAY_TOKEN']: token };
}

export async function getOwnerHostStatus(env, provider) {
  try {
    const effective = await withOwnerHostGateway(env, provider);
    const prefix = provider === 'codex-subscription' ? 'CODEX_SUBSCRIPTION' : 'CLAUDE_CODE';
    const result = await fetch(effective[prefix + '_GATEWAY_URL'] + '/v1/subscription-status', {
      headers: { Authorization: 'Bearer ' + effective[prefix + '_GATEWAY_TOKEN'] },
      signal: AbortSignal.timeout(12000), redirect: 'manual'
    });
    if (result.ok) {
      const body = await result.json();
      if (body.provider === provider && body.ready === true) return { ready: true };
      if (body.provider === provider && body.ready === false) {
        const login = provider === 'codex-subscription' ? 'Run codex login on this computer and choose ChatGPT.' : 'Run claude auth login on this computer and choose your Claude subscription.';
        const why = body.reason === 'login_required' ? login
          : body.reason === 'unsupported_version' ? 'The installed CLI version is unsupported.'
          : 'The subscription CLI is unavailable on the local host.';
        return { ready: false, reason: why };
      }
    }
  } catch { /* Never expose gateway URLs, token or CLI diagnostics. */ }
  return { ready: false, reason: 'The local subscription gateway is unavailable. Start the Tableu dev server.' };
}
