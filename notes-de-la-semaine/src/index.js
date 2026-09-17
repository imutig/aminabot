import { Session } from './session.js';
import { demarrerServeur } from './server.js';
import { demarrerBot } from './bot.js';
import { demarrerDemo } from './demo.js';
import { config } from '../config.js';

const DEMO = process.argv.includes('--demo');
const log = (m) => console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ${m}`);

const session = new Session();
const serveur = demarrerServeur(session, { onLog: log });

if (DEMO) {
  log('MODE DEMO — aucun Twitch, le chat et les votes sont simules.');
  demarrerDemo(session, { onLog: log, onChat: serveur.chat });
} else {
  try {
    demarrerBot(session, {
      onLog: log,
      onChat: serveur.chat,
      onChatSupprime: serveur.chatSupprime
    });
  } catch (e) {
    log(`⚠ ${e.message}`);
    log('Le serveur tourne quand meme : tu peux ouvrir l\'overlay et utiliser la regie.');
  }
}

log(`Ajoute cette URL en Browser Source dans OBS (1920x1080) :`);
log(`   http://localhost:${config.port}`);
