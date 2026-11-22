// Internal binding only. Its storage is separate from the D1 database that
// holds ciphertext. Each environment names its own object.
export class ProviderCredentialKeys {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/encryption-key') {
      return new Response(null, { status: 404 });
    }
    const key = await this.storage.transaction(async tx => {
      let bytes = await tx.get('aes-gcm-v1');
      if (!bytes) {
        bytes = crypto.getRandomValues(new Uint8Array(32));
        await tx.put('aes-gcm-v1', bytes);
      }
      return bytes;
    });
    return new Response(key, { headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/octet-stream' } });
  }
}
