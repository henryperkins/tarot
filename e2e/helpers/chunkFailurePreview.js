import http from 'node:http';

// A local HTTP proxy preserves real browser module-cache behavior while the
// strict built-preview server remains the authoritative source of all assets.
export async function createChunkFailurePreview(baseURL) {
  const upstream = new URL(baseURL);
  if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(upstream.hostname)) {
    throw new Error('Chunk failure preview requires a local HTTP built preview');
  }
  let failed = 0;
  const server = http.createServer((request, response) => {
    if (!failed && /^\/assets\/readingSchema-[^/]+\.js(?:\?|$)/.test(request.url)) {
      failed += 1;
      response.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      response.end('Temporarily unavailable');
      return;
    }
    const forwarded = http.request(new URL(request.url, upstream), {
      method: request.method, headers: { ...request.headers, host: upstream.host }
    }, result => {
      response.writeHead(result.statusCode, result.headers);
      result.pipe(response);
    });
    forwarded.on('error', () => { response.writeHead(502); response.end('Local preview unavailable'); });
    response.on('close', () => forwarded.destroy());
    request.pipe(forwarded);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    failures: () => failed,
    async close() {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  };
}
