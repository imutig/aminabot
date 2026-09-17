# Une famille en or - jeu Twitch pour saysayouu

Jeu télévisé jouable depuis le tchat, en deux vues issues d'un seul rendu :
**antenne** (Browser Source OBS, zone webcam découpée, aucune commande) et
**régie** (le même écran au pixel près, plus une barre de commandes).

> Ce dépôt contient **deux jeux** :
>
> | Jeu | Dossier | Lancer |
> |---|---|---|
> | Une famille en or | racine | `npm run web` puis `npm run bot` |
> | Les notes de la semaine | [`notes-de-la-semaine/`](notes-de-la-semaine/) | `npm run notes:installer` une fois, puis `npm run notes` (ou `notes:demo`) |
>
> Les deux partagent le même `.env` à la racine et le même renouvellement
> automatique du jeton Twitch (`bot/token.js`). Ils utilisent des ports
> différents (5178 pour Famille en or, 4747 pour Notes) et peuvent tourner en
> même temps, mais un seul à la fois est prévu à l'antenne.

---

## Placer la webcam dans OBS

**La webcam se place SOUS la source overlay.** L'overlay perce un vrai trou
transparent a cet endroit, avec des coins arrondis : c'est ce qui donne a
l'image sa forme, et ce qui permet de la masquer a volonte depuis la regie.

| | |
|---|---|
| Position du trou | 1449, 729 |
| Taille | 422 x 302, coins arrondis de 30 |

Le bouton **Cam** de la regie (raccourci `C`) bouche le trou quand il recouvre
quelque chose que tu veux montrer.

### Pourquoi le fond repassait par-dessus la cam

Un calque composite materiellement **n'est pas decoupe par son calque parent**
dans Chromium. Or ce plateau est plein d'animations en `transform` - etoiles,
titres, reflets, volet de transition - et chacune promeut son element en calque.
Ces calques sortaient du decoupage, et le fond du jeu repassait par-dessus la
webcam, en general apres une transition.

Le remede est de **promouvoir en calque la couche qui decoupe** :
`transform: translateZ(0)` sur `.masque`, `.fond`, `.plateau` et `.volet`. Le
decoupage devient alors un decoupage de compositeur, applique a tout le
sous-arbre, auquel les enfants composites sont soumis a leur tour. `contain:
paint` renforce la contrainte.

Deux attenuations completent le dispositif : le decoupage est pose sur chaque
couche et pas seulement sur le groupe, et les bandeaux s'ouvrent en `scaleY`
plutot qu'en `rotateX` - une transformation 3D forcait un calque composite a
chaque reponse revelee.

Si le probleme reapparaissait malgre tout : **appuie deux fois sur `C`**.
Masquer puis reafficher la cam force le recalcul du decoupage.

---

## Architecture

```
   Twitch IRC
       │
       ▼
   bot local (tmi.js)          ← seul processus à demeurer chez toi
       │  mutations
       ▼
   ┌─────────────┐
   │   CONVEX    │  source de vérité : questions préparées, partie en cours,
   │             │  joueurs, équipes, cases révélées, tchat
   └─────────────┘
       │  abonnements réactifs (les deux reçoivent la même chose)
       ├──────────────────────────┐
       ▼                          ▼
   overlay (OBS)              régie (navigateur)
   lecture seule              lecture + commandes
```

**Pourquoi Convex plutôt qu'un serveur local comme sur l'ancien projet :**

- Les questions sont préparées à l'avance : il faut une vraie base, pas un JSON
  à côté du code.
- La synchro overlay ↔ régie est native (abonnements réactifs). Ça remplace toute
  la couche WebSocket écrite à la main la dernière fois.
- Recharger l'overlay en pleine partie le remet à l'image en cours, gratuitement.
- Tu peux préparer tes questions depuis n'importe quel appareil.

**Ce que ça coûte, en toute honnêteté :** l'overlay dépend maintenant du réseau,
là où l'ancien tournait en `localhost` et était increvable. Deux nuances : il faut
déjà du réseau pour streamer, et une micro-coupure ne vide pas l'écran - l'overlay
garde son dernier état affiché et rattrape à la reconnexion. Le seul symptôme
serait un jeu qui n'avance plus pendant quelques secondes.

---

## Mise en route

**1. Installer les dépendances**

```bash
npm install
```

**2. Lier ton compte Convex** (une seule fois, ouvre le navigateur)

```bash
npx convex dev
```

Ça crée le projet côté Convex, génère `convex/_generated/` et écrit l'URL de
déploiement dans `.env.local`. Laisse la commande tourner pendant le développement :
elle pousse les changements de `convex/` à chaque sauvegarde.

**3. Lancer le reste**

```bash
npm run web    # l'overlay + la régie + le site de préparation
npm run bot    # la connexion au tchat Twitch
```

| Page | Adresse | Pour |
|---|---|---|
| **Antenne** | `http://localhost:5178/` | La source navigateur d'OBS (1920 × 1080) |
| **Régie** | `http://localhost:5178/?vue=regie` | Ton écran : le même rendu + la barre de commandes |
| **Préparation** | `http://localhost:5178/prep.html` | Saisir les questions avant le live |

Raccourcis en régie : `→` ou `Espace` action principale, `←` revenir en arrière,
`V` basculer antenne / régie.

**Données de démonstration** (6 questions toutes prêtes, pour répéter) :

```bash
npx convex run demo:remplir
```

---

## Structure

```
convex/
  schema.ts            Le modèle de données
  lib/reponses.ts      Reconnaissance des réponses du tchat (règles de jeu)
  lib/reponses.test.ts Tests de ces règles - node convex/lib/reponses.test.ts
web/                   L'overlay et la régie (un seul rendu, deux vues)
bot/                   Le processus local qui écoute le tchat Twitch
design/
  SPEC-DESIGN.md       La spec envoyée au designer
  handoff/             Le handoff reçu : prototype animé + README hifi
notes-de-la-semaine/   L'autre jeu, autonome (son propre package.json)
```

---

## Les règles de reconnaissance des réponses

Une case peut accepter plusieurs libellés (`DESSERT/GÂTEAU`). La comparaison
ignore **les accents, la casse, la ponctuation, les emojis et le pluriel**, mais
le mot doit être exact : pas de tolérance aux fautes de frappe (ça demanderait un
modèle de langue, donc un coût par message).

Un libellé d'un seul mot doit correspondre à un **mot entier** du message -
`nappe` accepte « la nappe ! » mais pas « nappement ». Un libellé de plusieurs
mots doit apparaître comme une **suite de mots** - `bonne ambiance` accepte
« une bonne ambiance ».

Le message n'a pas besoin d'être exactement la réponse : « jsp moi je dirais
chocolat » compte. C'était nécessaire, personne ne tape le mot seul dans un tchat.

```bash
node convex/lib/reponses.test.ts
```

---

## Le site de préparation

Un paquet = une session = 6 manches. Chaque manche a un texte, un interrupteur
**points doubles**, et de 4 à 10 réponses.

Une réponse se saisit `DESSERT/GÂTEAU` : tous les libellés séparés par `/` sont
acceptés, et c'est **le premier** qui s'affiche à l'antenne. Le compteur passe au
rouge tant qu'il y a moins de 4 réponses, et le bouton *Enregistrer* devient rose
dès qu'il y a des modifications non sauvegardées.

Au lancement, la régie choisit le paquet dans une liste déroulante sur l'écran
titre - invisible à l'antenne.

---

## Une règle de rendu à ne pas casser

Les écrans se **patchent**, ils ne se reconstruisent pas. Un simple message de
tchat provoque une mise à jour Convex ; si on refaisait le DOM à chaque fois, les
marches du podium repousseraient du sol et les colonnes d'équipes réapparaîtraient
en boucle. Le helper `siChange()` de `web/screens.js` garde une signature de ce
qui est affiché et ne rebâtit que si elle change.

C'est la traduction concrète de la règle n°1 de la spec : *rien ne doit surgir
sans être arrivé de quelque part*.

---

## Ce qui reste

- [ ] Finition de E10 (Merci) - les bornes à cerises sont approximatives
- [ ] Passage de calage visuel sur les 10 écrans avec le prototype côte à côte
- [ ] Le classement final en mode famille au-delà de 2 équipes (le duel est fait,
      le podium à 3 marches aussi, mais non testé à 3+ équipes)
- [ ] Identité sonore sur la levée des bandeaux et le podium
