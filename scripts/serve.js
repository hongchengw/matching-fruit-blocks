// Minimal dependency-free static server for Playwright's `webServer`.
// The app ships with no build step, so tests just need the repo served as-is.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 4173;

// Loopback only. This server hands out any file under the repo, including
// .git, so it has no business listening on a LAN-visible interface.
const HOST = '127.0.0.1';

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

  // Decode before normalizing, or %2e%2e%2f walks straight past the guard
  // below as an opaque filename that path.normalize has no opinion about.
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('Bad Request');
    return;
  }

  const requested = decoded === '/' ? '/index.html' : decoded;

  // Keep requests inside the repo. The trailing separator matters: a bare
  // prefix test also accepts a sibling directory whose name starts with ours.
  const path = join(ROOT, normalize(requested).replace(/^(\.\.[/\\])+/, ''));
  if (path !== ROOT && !path.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  // No dotfiles. .git alone would hand over the whole history. Only the part
  // below ROOT is inspected, since the checkout itself may well sit under a
  // dotted directory and that is none of our business.
  const relative = path.slice(ROOT.length);
  if (relative.split(sep).some((segment) => segment.startsWith('.'))) {
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
}).listen(PORT, HOST, () => {
  console.log(`serving ${ROOT} on http://${HOST}:${PORT}`);
});
