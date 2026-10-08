import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const filename = process.argv[2] || 'star-reading-motion.html';
const allowedFiles = new Set(['star-reading-motion.html', 'reading-with-you.html']);
if (!allowedFiles.has(filename)) {
  throw new Error('Choose star-reading-motion.html or reading-with-you.html.');
}

const port = Number(process.argv[3] || 4320);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('The preview port must be an integer between 1 and 65535.');
}

const fragment = readFileSync(new URL(filename, import.meta.url), 'utf8');
const title = filename === 'star-reading-motion.html'
  ? 'Tableu — reading imagery motion study'
  : 'Tableu — superseded reading exploration';
const document = `<!doctype html>
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

const server = createServer((request, response) => {
  if (request.url !== '/') {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(document);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`${title}: http://127.0.0.1:${port}/`);
});
