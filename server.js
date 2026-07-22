import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let reqPath = decodeURIComponent(urlPath);

  // Redirect root / to /landing/ so relative paths in landing/index.html resolve correctly
  if (reqPath === '/') {
    res.statusCode = 302;
    res.setHeader('Location', '/landing/');
    res.end();
    console.log(`[302 Redirect] ${req.url} -> /landing/`);
    return;
  }

  let filePath = path.normalize(path.join(__dirname, reqPath));

  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('403 Forbidden');
    console.log(`[403 Forbidden] ${req.url} -> ${filePath}`);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      console.log(`[404 Not Found] ${req.url} -> ${filePath}`);
      return;
    }

    if (stats.isDirectory()) {
      if (!urlPath.endsWith('/')) {
        res.statusCode = 302;
        res.setHeader('Location', urlPath + '/');
        res.end();
        console.log(`[302 Redirect] ${req.url} -> ${urlPath}/`);
        return;
      }
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      console.log(`[404 Stream Error] ${req.url} -> ${filePath}`, streamErr);
    });
    stream.pipe(res);
    console.log(`[200 OK] ${req.url} (${contentType})`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Redaura dev server running at http://localhost:${PORT}/ and http://127.0.0.1:${PORT}/`);
});
