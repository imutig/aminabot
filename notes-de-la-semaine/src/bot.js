import tmi from 'tmi.js';
import { config } from '../config.js';
// Partage avec Famille en or : un seul endroit gere le renouvellement du jeton.
import { creerGestionnaireJeton } from '../../bot/token.js';
import { texteChat } from '../../bot/texte.js';

const C = config.commandes;
const NOMBRE_SEUL = /^(10|[0-9])$/;

export function demarrerBot(session, { onLog, onChat, onChatSupprime } = {}) {
  const username = process.env.BOT_USERNAME;
  const oauth = process.env.BOT_OAUTH;
  const channel = process.env.CHANNEL;
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REFRESH_TOKEN } = process.env;

  if (!username || !channel) {
    throw new Error('Variables manquantes dans .env : BOT_USERNAME, CHANNEL');
  }
  /* Avec les trois variables Twitch, le jeton se renouvelle tout seul ; sinon on
     retombe sur BOT_OAUTH, qui expire en quelques heures. */
  const auto = Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET && TWITCH_REFRESH_TOKEN);
  if (!auto && !oauth) {
    throw new Error('Il faut soit BOT_OAUTH, soit TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET + TWITCH_REFRESH_TOKEN');
  }
  const prefixe = (t) => (t.startsWith('oauth:') ? t : `oauth:${t}`);

  const pilotes = new Set([
    channel.toLowerCase(),
    ...config.pilotes.map((p) => p.toLowerCase())
  ]);

  const client = new tmi.Client({
    options: { skipUpdatingEmotesets: true },
    connection: { reconnect: true, secure: true },
    identity: { username, password: 'oauth:a-renseigner' },
    channels: [channel]
  });

  const log = onLog || (() => {});
  const gestion = auto ? creerGestionnaireJeton({
    clientId: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_CLIENT_SECRET,
    refreshToken: TWITCH_REFRESH_TOKEN,
    onLog: log
  }) : null;
  let dernierEcho = 0;
  let vus = 0;
  let dernierAvert = 0;

  // Meme avertissement en boucle pendant une salve de votes : on n'en garde
  // qu'un toutes les 5 s pour ne pas noyer la console.
  const avertir = (msg) => {
    const now = Date.now();
    if (now - dernierAvert < 5000) return;
    dernierAvert = now;
    log('⚠ ' + msg);
  };

  // Repond dans le chat, mais jamais plus d'une fois toutes les 2s
  // (evite de se faire timeout par Twitch pendant les salves de votes).
  const dire = (msg) => {
    const now = Date.now();
    if (now - dernierEcho < 2000) return;
    dernierEcho = now;
    client.say(channel, msg).catch(() => {});
  };

  client.on('connected', (addr, port) => {
    log(`Bot connecte sur ${addr}:${port} - chaine #${channel}`);
  });

  client.on('message', (chan, tags, message, self) => {
    if (self) return;
    vus++;

    // Voir bot/texte.js : Twitch colle un caractere invisible aux doublons.
    const texte = texteChat(message);
    const bas = texte.toLowerCase();
    const userId = tags['user-id'] || tags.username;
    const nom = tags['display-name'] || tags.username;

    /* Tout le chat part vers l'overlay, commandes comprises : c'est un vrai
       chat a l'ecran, pas seulement les votes.

       Mais il part APRES traitement, avec la note reellement comptee. Avant,
       n'importe quel chiffre s'affichait comme un vote, meme quand il etait
       refuse (votes fermes sur le critere) : le spectateur voyait sa note
       validee a l'antenne alors qu'elle ne comptait pas. */
    let voteCompte = null;
    const versOverlay = () => {
      if (!onChat) return;
      onChat({
        id: tags.id || String(Date.now()) + Math.random(),
        userId,
        name: nom,
        texte: texte.slice(0, 120),
        vote: voteCompte
      });
    };
    const estPilote =
      tags.badges?.broadcaster === '1' ||
      tags.mod === true ||
      pilotes.has((tags.username || '').toLowerCase());

    // ---- Commandes de pilotage ----
    if (estPilote) {
      const [cmd, ...args] = bas.split(/\s+/);

      if (C.start.includes(cmd)) {
        session.start();
        dire("C'est parti pour les notes de la semaine ! Notez VOTRE semaine : tapez un chiffre de 0 a 10.");
        log('▶ Segment demarre');
        versOverlay(); return;
      }
      if (C.stop.includes(cmd)) { session.stop(); log('■ Segment arrete'); versOverlay(); return; }
      if (C.reset.includes(cmd)) { session.reset(); log('↺ Segment remis a zero'); versOverlay(); return; }
      if (C.next.includes(cmd)) { session.suivant(); log('→ Etape suivante'); versOverlay(); return; }
      if (C.prev.includes(cmd)) { session.precedent(); log('← Etape precedente'); versOverlay(); return; }
      if (C.note.includes(cmd)) {
        if (session.noterAmina(args[0])) log(`✓ Note d'Amina : ${args[0]}`);
        versOverlay(); return;
      }
      // Chiffre seul tape par la streameuse = sa note (si un critere est ouvert).
      if (config.chiffreSeulPourAmina && NOMBRE_SEUL.test(texte) && session.activeIndex >= 0) {
        if (session.noterAmina(texte)) { log(`✓ Note d'Amina : ${texte}`); versOverlay(); return; }
      }
      // Sinon on laisse passer : un pilote peut aussi voter comme un viewer.
    }

    // ---- Vote d'un viewer ----
    if (NOMBRE_SEUL.test(texte)) {
      if (session.voter(userId, nom, texte)) {
        voteCompte = Number(texte);
        log(`vote · ${nom} → ${texte}`);
      } else {
        // Un chiffre a ete tape mais il n'a pas ete pris : dire pourquoi,
        // sinon on croit que le bot ne lit pas le chat.
        const raison = !session.actif ? 'segment pas lance'
          : session.activeIndex < 0 ? 'aucun critere ouvert'
          : 'votes fermes sur ce critere';
        avertir(`chiffre de ${nom} ignore (${raison})`);
      }
    }

    versOverlay();
  });

  // Bilan periodique : la preuve que le bot lit bien le chat, meme quand
  // aucun segment ne tourne.
  setInterval(() => {
    if (!vus) return;
    log(`chat lu : ${vus} message${vus > 1 ? 's' : ''} sur les 60 dernieres secondes`);
    vus = 0;
  }, 60000);

  // Moderation : un message supprime ou un viewer sanctionne doit disparaitre
  // de l'overlay aussi, sinon il reste affiche a l'antenne apres la moderation.
  if (onChatSupprime) {
    client.on('messagedeleted', (chan, user, msg, state) => {
      onChatSupprime({ id: state?.['target-msg-id'] });
    });
    client.on('timeout', (chan, user) => onChatSupprime({ name: user }));
    client.on('ban', (chan, user) => onChatSupprime({ name: user }));
    client.on('clearchat', () => onChatSupprime({ tout: true }));
  }

  // Twitch refuse l'authentification : jeton mort ou revoque, on en redemande un.
  client.on('disconnected', async (raison) => {
    if (!gestion || !/login|authentication|unsuccessful/i.test(String(raison))) return;
    log(`⚠ authentification refusée (${raison}) - renouvellement du jeton`);
    try {
      client.opts.identity.password = prefixe(await gestion.jeton(true));
    } catch (e) {
      log(`⚠ renouvellement impossible : ${e.message}`);
    }
  });

  (async () => {
    try {
      client.opts.identity.password = gestion ? prefixe(await gestion.jeton()) : prefixe(oauth);
    } catch (e) {
      log(`⚠ impossible d'obtenir un jeton Twitch : ${e.message}`);
      return;
    }
    if (gestion) {
      gestion.demarrerBoucle((t) => { client.opts.identity.password = prefixe(t); });
      log('renouvellement automatique du jeton : activé');
    } else {
      log('⚠ jeton fixe : il expirera dans quelques heures');
    }
    client.connect().catch((e) => log(`Connexion Twitch impossible : ${e}`));
  })();

  return { client, dire };
}
