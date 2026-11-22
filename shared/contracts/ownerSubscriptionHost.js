const hostNames = new Map([
  ['codex-subscription', 'OWNER_HOST_CODEX_URL'],
  ['claude-code', 'OWNER_HOST_CLAUDE_URL']
]);

export function ownerHostUrlBinding(provider) {
  const name = hostNames.get(provider);
  if (!name) throw new Error('Unknown owner subscription.');
  return name;
}

// The two listeners are private to a single dev run. This secret never enters
// browser setup links, gateway URLs, process arguments or a model process.
export async function ownerGatewayToken(secret, instance, provider) {
  ownerHostUrlBinding(provider);
  if (typeof secret !== 'string' || secret.length < 32 || !/^[a-f0-9-]{36}$/.test(instance)) {
    throw new Error('Local subscription host is unavailable.');
  }
  const encoder = new globalThis.TextEncoder();
  const key = await globalThis.crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode('tableu/owner-gateway/v1/' + instance + '/' + provider));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
