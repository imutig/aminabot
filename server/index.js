import { demarrerSite } from './static.js';
import { demarrerBot } from '../bot/index.js';

/* Le service unique : il sert le site ET tient la connexion au tchat.

   Deux services séparés seraient plus « propres », mais ça veut dire deux
   configurations, deux jeux de variables et deux déploiements à tenir - pour un
   bot qui parle à une seule chaîne, ça ne se justifie pas. */

const log = (m) => console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ${m}`);

demarrerSite({ onLog: log });

/* Le site ne doit jamais tomber parce que Twitch est mal configuré : on démarre
   le bot séparément et on se contente de signaler l'échec. Ça permet aussi de
   déployer le site avant d'avoir réglé les jetons. */
try {
  demarrerBot({ onLog: log }).catch((e) => {
    log(`⚠ bot non démarré : ${e.message}`);
    log('  Le site reste accessible. Vérifie les variables Twitch.');
  });
} catch (e) {
  log(`⚠ bot non démarré : ${e.message}`);
  log('  Le site reste accessible. Vérifie les variables Twitch.');
}
