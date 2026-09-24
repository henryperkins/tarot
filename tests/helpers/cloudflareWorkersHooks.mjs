/** Node module hook: resolve `cloudflare:workers` to the local stub. */
const STUB_URL = new URL('./cloudflareWorkersStub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') {
    return { url: STUB_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
