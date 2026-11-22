const hexKey = /^[a-f\d]{64}$/i;

export function hasConnectionKeySource(env) {
  if (env.AI_CONNECTIONS_ENCRYPTION_KEY !== undefined) {
    return typeof env.AI_CONNECTIONS_ENCRYPTION_KEY === 'string' && hexKey.test(env.AI_CONNECTIONS_ENCRYPTION_KEY);
  }
  return typeof env.PROVIDER_CREDENTIAL_KEYS?.idFromName === 'function'
    && typeof env.PROVIDER_CREDENTIAL_KEYS?.get === 'function';
}

export async function loadConnectionKey(env) {
  if (!hasConnectionKeySource(env)) throw new Error('Provider credential key unavailable.');
  let key;
  if (env.AI_CONNECTIONS_ENCRYPTION_KEY !== undefined) {
    key = Uint8Array.from(env.AI_CONNECTIONS_ENCRYPTION_KEY.match(/../g), pair => parseInt(pair, 16));
  } else {
    const namespace = env.PROVIDER_CREDENTIAL_KEYS;
    const id = namespace.idFromName(env.AI_CONFIG_ENVIRONMENT);
    const response = await namespace.get(id).fetch('https://credential-keys.internal/encryption-key', { method: 'POST' });
    if (!response.ok) throw new Error('Provider credential key unavailable.');
    key = new Uint8Array(await response.arrayBuffer());
  }
  if (key.length !== 32) throw new Error('Provider credential key unavailable.');
  return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
