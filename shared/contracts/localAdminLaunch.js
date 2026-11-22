export const isLocalLaunchChallenge = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function localLaunchProof(token, challenge) {
  const encoder = new globalThis.TextEncoder();
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', encoder.encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await subtle.sign('HMAC', key, encoder.encode('tableu/local-admin/first-launch/v1:' + challenge));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}
