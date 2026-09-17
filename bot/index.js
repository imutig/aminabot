import tmi from 'tmi.js';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import { creerGestionnaireJeton } from './token.js';

/* La connexion au tchat Twitch. Volontairement bete : elle ne connait aucune
   regle de jeu, elle relaie. Toute la logique (detection des reponses, points)
   vit dans les mutations Convex, pour qu'il n'y ait qu'un endroit ou elle change.

   Exporte une fonction plutot que de s'executer a l'import : le meme code sert
   au processus autonome (`npm run bot`) et au service unique qui heberge aussi
   le site. */

/* Rejoindre la partie.

   Large volontairement. Twitch REFUSE deux messages identiques d'affilee du
   meme utilisateur (filtre anti-spam, environ 30 s) : le second est avale sans
   erreur et le bot ne le voit jamais. En testant, on tape « moi » plusieurs
   fois de suite et un essai sur deux semble ignore. Accepter des variantes
   (« moi !! », « moiii », « je joue », « !join ») permet de varier le texte et
   de contourner ce filtre. */
const REJOINDRE = /^\s*!?\s*(m+o+i+|je\s+joue|jou?e|join)\s*[!.?…♥❤~\s]*$/i;

const prefixe = (t) => (t.startsWith('oauth:') ? t : `oauth:${t}`);

export function demarrerBot({ onLog } = {}) {
  const log = onLog || ((m) => console.log(`[${new Date().toLocaleTimeString('fr-FR')}] ${m}`));

  const URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  const {
    BOT_USERNAME, BOT_OAUTH, CHANNEL,
    TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_REFRESH_TOKEN
  } = process.env;

  if (!URL) throw new Error("CONVEX_URL manquante - lance `npx convex deploy` puis reporte l'URL");
  if (!BOT_USERNAME || !CHANNEL) throw new Error('Variables manquantes : BOT_USERNAME, CHANNEL');

  /* Deux façons de s'authentifier :
     - avec CLIENT_ID + CLIENT_SECRET + REFRESH_TOKEN, le bot renouvelle son
       acces tout seul et tient indefiniment ;
     - sinon on retombe sur BOT_OAUTH, un jeton fixe qui expirera en quelques
       heures. Pratique pour un test, intenable pour un bot heberge. */
  const auto = Boolean(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET && TWITCH_REFRESH_TOKEN);
  if (!auto && !BOT_OAUTH) {
    throw new Error('Il faut soit BOT_OAUTH, soit TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET + TWITCH_REFRESH_TOKEN');
  }

  const convex = new ConvexHttpClient(URL);
  const gestion = auto ? creerGestionnaireJeton({
    clientId: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_CLIENT_SECRET,
    refreshToken: TWITCH_REFRESH_TOKEN,
    onLog: log
  }) : null;

  const client = new tmi.Client({
    options: { skipUpdatingEmotesets: true },
    connection: { reconnect: true, secure: true },
    identity: { username: BOT_USERNAME, password: 'oauth:a-renseigner' },
    channels: [CHANNEL]
  });

  let vus = 0;
  let premier = true;

  client.on('connected', (addr, port) => {
    log(`Bot connecté sur ${addr}:${port} - chaîne #${CHANNEL}`);
    log(`Convex : ${URL}`);
    log('Pour vérifier : ouvre une partie, puis tape « moi » dans le tchat.');
  });

  client.on('message', async (chan, tags, message, self) => {
    if (self) return;
    vus++;
    if (premier) { premier = false; log('✓ premier message reçu - la lecture du tchat fonctionne'); }

    const texte = message.trim();
    const twitchId = tags['user-id'] || tags.username;
    const pseudo = tags['display-name'] || tags.username;

    try {
      if (REJOINDRE.test(texte)) {
        const id = await convex.mutation(api.joueurs.rejoindre, { twitchId, pseudo });
        if (id) log(`+ ${pseudo} rejoint la partie`);
        return;
      }
      // Tout le reste part quand meme : le panneau tchat affiche la conversation,
      // et c'est la mutation qui decide si le message contient une reponse.
      const r = await convex.mutation(api.jeu.message, { twitchId, pseudo, texte });
      if (r?.effet === 'trouve') log(`★ ${pseudo} trouve la réponse ${r.caseIndex + 1}`);
    } catch (e) {
      log(`erreur Convex : ${e.message}`);
    }
  });

  /* Twitch a refuse l'authentification : le jeton est mort ou revoque. On en
     redemande un de force avant que tmi ne retente sa reconnexion automatique,
     sinon il rejouerait indefiniment le meme jeton invalide. */
  client.on('disconnected', async (raison) => {
    if (!gestion || !/login|authentication|unsuccessful/i.test(String(raison))) return;
    log(`⚠ authentification refusée (${raison}) - renouvellement du jeton`);
    try {
      client.opts.identity.password = prefixe(await gestion.jeton(true));
      log('nouveau jeton en place, reconnexion…');
    } catch (e) {
      log(`⚠ renouvellement impossible : ${e.message}`);
    }
  });

  // Preuve que le bot lit bien le tchat, meme quand aucune partie ne tourne.
  setInterval(() => {
    if (!vus) return;
    log(`tchat lu : ${vus} message${vus > 1 ? 's' : ''} sur les 60 dernières secondes`);
    vus = 0;
  }, 60000).unref?.();

  return (async () => {
    client.opts.identity.password = gestion ? prefixe(await gestion.jeton()) : prefixe(BOT_OAUTH);

    if (gestion) {
      // Le renouvellement ne coupe pas la connexion en cours : il prepare
      // seulement le jeton que tmi utilisera a sa prochaine reconnexion.
      gestion.demarrerBoucle((t) => { client.opts.identity.password = prefixe(t); });
      log('renouvellement automatique du jeton : activé');
    } else {
      log('⚠ jeton fixe : il expirera dans quelques heures (voir DEPLOIEMENT.md)');
    }

    await client.connect();
    return client;
  })();
}
