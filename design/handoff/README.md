# Handoff — « Une famille en or » (jeu Twitch, chaîne saysayouu)

## Vue d'ensemble

Overlay de jeu télévisé pour Twitch, en deux vues issues d'**un seul rendu** :

- **Antenne** — la page chargée comme *Browser Source* dans OBS. Canvas 1920 × 1080, zone webcam réellement découpée (transparente), aucune commande.
- **Régie** — la même page dans le navigateur de la streameuse, avec une **barre de commandes ajoutée sous le canvas**. Rien au-dessus de cette barre ne bouge d'une vue à l'autre : le repérage OBS reste valide.

Une session = 6 manches. Les viewers rejoignent en écrivant « moi » dans le tchat, à tout moment, même en cours de partie. Deux modes : **solo** (les points vont au trouveur) et **en famille** (les points vont à son équipe, équipes tirées au hasard).

## À propos des fichiers livrés

Les fichiers de `prototype/` sont une **référence de design écrite en HTML** : ils montrent l'aspect visuel, la chorégraphie du mouvement et l'enchaînement des écrans. Ce n'est pas du code de production à copier tel quel. Le travail attendu est de **recréer ces écrans dans l'environnement du projet cible** (React, Svelte, Vue, ou du DOM natif — un overlay OBS n'a besoin d'aucun framework) en suivant ses conventions. Si aucun environnement n'existe encore : pour cette cible, du **HTML/CSS/JS natif sans dépendance** est le choix le plus sûr — l'overlay tourne pendant que la machine encode le live, chaque milliseconde de rendu compte.

Le prototype est écrit avec un runtime de composants maison (`support.js`, fichiers `.dc.html`). **Ne le réimplémentez pas** : lisez-le comme une maquette. Ouvrir `prototype/Une famille en or.dc.html` dans un navigateur suffit à voir le résultat animé.

## Fidélité

**Haute fidélité (hifi).** Couleurs, typographies, épaisseurs de contour, rayons, tailles et durées d'animation sont définitifs et donnés ci-dessous en valeurs exactes. À reproduire au pixel près. Les seuls éléments volontairement approximatifs : les bornes d'arcade de E1/E10 (construites en boîtes CSS, à remplacer par les illustrations finales si la streameuse en fournit) et le contenu de démonstration (questions et pseudos inventés).

---

## Contraintes techniques non négociables

| Contrainte | Détail |
|---|---|
| Canvas | **1920 × 1080** exactement. La scène est mise à l'échelle par `transform: scale()` sur un wrapper, jamais par des unités relatives : les coordonnées internes restent en px absolus. |
| Trou webcam | Découpe **réellement transparente** : `<svg>` plein canvas + `<mask>` (rect blanc plein cadre + forme de la découpe en noir), appliqué en CSS `mask: url(#camhole)` sur le conteneur de scène. **Ne pas utiliser `<use href>`** pour dupliquer la forme : certains moteurs de capture perdent l'héritage de `fill` et peignent la forme en noir. Inliner le `<path>`/`<rect>` à chaque fois. |
| Vue antenne | `background: transparent` sur `html`/`body`. Le fond coloré de l'écran est un calque du jeu, pas le fond de page. |
| Performance | L'overlay tourne dans OBS pendant l'encodage. **N'animer en boucle que `transform` et `opacity`.** Jamais `width`, `height`, `top`, `left`, `margin`, `filter`, `box-shadow` en boucle. Viser une dizaine d'éléments animés en permanence, pas deux cents. Pas de `filter: blur()` animé sur grande surface. |
| Lisibilité stream | Twitch écrase le bitrate : pas de texte fin, pas de dégradé subtil sur grande surface, contraste ≥ 4.5:1 pour tout texte. Les gros contours noirs jouent en notre faveur. |
| Fond imprévisible | Chaque bloc porte son propre fond opaque. |

---

## Tokens de design

### Couleurs

| Token | Valeur | Rôle |
|---|---|---|
| `--noir` | `#1B1016` | Contours, systématique. Épaisseur constante. |
| `--rose-vif` | `#FF6FA8` | Couleur de marque : cadre de scène, bandeau d'en-tête, cases cachées |
| `--rose-pastille` | `#FF8FBF` | Pastilles de pseudos |
| `--rose-clair` | `#FFC9E4` | Fond d'écran rose (carrelage) |
| `--rose-borne` | `#FFD9EC` | Corps des bornes d'arcade |
| `--creme` | `#FDFBD8` | Fond de toutes les cartes de contenu — c'est lui qui porte le texte |
| `--jaune` | `#F9E96B` | Boutons primaires, pastilles de points, compteur |
| `--jaune-pale` | `#FAF6C0` | Panneau tchat |
| `--cyan` | `#A9E7F2` | Fond des écrans famille et points |
| `--orange` | `#F79B54` | Bouton « Jouer en famille » |
| `--orange-pale` | `#FBC894` | Fond du lobby solo |
| `--vert-pale` | `#D8F0AE` | Cadre webcam en régie |
| `--violet` | `#D9BDF2` | Podium 1ʳᵉ marche |
| `--blanc-rose` | `#FFF6FA` | Texte sur fond rose |
| `--gris-terne` | `#8A7A80` | Texte des cases révélées en fin de manche (état mineur) |
| `--creme-terne` | `#EDE7D6` | Fond des cases révélées en fin de manche |

**Couleurs d'équipes**, dans l'ordre (6 maximum) :
`#D8F0AE` · `#FBC894` · `#A9E7F2` · `#D9BDF2` · `#F9E96B` · `#FFB8D4`

**Marches du podium** : 1ᵉʳ `#D9BDF2` · 2ᵉ `#FFB8D4` · 3ᵉ `#A9E7F2`

### Typographie

| Rôle | Police | Usage |
|---|---|---|
| Display | **Passion One 900** | Grands titres uniquement : UNE FAMILLE EN OR (170 px), VOUS ÊTES PRÊTS ? (180 px), MERCI ! (230 px), titre de finale (82 px), chiffres du podium (96 px), afficheurs à segments (62 px) |
| Titres de section | **Fredoka 600** | « Les familles », « Les points », question de la manche (44 px), libellés de boutons (30–46 px), consigne du lobby (52 px) |
| Texte courant | **Nunito 800/900** | Pastilles de pseudos, réponses, points, bandeau d'en-tête, tous les nombres |

Les nombres sont en `font-variant-numeric: tabular-nums` — ils changent en direct.

**Effet double contour du display** (à reproduire tel quel) :

```css
color: #FFF6FA;
text-shadow:
  -4px -4px 0 #1B1016,  4px -4px 0 #1B1016,
  -4px  4px 0 #1B1016,  4px  4px 0 #1B1016,
   0 -5px 0 #1B1016,    0 5px 0 #1B1016,
  -5px 0 0 #1B1016,     5px 0 0 #1B1016,
   12px 14px 0 #FF6FA8, 17px 19px 0 #1B1016;
```

(Version réduite pour le titre de finale à 82 px : décalages 3 px / 4 px, ombre portée `9px 11px` puis `13px 15px`.)

### Contours, rayons, ombres

| Échelle | Valeurs |
|---|---|
| Épaisseur de contour | 4 px (petits éléments) · 5–6 px (pastilles, boutons secondaires) · 7–8 px (cartes, boutons primaires) · 9 px (cadre de scène, cadre webcam) |
| Rayons | 16–20 px (lignes de tchat, cases de réponse) · 26–34 px (cartes) · 52 px (cadre de scène) · 999 px (toutes les pilules) |
| Ombre | **Ombre dure noire, jamais floue** : `0 5px 0 #1B1016` (petit) · `0 6–7px 0 #1B1016` (moyen) · `0 8–10px 0 #1B1016` (grand). Aucun blur, aucune opacité. |

### Motifs

- **Carrelage** (fond d'écran) : deux `linear-gradient` blancs à 50 % d'opacité, lignes de 3 px, `background-size: 120px 120px`.
- **Damier** (bas de E1/E10) : `conic-gradient(rose 25%, crème 0 50%, rose 0 75%, crème 0)` en `background-size: 160px 160px`, bande de 172 px de haut, bordure haute noire 8 px.
- **Étoile à quatre branches** : `clip-path: polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)`. Tailles 36 → 150 px.
- **Volet de transition** : même damier, `background-size: 180px 180px`, panneau plein canvas incliné `skewX(-8deg)` avec une barre noire de 60 px sur son bord de fuite.

---

## Géométrie commune (coordonnées canvas, en px)

| Élément | Position |
|---|---|
| Bandeau d'en-tête | `left: 36, right: 36, top: 26, height: 92`, `z-index: 40` — **ne bouge jamais, jamais recouvert par une transition** |
| Cadre webcam | `left: 1440, top: 720, 440 × 320`, rayon 38, contour 9 px, `z-index: 50` — **position et taille fixes sur tous les écrans** |
| Trou du masque | `x: 1449, y: 729, 422 × 302, rx: 30` (9 px de moins que le cadre de chaque côté, pour que le contour noir survive à la découpe) |
| Cadre de scène | `left: 40, top: 150, 1840 × 890` — cadre rose, contour 9 px, rayon 52 ; carte crème en retrait de 26 px, contour 8 px, rayon 34 |
| Titre dans la bordure | pilule crème `left: 70, top: -34, height: 76`, contour 8 px, `z-index: 2` |
| Compteur de participants | cercle jaune `right: -24, top: -42, 170 × 170`, contour 9 px |
| Volet de transition | plein canvas, `z-index: 30` — passe **sous** l'en-tête et la webcam |
| Barre de commandes | sous le canvas, `1920 × 132`, fond crème, contour 8 px sans bordure haute |
| Bande de rappel (antenne) | sous le canvas, `1920 × 56`, hors overlay — n'existe que dans le navigateur de la streameuse |

---

## Les 10 écrans

Code couleur des fonds : **rose** E1, E5, E6, E9, E10 · **orange** E2 · **cyan** E3, E4, E7, E8.

### `E1` — Écran titre · rose
Bornes d'arcade de part et d'autre (`400 × 800`, débordant de 40 px hors canvas), damier en bas, titre display sur deux lignes (« UNE FAMILLE » / « EN OR », 170 px, `top: 170`), deux boutons centrés `560 × 104` à `top: 640`, espacés de 26 px : `Jouer seul` (cyan) et `Jouer en famille` (orange).
Ces deux boutons sont **le contenu** de l'écran, pas de la régie : ils restent au centre, mais ne sont cliquables qu'en vue régie.
Barre de commandes : aucun bouton, un rappel textuel.

Contenu d'une borne : afficheur à segments (pilule crème, 4 chiffres Passion One rose, valeurs changeant toutes les 4,2 s), écran (carte crème avec 4 barres « pixel » qui montent et descendent), joystick (disque crème + tige noire + boule jaune), 2 boutons ovales qui clignotent en décalé, étoile crème.

### `E2` — Lobby solo · orange
Cadre de scène. Titre « Écris « moi » dans le tchat pour participer » (Fredoka 52 px, centré, `top: 44` dans la carte). Compteur de participants en haut à droite. Grille de pastilles de pseudos : **3 colonnes**, hauteur de pilule 78 px, gouttières 20 × 26, zone `left: 60, right: 520` (la réserve de droite évite la webcam).
- **État vide** : étoile rose de 150 px + « On attend les premiers joueurs… » (Fredoka 38 px, `#8A7A80`).
- **Débordement** : au-delà de 27 pastilles, pilule jaune « +N autres joueurs » en bas de carte.
Barre de commandes : `Démarrer`.

### `E3` — Lobby famille · cyan
Identique à E2. Barre de commandes : champ `Nombre de familles` (− / valeur / +, bornes **2 à 6**) + `Créer les familles`.

### `E4` — Composition des familles · cyan
Titre « Les familles » dans la bordure du cadre. Une colonne par équipe, `flex: 1`, gouttière 26 px, fond = couleur d'équipe, contour 7 px, rayon 28. En tête de colonne, une pilule crème avec le nom ; dessous, les membres en pastilles roses de 62 px. Tirage aléatoire réparti en round-robin sur la liste mélangée. **Tient de 2 à 6 équipes** (les colonnes se partagent la largeur).
Barre de commandes : `Démarrer`.

### `E5` — « Vous êtes prêts ? » · rose
Cadre de scène, titre display plein cadre sur deux lignes (180 px), pilule jaune « MANCHE n / 6 » en dessous, deux étoiles en décor. Passage obligé avant la **première** manche seulement — les manches suivantes enchaînent directement sur E6.

### `E6` — La manche · rose ⭐ écran principal

| Bloc | Position |
|---|---|
| Carte question | `left: 60, top: 172, width: 1340`, min-height 120, crème, Fredoka 44 px centré |
| Grille de réponses | `left: 60, top: 322, 1340 × 576` |
| Bandeau de manche | `left: 60, top: 926, 1340 × 92` |
| Panneau tchat | `left: 1440, top: 172, 440 × 508` |
| Webcam | `left: 1440, top: 720` (position commune) |

**Grille adaptative** : toujours **2 colonnes**, `grid-auto-flow: column`, `grid-template-rows: repeat(ceil(n/2), 1fr)`, gouttières 18 × 20. Réponses **triées par points décroissants**, remplies **colonne par colonne** (toute la gauche, puis la droite) ; nombre impair → la colonne de gauche prend la case en plus. Taille de police de la réponse : **4 réponses → 52 px · 6 → 44 px · 8 → 38 px · 10 → 32 px**. Pastille de points : hauteur 58 px / texte 30 px jusqu'à 6 réponses, 46 px / 24 px au-delà.

**Les 4 états d'une case** :

| État | Rendu |
|---|---|
| `CACHÉE` | Bandeau rose plein (`inset: -1px`, rayon 18) posé sur la case, aucune information. Un reflet le traverse de loin en loin. |
| `TROUVÉE` | Bandeau levé. Fond crème, réponse en majuscules Nunito 900 noir, pastille jaune « n PTS » à droite, et en petit sous la réponse : « trouvé par <pseudo> » (Nunito 800, 18 px, `#9A8A90`). |
| `RÉVÉLÉE EN FIN DE MANCHE` | Même geste **en mode mineur** : fond `#EDE7D6`, texte `#8A7A80`, pastille `#E2DAC6`. Plus lent, en cascade, sans célébration. Le contraste avec l'état trouvé doit être évident. |
| `VIDE` | La case n'existe pas — la grille compte simplement moins d'éléments. |

**Bandeau de manche**, deux états : `MANCHE POINTS NORMAUX` (crème, 32 px) et `MANCHE POINTS DOUBLES` (jaune, 40 px, `scale(1.02)`) — nettement plus énergique, visible sans lire.

**Panneau tchat** : carte jaune pâle, en-tête jaune de 66 px « Le tchat », messages empilés vers le bas (`justify-content: flex-end`), 7 lignes visibles maximum. Ligne normale : fond crème, pseudo rose. Ligne contenant une bonne réponse : fond `#FFC9E4`, pseudo `#C7255F`, et **elle se met en avant avant que la case ne se lève**.

**Fin de manche en deux temps** : le bouton porte deux libellés successifs — `Révéler les réponses` (déclenche la cascade des cases non trouvées), puis `Voir le nombre de points`.

### `E7` — Points solo · cyan
Titre « Les points » dans la bordure. Grille 2 colonnes, gouttières 16 × 56, 10 joueurs affichés au maximum, triés par points décroissants. Chaque ligne : pastille de rang (52 px, rose clair), pastille de pseudo (70 px, rose), pastille ronde de points (96 px, jaune, contour 6 px) avec le nombre roulant et le mot POINTS en 13 px.
Barre de commandes : `Prochaine manche` (et `Aller à la finale` en secondaire — raccourci de démonstration, à retirer en production si inutile).

### `E8` — Points famille · cyan
Titre « Les familles ». Une colonne par équipe : pilule de nom, **grosse pastille ronde de 172 px** avec le total, puis les membres en pastilles de 54 px.

### `E9` — Finale · rose ⭐ le morceau
Titre display « QUI EST LE PLUS CHOUPI DES FOLOLOWS ? » (82 px, `top: 150`).

- **État d'attente** : pilule crème « Le classement se révèle du dernier au premier » + trois étoiles. Aucun écran vide, jamais.
- **Liste en construction** : chaque appui révèle le suivant **en partant du dernier**. Ligne = pastille de rang (60 px, jaune) + pilule de pseudo + pastille de points. Largeur 900 px, `x = 510`, la k-ième révélée à `y = 880 − k × 86`. Les lignes qui montent au-dessus de `y = 300` s'effacent. Tient 10, 20 ou 40 participants.
- **Bascule vers le podium** : quand il ne reste que trois noms, ils **deviennent** le podium — les mêmes éléments DOM se déplacent vers leur colonne (transform, 620 ms), la pastille de rang disparaît et la largeur passe à 480 px. Ils ne disparaissent jamais pour laisser place à autre chose.
- **Podium** : marches `320 × 430` (1ᵉʳ, `x: 620`), `320 × 330` (2ᵉ, `x: 210`), `320 × 250` (3ᵉ, `x: 1030`), base à `bottom: 60`. Chiffre du rang en Passion One 96 px **en bas de marche**. Remplissage dans l'ordre **3ᵉ, puis 2ᵉ, puis 1ᵉʳ**. Confettis **sur le premier seulement**.
- **Variante duel (2 équipes)** : pas de podium à trois marches. Les deux cartes se placent face à face (`x: 180` et `x: 1020`, largeur 720), la 2ᵉ apparaît d'abord, puis la 1ᵉʳ arrive en `scale(1.2)`.

Barre de commandes : `Suivant`, puis `Terminer`.

### `E10` — Merci · rose
Bandeau d'en-tête en variante `SEE YOU — — NEXT !`, bornes à cerises de part et d'autre (deux disques roses + tiges noires inclinées), damier en bas, titre display « MERCI ! » (230 px).

---

## La barre de commandes (régie uniquement)

Bande de 132 px **sous** le canvas — elle s'ajoute, elle ne pousse ni ne comprime le jeu. À gauche : pilule rose avec le code écran (« E6 · MANCHE 3 ») + une ligne de contexte en Fredoka 24 px gris. À droite, de 1 à 4 contrôles :

| Contrôle | Style |
|---|---|
| Bouton primaire | Pilule jaune `#F9E96B`, hauteur 80 px, contour 7 px, ombre `0 7px 0`, Fredoka 34 px, étoile rose de 36 px débordant en haut à droite |
| Bouton secondaire | Pilule crème, hauteur 76 px, contour 6 px, Fredoka 30 px |
| Champ numérique | Pilule blanche, libellé Fredoka 26 px + boutons ronds − / + de 52 px + valeur Nunito 900 36 px |
| Bascule de vue | Pilule cyan avec le raccourci `V` |

Boutons par écran : E1 aucun · E2 `Démarrer` · E3 champ + `Créer les familles` · E4 `Démarrer` · E5 `Lancer la manche` · E6 `Révéler les réponses` puis `Voir le nombre de points` · E7/E8 `Prochaine manche` · E9 `Suivant` (+ `Terminer` au bout) · E10 `Rejouer`.

**Pilotage clavier** : `→` ou `Espace` = action principale, `V` = bascule antenne/régie.

---

## Mouvement — le critère n°1

> **Rien n'apparaît, ne disparaît ou ne change « comme ça ».** Aucun élément ne surgit sans être arrivé de quelque part, ni ne s'efface sans être parti quelque part. Un changement instantané est un défaut, pas un choix. Cela vaut aussi pour ce qu'on oublie : un compteur qui monte, un libellé de bouton qui change, un titre qui se remplace.

### Trois étages

| Étage | Rôle | Intensité | Actif |
|---|---|---|---|
| 1 · Ambiant | Le plateau respire | Très faible, lent | En permanence |
| 2 · Réactif | Réponse à un événement | Moyenne, courte, localisée | À l'événement |
| 3 · Narratif | Révélation, podium, changement d'écran | Forte, prend la scène | Aux moments clés |

Quand l'étage 3 joue, l'étage 1 se met en retrait. Pas de confettis pendant qu'un titre se pose.

### Étage 1 — boucles ambiantes (aucun écran n'est figé)

Boucles **longues et désynchronisées** pour ne jamais retomber en rythme :

| Boucle | Keyframes | Durée |
|---|---|---|
| Balayage de lumière sur le carrelage | `translateX(−40% → 220%) rotate(16deg)` sur une bande de 46 % de large | 19 / 21 / 23 s selon le fond |
| Damier du bas | `translateX(0 → −160px)`, linéaire, sans couture | 14 s |
| Étoiles à quatre branches | `scale(1 → 1.22) rotate(0 → 45deg)` | 6 à 17 s, jamais synchronisées |
| Bandeau d'en-tête | Les trois mots pulsent l'un après l'autre, `scale(1 → 1.08)` à 94 % du cycle | 9 s, retards 0 / 3 / 6 s |
| Brillance du cadre de scène | `translateX(−120% → 320%)` sur une bande de 22 % | 13 à 17 s, pic à 92 % du cycle |
| Grands titres display | `translateY(0 → −6px) scale(1 → 1.012)` | 7 à 11 s |
| Cases encore cachées | Reflet `translateX(−160% → 260%) skewX(−18deg)` sur le bandeau rose | 9 à 19,5 s, décalées par index |
| Bornes d'arcade | Afficheurs qui changent de valeur (4,2 s) + `segFlick` opacité (7–9 s) ; barres pixel `translateY(0 → −8px)` (3,4 à 6,5 s) ; boutons lumineux `blink` (4,6 à 7,7 s) | — |

### Étage 2 — chaque événement a une réaction visible

| Événement | Réaction | Durée / courbe |
|---|---|---|
| Un joueur rejoint | Sa pastille **entre** (jamais un fondu) : `translateY(46px) scale(.94) → dépassement à −5px → repos` | 500 ms `cubic-bezier(.2,.9,.3,1.1)` |
| Le compteur change | Le nombre **roule** (colonne de deux valeurs, `translateY(0 → −50%)`), la pastille encaisse le coup (`scale .5 → 1.12 → 1`) | roulement 420 ms `cubic-bezier(.22,.9,.28,1.08)` · pop 340 ms |
| Un message arrive | La ligne entre par le bas, les autres se décalent | 340 ms `cubic-bezier(.2,.9,.3,1.1)` |
| Le message contient une bonne réponse | La ligne se met en avant **avant** que la case ne se lève | pop 500 ms, puis levée du bandeau à +480 ms |
| Survol / appui d'un bouton | `translateY(−3px)` + ombre 10 px au survol, `translateY(+5px)` + ombre 2 px à l'appui | 130–140 ms |
| Les points d'une équipe changent | Le nombre roule | 420 ms |
| Bandeau de manche en double | Il ne se remplace pas : il grossit | 500 ms `cubic-bezier(.2,.9,.3,1.1)` |

### Étage 3 — les sept grands moments

1. **Le bandeau qui se lève** ⭐ le geste signature, rejoué jusqu'à 10 fois par manche : court, franc, satisfaisant. `transform-origin: top center` ; `rotateX(0 → −104deg) translateY(−8%)` en **420 ms** `cubic-bezier(.2,.9,.3,1.12)`. La pastille de points arrive **après**, décalée : `scale(0 → 1)`, 340 ms `cubic-bezier(.2,.9,.28,1.3)`, **retard 160 ms**.
2. **La révélation des cases non trouvées** — même geste **en mineur** : **820 ms** `cubic-bezier(.4,.02,.5,1)`, en cascade, **240 ms entre deux cases**, premier départ à +260 ms, sans célébration. C'est une conclusion, pas une fête.
3. **La répartition en équipes** — les pseudos **volent** vers leur colonne : `translate(−260px, 120px) scale(.7) rotate(−8deg) → dépassement → repos`, 620 ms `cubic-bezier(.22,.85,.28,1.06)`, retard `250 ms + colonne × 70 ms + rang × 75 ms`. La colonne elle-même entre en `riseIn` (500 ms, retard 90 ms par colonne).
4. **Le décompte de la finale** — chaque appui fait monter toute la liste d'un cran, le nouveau nom arrive par le bas. Net et régulier : c'est un compte à rebours. 620 ms `cubic-bezier(.2,.85,.3,1.04)`.
5. **La bascule liste → podium** — les trois derniers noms ne disparaissent pas : **ce sont les mêmes éléments** qui se déplacent vers les marches (mêmes clés React / mêmes nœuds DOM). 620 ms, transform + largeur.
6. **L'arrivée sur le podium** — 3ᵉ, puis 2ᵉ, puis 1ᵉʳ, un appui chacun. La marche pousse depuis le sol : `transform-origin: bottom`, `scaleY(0 → 1.05 → 1)`, 500 ms `cubic-bezier(.2,.9,.28,1.06)`. Confettis sur le premier seulement : 26 pièces, `translateY(−80px → 1180px) rotate(0 → 720deg)` + fondu, 2,1 à 3,2 s, retards échelonnés, **puis démontage** (ne jamais laisser tourner en fond).
7. **Chaque changement d'écran** — voir ci-dessous.

### Transition d'écran (signature, réutilisée partout)

Un **volet en damier** balaie l'écran : panneau plein canvas incliné `skewX(−8deg)`, barre noire de 60 px en bord de fuite.

```
t = 0     ms  →  wipeIn  : translateX(−108% → 0)   440 ms  cubic-bezier(.5,0,.3,1)
t = 440   ms  →  l'écran change SOUS le volet, les minuteurs du nouvel écran démarrent
t = 440   ms  →  wipeOut : translateX(0 → 112%)    460 ms  cubic-bezier(.6,0,.35,1)
t = 940   ms  →  volet démonté
```

Contraintes : l'écran ne se vide **jamais** entre deux écrans, la transition couvre le changement ; le **cadre webcam ne bouge jamais et n'est jamais recouvert** (`z-index` au-dessus du volet) — c'est ce qui fait « émission en direct » plutôt que « diaporama » ; le bandeau d'en-tête reste en place lui aussi, il est le fil conducteur.

### Principes de fabrication

- **Décalage systématique** : jamais deux informations en même temps. 60–90 ms entre les éléments d'une liste.
- **Entrées** en ease-out marqué avec un **seul** dépassement (jamais d'oscillation élastique). **Sorties** en ease-in. **Déplacements** en ease-in-out.
- **Les nombres roulent**, ils ne se remplacent jamais.
- **Le mouvement porte le sens** : un déplacement = le même objet a changé de place ; un fondu = le contenu a changé. Ne pas mélanger les deux.
- **Durées** : micro-feedback 150–250 ms · composant 300–500 ms · changement d'écran 700–1000 ms · séquences narratives 2–4 s · boucles ambiantes 8–25 s.

---

## État applicatif

| Clé | Contenu |
|---|---|
| `view` | `'antenne' \| 'regie'` |
| `mode` | `'solo' \| 'famille'` |
| `screen` | `'E1' … 'E10'` |
| `wipe` | `0` (aucune) `\| 1` (entrée du volet) `\| 2` (sortie) — bloque toute navigation tant qu'il est non nul |
| `players[]` | `{ id, name, pts }` — 3 à 40, pseudos Twitch jusqu'à 25 caractères |
| `teamCount` / `teams[]` | 2 à 6 · `{ name, color, ids[], members[], pts }` |
| `round` | 1 à 6 |
| `ans{}` | index de réponse → `{ found, finder }` ou `{ cascade: true }` |
| `phase` | `'play'` (le tchat joue) `\| 'cascade'` (les cases restantes se dévoilent) |
| `chat[]` | `{ id, who, text, hit }`, 7 lignes conservées |
| `finaleN` | nombre de rangs révélés en partant du dernier |
| `podium` | `0` (liste) `\| 1` (3ᵉ posé) `\| 2` (2ᵉ) `\| 3` (1ᵉʳ + confettis) |

**Pièges rencontrés dans le prototype, à ne pas reproduire** :
- Toute mise à jour de `finaleN`, `podium` et `round` doit passer par une **mise à jour fonctionnelle** (`setState(s => …)`). Deux appuis rapprochés sur `Suivant` lus sur un état périmé fusionnent en un seul incrément — et le 1ᵉʳ du podium n'apparaît jamais.
- La bascule de vue doit appliquer le masque et recalculer l'échelle **après** le commit de l'état (ou en passant la vue cible explicitement), sinon le masque est calculé sur l'ancienne vue et le trou webcam ne se perce pas.
- Le remplissage du lobby se calcule **à partir d'un horodatage de départ** (« combien de joueurs auraient dû arriver depuis ? »), pas « un tick = un joueur » : les minuteurs sont ralentis quand l'onglet passe en arrière-plan.

---

## Règles de jeu (pour dimensionner juste)

- **6 manches** par session, **4 à 10 réponses** par question (8 par défaut), points entiers de 1 à 100.
- **Manches doubles** choisies manche par manche à la préparation ; les points affichés sont déjà multipliés.
- **Participants** : 3 à 40. **Équipes** : 2 à 6. On peut rejoindre à tout moment, y compris en cours de partie (affectation automatique à une équipe en mode famille).
- **Reconnaissance des réponses** : une case peut accepter plusieurs mots (`DESSERT/GÂTEAU`). Comparaison **insensible aux accents et au pluriel**, mais le mot doit être exact — pas de tolérance aux fautes de frappe. Prévoir l'affichage d'une case à libellés multiples, plus longue.
- **Égalités** possibles au classement et au podium. Cas limite à gérer : **personne ne trouve rien** sur une manche.
- Les questions et réponses sont saisies à l'avance par la streameuse sur le site de préparation (hors périmètre de ce design).

---

## Assets

Aucune image externe : tout est en CSS et SVG inline. Polices via Google Fonts (Passion One, Fredoka, Nunito) — **à auto-héberger** pour l'overlay OBS, une source navigateur ne doit pas dépendre du réseau au démarrage du live.

Le contenu de démonstration (3 questions, 15 pseudos) est inventé et à remplacer.

## Réglages exposés dans le prototype

`showFinder` (afficher « trouvé par <pseudo> » sur la case révélée) · `rounds` (nombre de manches) · `teamsDefault` (nombre d'équipes par défaut) · `chatEvery` (cadence du tchat simulé, démo uniquement).

## Fichiers

| Fichier | Rôle |
|---|---|
| `prototype/Une famille en or.dc.html` | Le prototype complet : 10 écrans, les deux vues, tout le mouvement |
| `prototype/Roller.dc.html` | Le composant « nombre qui roule » |
| `prototype/support.js` | Runtime du prototype — **référence uniquement**, à ne pas porter |
| `reference/Une famille en or — diaporama source.pdf` | Le diaporama d'origine de la streameuse, qui fixe la direction artistique |

Ouvrir `prototype/Une famille en or.dc.html` dans un navigateur, cliquer `Jouer seul` ou `Jouer en famille`, puis piloter à la flèche droite.

## Points restants à trancher

- Le libellé exact du bouton de fin de manche est provisoire (`Révéler les réponses` / `Voir le nombre de points`).
- Le débordement du lobby au-delà de 27 pastilles se replie sur un compteur « +N autres » — à valider si la chaîne dépasse régulièrement 40 participants.
- Une identité sonore sur le bandeau qui se lève et sur le podium serait un gros plus, hors périmètre de ce design.
