import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const filename = process.argv[2] || 'star-reading-motion.html';
const allowedFiles = new Set(['star-reading-motion.html', 'reading-with-you.html', 'personalized-reading-gestures.html']);
if (!allowedFiles.has(filename)) {
  throw new Error(`Choose one of: ${[...allowedFiles].join(', ')}.`);
}

const port = Number(process.argv[3] || 4320);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('The preview port must be an integer between 1 and 65535.');
}

const title = filename === 'personalized-reading-gestures.html'
  ? 'Tableu — personalized reading gestures'
  : filename === 'star-reading-motion.html'
  ? 'Tableu — reading imagery motion study'
  : 'Tableu — superseded reading exploration';
const renderDocument = (fragment) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:,">
  <title>${title}</title>
  <style>
    html { color-scheme: light dark; background: light-dark(#fffcf7, #1c1a22); }
    body { margin: 0; padding: 16px; }
    .cursor-interaction { cursor: pointer; }
  </style>
</head>
<body>${fragment}</body>
</html>`;

const vectorAssetPath = /^\/assets\/rws-immanuelle\/(?:major-(?:0\d|1\d|2[01])-[a-z-]{1,48}|(?:cups|pentacles|swords|wands)-(?:0[1-9]|1[0-4])|back)\.svg$/;
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  // Match the raw path: encoded separators and traversal are never decoded into files.
  const pathname = request.url?.split('?')[0];
  const isVectorAsset = vectorAssetPath.test(pathname);
  if (pathname !== '/' && !isVectorAsset) {
    response.writeHead(404, headers);
    response.end(request.method === 'HEAD' ? undefined : 'Not found');
    return;
  }

  try {
    const body = isVectorAsset
      ? readFileSync(new URL(`.${pathname}`, import.meta.url))
      : Buffer.from(renderDocument(readFileSync(new URL(filename, import.meta.url), 'utf8')));
    response.writeHead(200, {
      ...headers,
      'Content-Type': isVectorAsset ? 'image/svg+xml; charset=utf-8' : 'text/html; charset=utf-8',
      'Content-Length': body.length
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status, headers);
    response.end(request.method === 'HEAD' ? undefined : status === 404 ? 'Not found' : 'Unable to load preview');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`${title}: http://127.0.0.1:${port}/`);
});
