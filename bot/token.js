import fs from 'node:fs';
import path from 'node:path';

/* Renouvellement du jeton Twitch.

   Un jeton d'acces expire au bout de quelques heures. Sur un bot heberge en
   permanence, ca veut dire qu'il cesse de lire le tchat sans prevenir. On
   echange donc le refresh token contre un nouvel acces avant l'echeance.

   Note : une connexion IRC deja ouverte reste valable meme apres expiration du
   jeton qui l'a etablie. Le renouvellement ne sert qu'aux (re)connexions -
   inutile de couper la connexion en cours pour l'appliquer. */

const ENDPOINT = 'https://id.twitch.tv/oauth2/token';
const MARGE_MS = 15 * 60 * 1000;   // on renouvelle 15 min avant l'echeance

// Twitch peut renvoyer un nouveau refresh token. On le garde sur disque pour
// survivre a un redemarrage ; sur un hebergeur au disque ephemere ca ne tient
// que jusqu'au prochain deploiement, d'ou le repli sur la variable d'env.
const FICHIER = path.join(process.cwd(), '.twitch-refresh');

export function creerGestionnaireJeton({ clientId, clientSecret, refreshToken, onLog }) {
  const log = onLog || (() => {});
  let refresh = lireDisque() || refreshToken;
  let acces = null;
  let expireA = 0;
  let enCours = null;

  function lireDisque() {
    try { return fs.readFileSync(FICHIER, 'utf8').trim() || null; } catch { return null; }
  }
  function ecrireDisque(v) {
    try { fs.writeFileSync(FICHIER, v, 'utf8'); } catch { /* disque en lecture seule : tant pis */ }
  }

  async function echanger() {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(`Twitch a refuse le renouvellement (${r.status}) : ${d.message || JSON.stringify(d)}`);
    }
    acces = d.access_token;
    expireA = Date.now() + (Number(d.expires_in) || 14400) * 1000;
    if (d.refresh_token && d.refresh_token !== refresh) {
      refresh = d.refresh_token;
      ecrireDisque(refresh);
      log('refresh token renouvelé par Twitch, conservé');
    }
    const dans = Math.round((expireA - Date.now()) / 60000);
    log(`jeton renouvelé - valable ${dans} min`);
    return acces;
  }

  /* `force` sert quand Twitch a refuse la connexion : le jeton en memoire est
     peut-etre encore « valide » selon notre horloge mais revoque cote Twitch. */
  async function jeton(force = false) {
    if (!force && acces && Date.now() < expireA - MARGE_MS) return acces;
    // Un seul echange a la fois, meme si plusieurs appels arrivent ensemble.
    if (!enCours) enCours = echanger().finally(() => { enCours = null; });
    return await enCours;
  }

  return {
    jeton,
    // Programme le prochain renouvellement juste avant l'echeance.
    demarrerBoucle(surRenouvellement) {
      const planifier = () => {
        const attente = Math.max(60_000, expireA - Date.now() - MARGE_MS);
        setTimeout(async () => {
          try {
            const t = await jeton(true);
            surRenouvellement?.(t);
          } catch (e) {
            log(`⚠ ${e.message}`);
          }
          planifier();
        }, attente).unref?.();
      };
      planifier();
    }
  };
}
