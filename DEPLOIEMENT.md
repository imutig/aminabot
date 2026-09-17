# Déploiement sur Railway

Deux briques, dont une déjà hébergée :

| Brique | Où | Rôle |
|---|---|---|
| **Convex** | déjà dans le cloud Convex | La base et toute la logique de jeu |
| **Un service** | Railway | Le site (antenne, régie, préparation) + la connexion au tchat, 24/7 |

Seul **Une famille en or** est déployé sur Railway. Les notes de la semaine
tournent en local (`npm run notes`).

---

## 1. D'abord : passer Convex en production

Aujourd'hui tout tourne sur le déploiement de **développement**. Il faut créer
celui de production, une fois, depuis ta machine :

```bash
npx convex deploy
```

La commande affiche l'URL de production, du type
`https://quelque-chose-1234.convex.cloud`. **Garde-la**, les deux services
Railway en ont besoin.

⚠️ **La production démarre vide.** Tes questions actuelles sont dans le
déploiement de développement, elles ne suivent pas. Une fois le site déployé,
ressaisis-les depuis la page de préparation - ou lance
`npx convex run demo:remplir --prod` pour repartir des questions de démo.

---

## 2. Le service Railway

**Un seul service** sert le site *et* tient la connexion au tchat. Deux services
séparés seraient plus « propres », mais ça ferait deux configurations et deux
jeux de variables à tenir - pour un bot qui parle à une seule chaîne, ça ne se
justifie pas.

Rien à régler : `railway.json` fixe déjà le build (`npm run build`) et le
démarrage (`npm start`).

**Variables à renseigner :**

```
CONVEX_URL           = https://<ton-deploiement-prod>.convex.cloud
VITE_CONVEX_URL      = https://<ton-deploiement-prod>.convex.cloud
BOT_USERNAME         = aminabot_
CHANNEL              = saysayouu
TWITCH_CLIENT_ID     = <voir section 3>
TWITCH_CLIENT_SECRET = <voir section 3>
TWITCH_REFRESH_TOKEN = <voir section 3>
```

Oui, l'URL Convex apparaît **deux fois**, avec deux noms. Ce n'est pas une
erreur : `VITE_CONVEX_URL` est lue **au moment du build** (elle est écrite en
dur dans le HTML), `CONVEX_URL` est lue **au démarrage** par le bot. Si tu
changes de déploiement Convex, il faut relancer un build, pas seulement
redémarrer.

Le port vient de Railway (`PORT`), le serveur le prend automatiquement.

Si les variables Twitch manquent, **le site démarre quand même** et le journal
le signale. Ça permet de déployer avant d'avoir réglé les jetons.

---

## 3. Le jeton Twitch - à faire avant de renseigner les variables

Un jeton d'accès Twitch expire en quelques heures. Pour un bot hébergé en
permanence, il faut qu'il **renouvelle son accès tout seul**. Ça demande une
application Twitch à toi.

⚠️ Le `CLIENT_ID` que tu avais (`gp762nuu…`) est celui du **site générateur de
jetons**, pas le tien : son secret ne t'appartient pas. Vérifié auprès de
Twitch, qui répond `invalid client secret`. Il faut donc créer ta propre app.

**a. Créer l'application** - https://dev.twitch.tv/console/apps

| Champ | Valeur |
|---|---|
| Nom | ce que tu veux (ex. `aminabot`) |
| URL de redirection OAuth | `http://localhost:3000` |
| Catégorie | Chat Bot (sans importance) |
| **Type de client** | **Confidentiel** |

Deux pièges, tous les deux bloquants :

- **L'URL doit être écrite en entier, avec `http://`.** Twitch exige HTTPS sauf
  pour `localhost`, qui est explicitement autorisé en `http` - mais si tu tapes
  `localhost:3000` sans le protocole, il applique la règle générale et refuse.
  L'adresse doit être exactement `http://localhost:3000`, c'est celle que le
  script écoute.
- **Type de client : Confidentiel, pas Publique.** C'est ce qui décide si Twitch
  te donne un Client Secret. Un client public n'en a pas, et sans secret il n'y
  a pas de renouvellement automatique possible.

  « Confidentiel » veut dire que le programme tourne sur un serveur que tu
  contrôles, où un secret peut rester secret - c'est le cas, il tourne sur
  Railway.

Le compte qui crée l'application n'a **aucune importance** : c'est une fiche
d'identité pour le programme, pas un compte de connexion. Ce qui compte, c'est
le compte avec lequel tu autoriseras à l'étape suivante.

Relève le **Client ID** et génère le **Client Secret**.

**b. Obtenir le refresh token** - une seule fois, en local :

Renseigne `TWITCH_CLIENT_ID` et `TWITCH_CLIENT_SECRET` dans le `.env` à la
racine, **enregistre**, puis :

```bash
npm run token
```

Ça ouvre Twitch dans ton navigateur. **Connecte-toi avec le compte du bot**
(`aminabot_`), pas ton compte principal. Le terminal affiche ensuite les trois
variables à copier.

---

## 4. Pousser

Deux possibilités :

- **Depuis GitHub** (recommandé) : dans Railway, relier le service au dépôt
  `imutig/aminabot`. Chaque `git push` sur `main` redéploie tout seul.
- **Depuis ta machine** : `railway up` téléverse le dossier tel quel.

`.railwayignore` écarte `notes-de-la-semaine/`, `design/` et `dist/` - inutiles en production.

---

## Héberger aussi Les notes de la semaine

Deuxième service Railway, **dans le même projet et depuis le même dépôt**.

1. Dans le projet Railway : **New** → **GitHub Repo** → `imutig/aminabot`.
2. Service → **Settings** → **Deploy** → **Custom Start Command** :

   ```
   npm run notes
   ```

   Laisse le *Root Directory* à la racine : Notes importe `bot/token.js`, qui
   vit au niveau du dépôt.
3. **Variables** : les deux jeux utilisent **le même compte de bot**, donc les
   mêmes valeurs. Plutôt que de les recopier, définis-les une fois pour tout le
   projet : **Project Settings** → **Shared Variables** → ajoute `BOT_USERNAME`,
   `CHANNEL`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REFRESH_TOKEN`,
   puis dans chaque service coche-les pour les importer.

   Comme ça, le jour où tu régénères le jeton, tu le changes à **un seul
   endroit**. Notes n'a pas besoin des variables Convex.
4. **`CONTROL_PIN`**, sur le service Notes uniquement (pas en Shared Variable,
   il ne sert qu'à lui) : le code d'accès à la télécommande `/control`.

   ⚠️ **À ne pas oublier.** Sans lui, l'adresse est publique et n'importe qui
   peut lancer, arrêter ou remettre à zéro le segment en plein direct. Le
   service le rappelle dans ses logs au démarrage.
5. **Settings** → **Networking** → **Generate Domain**.

Le port est fourni par Railway et lu automatiquement.

⚠️ **Les deux bots lisent le même tchat en permanence.** Ce n'est gênant que si
tu lances un segment des deux jeux en même temps : un « 7 » compterait alors à
la fois comme un vote et comme une réponse. En pratique tu joues à un jeu à la
fois, donc il suffit de ne pas ouvrir les deux segments simultanément.

---

## Une fois en ligne

Dans OBS, remplace `http://localhost:5178/` par ton URL Railway :

| | |
|---|---|
| Antenne (OBS) | `https://<ton-site>.up.railway.app/` |
| Régie | `https://<ton-site>.up.railway.app/?vue=regie` |
| Préparation | `https://<ton-site>.up.railway.app/prep` |

Avantage du passage en ligne : tu peux préparer tes questions depuis ton
téléphone, et le bot tourne même quand ton PC est éteint.

---

## Si le bot ne lit plus le tchat

Regarde les logs Railway du service :

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| `⚠ authentification refusée` puis `nouveau jeton en place` | Normal, il s'est réparé tout seul |
| `⚠ renouvellement impossible : ... invalid client secret` | Le `TWITCH_CLIENT_SECRET` ne correspond pas au `TWITCH_CLIENT_ID` |
| `⚠ renouvellement impossible : ... Invalid refresh token` | Le refresh token a été révoqué (mot de passe changé, app déconnectée) - relance `npm run token` |
| `⚠ jeton fixe` au démarrage | Les trois variables ne sont pas toutes présentes, il est retombé en mode manuel |
| Rien du tout, jamais | Le tchat est simplement calme. Tape « moi » pour voir apparaître `✓ premier message reçu` |
