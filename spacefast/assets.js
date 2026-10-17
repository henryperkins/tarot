// Exact files are served by Spacefast before dispatching the Worker. The
// remaining asset requests must not turn into the application's HTML shell.
const ASSET_EXTENSION = /\.(?:css|js|mjs|cjs|map|json|xml|txt|html|png|jpe?g|gif|webp|avif|svg|ico|heic|woff2?|ttf|otf|eot|pdf|zip|gz|wasm|mp[34]|m4a|webm|ogg|wav|csv|webmanifest)$/i;

export function createShellAssets(html) {
  return {
    async fetch(input) {
      const request = input instanceof Request ? input : new Request(input);
      const { pathname } = new URL(request.url);
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
      }
      if (pathname !== '/index.html' && ASSET_EXTENSION.test(pathname)) {
        return new Response(request.method === 'HEAD' ? null : 'Not found', { status: 404 });
      }
      return new Response(request.method === 'HEAD' ? null : html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
  };
}
