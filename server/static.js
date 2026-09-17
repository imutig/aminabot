import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Sert le site construit (dist/). Volontairement sans dependance : ce service
   n'a rien a faire d'autre que rendre quatre fichiers statiques. */

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

export function demarrerSite({ onLog } = {}) {
  const log = onLog || console.log;
  return creerServeur().listen(PORT, () => log(`Site servi sur le port ${PORT}`));
}

function creerServeur() {
  return http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let rel = url.pathname;
  if (rel === '/') rel = '/index.html';
  // /prep et /prep/ pointent sur la page de preparation.
  else if (/^\/prep\/?$/.test(rel)) rel = '/prep.html';

  const fichier = path.join(RACINE, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!fichier.startsWith(RACINE)) { res.writeHead(403).end(); return; }

  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(fichier);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // Les pages ne sont jamais mises en cache : une source OBS deja ouverte
      // doit prendre la nouvelle version au rafraichissement.
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable'
    });
      res.end(data);
    });
  });
}
