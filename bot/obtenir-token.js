import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FICHIER_ENV = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

/* Ecrit la valeur dans .env, en remplacant la ligne existante.

   Le script ecrit lui-meme plutot que d'afficher a recopier : un jeton recopie
   a la main depuis un terminal perd facilement un caractere, et Twitch repond
   alors « Invalid refresh token » sans dire que la valeur est tronquee. */
function ecrireDansEnv(cles) {
  let lignes = [];
  try { lignes = fs.readFileSync(FICHIER_ENV, 'utf8').split(/\r?\n/); } catch { /* fichier neuf */ }
  for (const [k, v] of Object.entries(cles)) {
    const i = lignes.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lignes[i] = `${k}=${v}`;
    else lignes.push(`${k}=${v}`);
  }
  fs.writeFileSync(FICHIER_ENV, lignes.join('\n').replace(/\n+$/, '') + '\n', 'utf8');
}

/* Obtient un refresh token Twitch pour TON application.

   A lancer une seule fois, en local :
     node bot/obtenir-token.js

   Prerequis - creer ton application sur https://dev.twitch.tv/console/apps :
     · URL de redirection OAuth : http://localhost:3000
       (en entier, avec http:// - Twitch refuse « localhost:3000 » tout court)
     · Type de client : Confidentiel
       (« Publique » ne donne pas de Client Secret, donc pas de renouvellement)
   Puis relever le Client ID et le Client Secret. */

const PORT = 3000;
const REDIRECTION = `http://localhost:${PORT}`;
const PORTEE = 'chat:read chat:edit';

const { TWITCH_CLIENT_ID: ID, TWITCH_CLIENT_SECRET: SECRET } = process.env;

if (!ID || !SECRET) {
  console.error(`
  Il manque les identifiants de ton application Twitch.

  1. Crée-la sur https://dev.twitch.tv/console/apps
       URL de redirection OAuth : ${REDIRECTION}   (en entier, avec http://)
       Type de client           : Confidentiel     (sinon pas de Client Secret)

  2. Relance avec :

       TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy npm run token

  3. Connecte-toi avec le compte du BOT, pas ton compte principal.
`);
  process.exit(1);
}

/* Verifie le format AVANT d'ouvrir le navigateur. Sans ca, on decouvre le
   probleme apres l'autorisation Twitch, sur un « invalid client secret » qui
   ne dit pas d'ou il vient. Un secret Twitch fait 30 caracteres, minuscules
   et chiffres uniquement. */
const souci = (nom, v) => {
  if (v === 'COLLE_ICI_TON_SECRET' || v === 'COLLE_ICI_TON_ID') {
    return `${nom} contient encore le texte de remplacement - le .env n'a pas été enregistré`;
  }
  if (/^["']|["']$/.test(v)) return `${nom} est entouré de guillemets, retire-les`;
  if (/\s/.test(v)) return `${nom} contient une espace ou un retour à la ligne`;
  if (!/^[a-z0-9]{30}$/.test(v)) {
    return `${nom} fait ${v.length} caractères (attendu 30, minuscules et chiffres)`;
  }
  return null;
};

const probleme = souci('TWITCH_CLIENT_ID', ID) || souci('TWITCH_CLIENT_SECRET', SECRET);
if (probleme) {
  console.error(`
  ⚠ ${probleme}

  Ouvre le fichier .env, corrige la ligne, ENREGISTRE, puis relance :

     npm run token
`);
  process.exit(1);
}

const lien = 'https://id.twitch.tv/oauth2/authorize?' + new URLSearchParams({
  client_id: ID,
  redirect_uri: REDIRECTION,
  response_type: 'code',
  scope: PORTEE,
  force_verify: 'true'
});

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECTION);
  const code = url.searchParams.get('code');

  /* Pas encore de code : on renvoie vers Twitch nous-memes.

     C'est la raison d'etre de cette redirection : le lien d'autorisation est
     tres long, et le copier depuis un terminal le tronque facilement - Twitch
     repond alors « missing response type ». Ici il suffit d'ouvrir
     http://localhost:3000, court et increvable. */
  if (!code && !url.searchParams.has('error')) {
    res.writeHead(302, { Location: lien });
    res.end();
    return;
  }

  if (!code) {
    const err = url.searchParams.get('error_description') || 'aucun code reçu';
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>Échec</h1><p>${err}</p>`);
    return;
  }

  try {
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ID,
        client_secret: SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECTION
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || JSON.stringify(d));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>C\'est bon !</h1><p>Reviens dans le terminal, tu peux fermer cet onglet.</p>');

    /* On demande a Twitch a QUI appartient ce jeton. C'est la seule facon sure
       de connaitre le pseudo exact a mettre dans BOT_USERNAME : se tromper de
       compte au moment d'autoriser est l'erreur la plus facile a commettre. */
    let login = null;
    try {
      const v = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${d.access_token}` }
      });
      if (v.ok) login = (await v.json()).login;
    } catch { /* simple confort, on continue sans */ }

    if (login) {
      console.log(`\n  Ce jeton appartient au compte : ${login}`);
      console.log(`  -> BOT_USERNAME doit valoir exactement : ${login}`);
    }

    const aEcrire = { TWITCH_REFRESH_TOKEN: d.refresh_token };
    if (login) aEcrire.BOT_USERNAME = login;
    ecrireDansEnv(aEcrire);
    console.log(`\n  ✓ .env mis a jour (${d.refresh_token.length} caracteres ecrits).`);

    /* Verification immediate : on relit le .env et on demande un renouvellement
       avec ce qui y est reellement stocke. Si ca passe ici, ca passera au
       demarrage du bot. */
    const relu = fs.readFileSync(FICHIER_ENV, 'utf8')
      .split(/\r?\n/).find((l) => l.startsWith('TWITCH_REFRESH_TOKEN='))?.slice(21) ?? '';
    const test = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token', refresh_token: relu, client_id: ID, client_secret: SECRET
      })
    });
    console.log(test.ok
      ? '  ✓ Verifie : le jeton enregistre fonctionne.'
      : `  ⚠ Le jeton enregistre est refuse (${test.status}). Relance le script.`);

    console.log('\n  A copier dans les Shared Variables de Railway :\n');
    console.log(`  BOT_USERNAME         = ${login ?? '<le compte ci-dessus>'}`);
    console.log(`  TWITCH_REFRESH_TOKEN = ${d.refresh_token}\n`);
    console.log('  Copie-le en entier : il fait exactement ' + d.refresh_token.length + ' caracteres.\n');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>Échec</h1><p>${e.message}</p>`);
    console.error('\n  ⚠ Échange impossible :', e.message, '\n');
  }
  setTimeout(() => serveur.close(), 500);
});

serveur.listen(PORT, () => {
  console.log(`
  Ouvre cette adresse dans une FENETRE DE NAVIGATION PRIVEE :

      ${REDIRECTION}

  Connecte-toi avec le compte du BOT. Le jeton appartiendra au compte connecte
  dans cette fenetre : si c'est ton compte principal, Twitch refusera ensuite la
  connexion au tchat.
`);
  // Volontairement PAS d'ouverture automatique : elle utiliserait le
  // navigateur par defaut, ou c'est souvent le compte principal qui est
  // connecte - et le jeton finirait sur le mauvais compte.
});
