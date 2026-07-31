// Minimal dependency-free static server for Playwright's `webServer`.
// The app ships with no build step, so tests just need the repo served as-is.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;

  // Keep requests inside the repo.
  const path = join(ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    // index.html does not exist until task 11. Serve a bare document so the
    // runner itself is verifiable before the app has any markup.
    if (requested === '/index.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end('<!doctype html><html><head><title>Farmer\'s Match</title></head><body></body></html>');
      return;
    }
    res.writeHead(404).end('Not Found');
  }
}).listen(PORT, () => {
  console.log(`serving ${ROOT} on http://localhost:${PORT}`);
});
