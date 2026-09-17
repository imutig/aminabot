# Les notes de la semaine

Bot Twitch + overlay OBS pour le segment hebdomadaire de **saysayouu**.
Amina note sa semaine sur 8 critères, le chat note **sa propre semaine** sur les mêmes critères,
l'overlay compare les deux en direct puis enchaîne sur les résultats.

---

## Identifiants Twitch

Ce jeu lit le `.env` **à la racine du dépôt**, partagé avec Famille en or. Avec
`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` et `TWITCH_REFRESH_TOKEN` renseignés,
le bot renouvelle son jeton tout seul (même code que Famille en or,
`bot/token.js`). Sans eux, il retombe sur `BOT_OAUTH`, qui expire en quelques
heures.

---

## Démarrer

```bash
npm run notes        # depuis la racine du dépôt
```

Puis dans OBS : **Source → Navigateur**, URL `http://localhost:4747`, taille **1920 × 1080**.

Décoche **« Éteindre la source quand elle n'est pas visible »** et
**« Rafraîchir le navigateur quand la scène devient active »** - sinon l'overlay
repart de zéro en plein segment.

Place la source **webcam sous l'overlay**, cadrée dans la découpe festonnée.
Elle occupe **toute la partie gauche** : 1040 × 990, centrée sur (560, 540),
soit de x 17 à 1103 et de y 22 à 1058 festons compris.

### Recadrer la webcam

La découpe fait **1040 × 990**, soit un rapport quasi carré - une webcam 16:9
doit donc être rognée sur les côtés. Dans OBS : clic droit sur la source webcam →
`Filtres` → `+` → `Rogner/Compléter`, et enlève **393 px à gauche et 393 px à
droite** (sur une cam 1920 × 1080). Il reste 1134 × 1080, qui se réduit
exactement à 1040 × 990 : **aucune perte de qualité**.

Autre solution si tu préfères ne rien rogner : garde le 16:9 et laisse la cam
déborder derrière l'overlay - seule la partie dans la découpe sera visible.

Le rappel « tape un chiffre de 0 à 10 » et la barre de calcul se **superposent
en bas de la cam** (à partir de y 920), façon lower third.

### Répéter sans être en live

```bash
npm run notes:demo   # depuis la racine du dépôt
```

Aucune connexion Twitch : 90 viewers simulés votent, Amina donne ses notes toute
seule, la séquence complète tourne en boucle. C'est le mode à utiliser pour
régler le placement dans OBS.

---

## La télécommande - `http://localhost:4747/control`

**Rien n'avance tout seul.** Toute la séquence est pilotée depuis cette page,
à ouvrir sur un second écran (ou sur le téléphone en dépannage : même wifi,
remplace `localhost` par l'IP du PC).

La page occupe exactement la hauteur de l'écran et **ne défile jamais** : ce
sont les listes, à l'intérieur des panneaux, qui défilent.

- **En haut** : l'étape en cours, ce qui vient après, l'état de la connexion,
  et **Précédent / Suivant**, c'est 90 % de l'usage.
- **À gauche** : le **déroulé** complet, une ligne par étape, pour y sauter
  directement (l'étape en cours se surligne et se recentre toute seule), puis
  **Lancer / Arrêter / Remettre à zéro**.
- **En haut à droite** : la **note d'Amina**, une ligne de 0 à 10, avec en
  dessous le direct du chat (moyenne, note d'Amina, votes reçus) et
  « Annuler la note » pour rouvrir les votes.
- **En dessous, le tableau de la semaine** : une ligne par critère. À gauche
  le nom et le coefficient, modifiables hors segment ; à droite la note
  d'Amina et la moyenne du chat, qui se remplissent au fil du segment. C'est
  le relevé complet de la semaine sans quitter la régie.
- **À droite, les participants** : tout le monde a voté au moins une fois,
  trié par assiduité, avec un champ de recherche.

### Mettre la semaine de quelqu'un à l'antenne

Clique un pseudo dans **Les participants** : la colonne de droite du tableau,
à l'écran, montre **ses notes à lui** à la place des moyennes du chat. La
colonne prend son pseudo, le bandeau passe en rose et affiche « La semaine de
… », et la colonne d'Amina reste en face - c'est la comparaison qui est
intéressante.

Sa semaine se lit **en entier**, y compris sur les critères pas encore joués.
Reclique le même pseudo, ou le bouton **Tableau**, pour revenir aux moyennes.
Possible à n'importe quel moment après le lancement, et conservé si l'overlay
se recharge.

Raccourcis clavier sur la page : `←` `→` pour naviguer, `0`–`9` et `A` (=10)
pour la note d'Amina.

### Les critères et leurs coefficients

Modifiables depuis la télécommande, hors segment uniquement (changer les
critères en plein vote invaliderait les votes déjà reçus - la page se verrouille
toute seule).

Le **coefficient** (×0,5 à ×5) pondère le critère dans la moyenne générale
**et** dans le classement des viewers. Un critère à ×2 pèse double. Il s'affiche
dans le tableau à l'antenne uniquement s'il est différent de ×1.

Les critères sont enregistrés dans `criteres.json` (créé à la première
sauvegarde). Supprime ce fichier pour revenir aux 8 critères de `config.js`.

## Le chat

| Qui | Tape dans le chat | Effet |
|---|---|---|
| **Les viewers** | `7` (un chiffre seul, 0 à 10) | Note leur propre semaine sur le critère en cours |
| Amina | `7` (un chiffre seul) | **Sa** note sur le critère en cours |
| Amina (ou un mod) | `!notes` | Lance le segment |
| Amina (ou un mod) | `!next` / `!prev` | Étape suivante / précédente |
| Amina (ou un mod) | `!stop` | Coupe le segment |

Un viewer peut se corriger : **son dernier message compte**, la moyenne peut donc
baisser. Poser sa note ferme les votes du critère ; revenir dessus les rouvre.

### Qui entre au classement

**Seuls ceux qui ont noté TOUS les critères.** Comparer une moyenne sur huit
notes à une moyenne sur deux n'a aucun sens : quelqu'un qui n'aurait noté que
« les petits plaisirs » finirait devant tout le monde.

L'écran du classement l'annonce, pour que quelqu'un qui a voté et ne se voit
pas comprenne pourquoi au lieu de croire à un bug :

> 27 classés sur 34 participants · il fallait noter les 8 critères

Si personne n'a la semaine complète, les trois écrans de résultats le disent
au lieu de rester sur l'image précédente.

### La répartition des votes

La ligne du critère en cours affiche **onze bâtonnets**, un par note, hauteur
relative au plus haut. Une moyenne de `6.0` peut vouloir dire « tout le monde
a mis 6 » ou « la moitié a mis 0 et l'autre 10 » : c'est la forme qui fait le
moment à l'antenne, pas le chiffre. Les bâtonnets reprennent le dégradé du
barème, donc la couleur dit déjà de quel côté penche le chat.

---

## Réglages

Tout est dans **`config.js`** :

| Réglage | Défaut | À quoi ça sert |
|---|---|---|
| `camSide` | `'gauche'` | Miroir complet de la mise en page si la cam est à droite |
| `camPlaceholder` | `false` | Le rectangle « CAM ». Passe-le à `true` pour revoir le repérage |
| `aminaName` | `'Amina'` | En-tête de la colonne de gauche |
| `weekLabel` | `null` | `null` = calculé automatiquement (« Semaine du 24 → 30 juillet ») |
| `chiffreSeulPourAmina` | `true` | Un chiffre seul d'Amina = sa note. Mets `false` si elle veut `!note 7` |
| `defilementMaxSec` | `40` | Plafond du défilement final (voir « Écarts » plus bas) |

Les critères se règlent depuis la télécommande, pas ici. `CRITERES` dans
`config.js` ne sert plus que de valeur de départ.

---

## Architecture

L'overlay est un **affichage pur** : il n'écoute ni le clavier ni la souris.
Tout le pilotage passe par `/control`.

```
src/session.js   Source de vérité : votes, moyennes, classement. Ne connaît ni Twitch ni l'affichage.
src/bot.js       Lit le chat Twitch, traduit les messages en appels à la session.
src/server.js    Sert l'overlay + relaie les événements de la session en WebSocket.
src/demo.js      Faux chat, pour répéter.
overlay/         La page affichée par OBS : machine à états, lissage, rendu.
```

Le serveur détient les **données**, l'overlay détient la **mise en scène**. Deux
conséquences utiles :

- **Le segment ne dépend pas de l'overlay.** Si OBS n'est pas chargé, `!notes`
  fonctionne quand même, les votes sont comptés, et l'overlay rattrape l'état
  s'il se connecte plus tard.
- **Recharger l'overlay en plein segment ne perd rien** : il se remet à l'image
  en cours.

Le lissage de la moyenne du chat (`disp += (avg - disp) * 0.22` toutes les 60 ms)
est ce qui évite que la barre saute à chaque vote.

---

## Au repos

Tant que le segment n'est pas lancé, l'overlay n'affiche **que le ciel et
l'emplacement de la cam**. Le panneau, le feed et les résultats sont en
`display: none`.

Au clic sur « Lancer le segment », le rideau de nuages balaie l'écran et
découvre la carte titre : c'est la seule apparition du segment, elle sert de
générique.

Si le serveur redémarre, les pages ouvertes (overlay et télécommande) se
**rechargent toutes seules**. Sans ça, une page chargée avec l'ancien code reste
connectée, ne comprend plus les messages, et donne l'impression que la
télécommande ne répond pas.

---

## Mise en page

```
┌──────────────────────────────┬─────────────────┐
│                              │  Tableau des    │
│                              │  8 critères     │
│      CAM  1040 × 810         │  (56 → 847)     │
│      (toute la gauche)       │                 │
│                              ├─────────────────┤
│                              │  Feed des votes │
├──────────────────────────────┤  (866 → 1056)   │
│  Rappel « 0 → 10 » / Calcul  │                 │
└──────────────────────────────┴─────────────────┘
```

Le bloc **chat** affiche **tous les messages** du chat, pas seulement les votes.
Il est visible en permanence, y compris avant le lancement et pendant les
résultats (il ne recouvre rien : le classement s'arrête à 838, le chat commence
à 866).

Quand un vote est **réellement compté**, il s'affiche comme une **pastille de
note colorée** selon le barème plutôt que comme du texte - on voit d'un coup
d'œil les votes passer au milieu de la conversation. Un chiffre refusé (votes
fermés sur le critère) reste du texte normal : afficher une pastille pour une
note qui ne compte pas serait pire que pas de retour du tout.

### Les bulles de vote

À chaque vote pris en compte, une **bulle au pseudo du votant** jaillit à côté
du compteur de la ligne en cours, monte en diagonale et disparaît en 2 secondes.

C'est le seul accusé de réception côté spectateur : un compteur qui monte ne dit
pas **qui** a été entendu, et sur une chaîne active on ne sait pas si c'est son
propre vote ou celui du voisin. Quatre bulles au maximum à l'écran ; pendant une
salve, les suivantes sont simplement sautées, le compteur suit tout le monde.

**La modération suit** : un message supprimé, un viewer timeout ou banni, ou un
`/clear` retirent les lignes correspondantes de l'overlay. Sans ça un message
modéré resterait affiché à l'antenne après la sanction.

---

## Écarts assumés par rapport au handoff design

Le reste suit le handoff au pixel près. Trois exceptions, volontaires :

**0. La cam et le feed des votes** sortent du handoff : demandés par la
streameuse après coup. Le handoff prévoyait une cam de 1010 × 568 et pas de feed.
Les proportions, couleurs et animations réutilisent les tokens existants.

**1. Vitesse du défilement final.** Le handoff fixe 30 px/s. À cette vitesse,
70 viewers = 88 secondes de noms qui défilent, et les 300 votants que la spec
prévoit = plus de 7 minutes. La vitesse reste à 30 px/s tant qu'on tient sous
`defilementMaxSec` (40 s), puis accélère. À rediscuter avec le designer si tu
préfères couper la liste plutôt qu'accélérer.

**2. Le décalage horizontal de la ligne active.** Le handoff demande à la fois
`transform: translateX(-10px)` et l'animation `breathe` sur la ligne en cours.
En CSS, l'animation écrase le transform : le décalage serait perdu. Il est
intégré aux keyframes de `breathe` pour que les deux coexistent.

---

## Points à surveiller

- **Le token Twitch expire** (quelques heures). Quand le bot ne se connecte plus
  (`Login authentication failed`), régénère un token et remplace `BOT_OAUTH`
  dans `.env`.
- **Les polices viennent de Google Fonts.** Si OBS démarre sans réseau, le
  rendu se dégrade. Pour blinder ça il faudrait héberger Baloo 2 et Nunito en
  local (`@font-face` + woff2) - pas fait pour l'instant.
- **Le compte du bot doit pouvoir parler** dans le chat (mode abonnés/followers).
