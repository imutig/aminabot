import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(__dirname, '..', 'overlay');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml'
};

// Identifiant unique de ce demarrage. Les pages deja ouvertes le comparent au
// leur et se rechargent si le serveur a redemarre : sinon une page chargee avec
// l'ancien code reste connectee, ne comprend plus les messages, et donne
// l'impression que la telecommande ne fait rien.
const INSTANCE = Math.random().toString(36).slice(2, 10);

export function demarrerServeur(session, { onLog } = {}) {
  const log = onLog || (() => {});

  const serveur = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let rel = url.pathname === '/' ? '/index.html'
      : /^\/control\/?$/.test(url.pathname) ? '/control.html'
      : url.pathname;
    const fichier = path.join(RACINE, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

    if (!fichier.startsWith(RACINE)) { res.writeHead(403).end(); return; }

    fs.readFile(fichier, (err, data) => {
      if (err) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(fichier)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server: serveur });
  const clients = new Set();

  const envoyer = (ws, msg) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const diffuser = (msg) => {
    const s = JSON.stringify(msg);
    for (const ws of clients) if (ws.readyState === 1) ws.send(s);
  };

  wss.on('connection', (ws) => {
    clients.add(ws);
    log(`Overlay connecte (${clients.size} actif${clients.size > 1 ? 's' : ''})`);
    envoyer(ws, {
      t: 'hello',
      instance: INSTANCE,
      reglages: {
        camSide: config.camSide,
        camPlaceholder: config.camPlaceholder,
        aminaName: config.aminaName,
        defilementMaxSec: config.defilementMaxSec
      },
      criteres: session.criteres,
      etapes: session.etapes,
      etat: session.snapshot()
    });
    ws.on('close', () => { clients.delete(ws); });
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'etat?') { envoyer(ws, { t: 'etat', etat: session.snapshot() }); return; }
      if (m.t !== 'cmd') return;
      if (m.act === 'criteres') {
        const r = session.definirCriteres(m.liste);
        if (!r.ok) envoyer(ws, { t: 'refus', raison: r.raison });
        return;
      }
      // Telecommande /control, boutons de la regie, raccourcis clavier :
      // tout passe par ici. Aucune autre source ne fait avancer la sequence.
      switch (m.act) {
        case 'start': session.start(); break;
        case 'stop': session.stop(); break;
        case 'reset': session.reset(); break;
        case 'suivant': session.suivant(); break;
        case 'precedent': session.precedent(); break;
        case 'aller': session.allerA(m.pas); break;
        case 'note': session.noterAmina(m.value); break;
        case 'annuler-note': session.annulerNote(); break;
      }
    });
  });

  // ---- Relais session -> overlays ----
  // Les tallies sont throttles : le chat peut envoyer 50 votes/seconde,
  // l'overlay n'a besoin que d'environ 8 mises a jour par seconde.
  let enAttente = null;
  let votants = [];
  let dernierEnvoi = 0;
  const vider = () => {
    dernierEnvoi = Date.now();
    // Le feed n'affiche que 5 lignes : inutile d'en envoyer 40 par salve.
    diffuser({ t: 'tally', ...enAttente, votants: votants.slice(-6) });
    enAttente = null;
    votants = [];
  };
  const envoyerTally = (tally, votant) => {
    enAttente = tally;
    // Les corrections partent aussi : quand on retape une note, c'est
    // justement la qu'on doute d'avoir ete pris en compte.
    if (votant) votants.push({ name: votant.name, note: votant.note });
    const delta = Date.now() - dernierEnvoi;
    if (delta >= 120) { vider(); return; }
    if (!envoyerTally.timer) {
      envoyerTally.timer = setTimeout(() => {
        envoyerTally.timer = null;
        if (enAttente) vider();
      }, 120 - delta);
    }
  };

  session.on('etape', (d) => diffuser({ t: 'etape', weekLabel: session.weekLabel, ...d }));
  session.on('criteres', (d) => diffuser({ t: 'criteres', ...d }));
  session.on('etat', () => diffuser({ t: 'etat', etat: session.snapshot() }));
  session.on('vote', (d) => envoyerTally(d.tally, d.votant));
  session.on('amina', (d) => diffuser({ t: 'amina', ...d }));
  session.on('amina-annulee', (d) => diffuser({ t: 'amina-annulee', ...d }));

  // ---- Chat -> overlay ----
  // Groupe par paquets de 200 ms : un chat qui s'emballe ne doit pas envoyer
  // un message WebSocket par ligne.
  let lot = [];
  let minuteurChat = null;
  const chat = (msg) => {
    lot.push(msg);
    if (lot.length > 40) lot = lot.slice(-40);
    if (minuteurChat) return;
    minuteurChat = setTimeout(() => {
      minuteurChat = null;
      if (!lot.length) return;
      diffuser({ t: 'chat', messages: lot });
      lot = [];
    }, 200);
  };
  const chatSupprime = (quoi) => diffuser({ t: 'chat-suppr', ...quoi });

  serveur.listen(config.port, () => {
    log(`Overlay disponible sur http://localhost:${config.port}`);
  });

  return { serveur, diffuser, chat, chatSupprime };
}
