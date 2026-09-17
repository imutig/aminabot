# Spec design — « Une famille en or »
### Jeu Twitch : site de pilotage + overlay OBS, pour la chaîne saysayouu

---

## 1. Le jeu en une page

La streameuse prépare ses questions à l'avance sur le site. En live, elle lance une
partie ; les viewers rejoignent en écrivant **« moi »** dans le tchat. Une session
compte **6 manches**. À chaque manche, une question s'affiche avec ses réponses
cachées sous des bandeaux : dès qu'un viewer tape une bonne réponse dans le tchat,
le bandeau se lève et révèle la réponse et ses points. À la fin, un classement se
révèle du dernier au premier, et se termine sur un podium.

Deux modes :
- **Solo** — chacun pour soi, les points vont à celui qui trouve.
- **En famille** — les joueurs sont répartis au hasard en équipes, les points vont
  à l'équipe de celui qui trouve.

On peut rejoindre **à tout moment**, même en cours de partie (et on est affecté à
une équipe automatiquement en mode famille).

> ### ⚠️ À lire avant tout le reste
> **Ce projet est un plateau de télévision, pas un site web.** Le mouvement est le
> critère de réussite n°1, avant la mise en page et avant la couleur.
> Rien ne doit jamais apparaître ni changer « comme ça ». Même les écrans sans
> action doivent être vivants. La section **§7** n'est pas une annexe de finition :
> c'est le cœur de la commande.

---

## 2. Les deux vues — point d'architecture le plus important

Un **seul design**, rendu de deux façons. Ce n'est pas deux maquettes : c'est la
même, avec une bande de commandes en plus.

| | **Antenne** (Browser Source OBS) | **Régie** (navigateur de la streameuse) |
|---|---|---|
| Le jeu | identique | identique, **au pixel près** |
| Zone webcam | **trou transparent**, la webcam est derrière dans OBS | cadre repère avec la mention « CAM » |
| Barre de commandes | **absente** | présente, en bas |
| Interaction | aucune | tous les boutons cliquables |

**Règle absolue : rien au-dessus de la barre de commandes ne doit bouger d'une vue
à l'autre.** La barre s'ajoute en bas, elle ne pousse ni ne comprime le jeu. Si la
streameuse voit un élément 12 px plus haut que le public, tout le repérage OBS est
faux.

Conséquence pour la maquette : **tous les boutons de pilotage dessinés dans le
diaporama** (`Démarrer`, `Créer les familles`, `Voir le nombre de points`,
`Prochaine manche`, `Suivant`, le champ `Nombre de familles`) **descendent dans
cette barre de commandes**. Ils ne sont pas dans la zone de jeu.

À concevoir donc : **la barre de commandes**, un élément qui n'existe pas dans le
diaporama. Elle doit rester dans la charte, être lisible d'un coup d'œil en plein
live, et supporter de 1 à 4 boutons + parfois un champ numérique.

---

## 3. Contraintes techniques

| Contrainte | Détail |
|---|---|
| **Canvas** | **1920 × 1080**. Fond **transparent** en vue antenne. |
| **Implémentable en DOM/CSS/JS** | Pas de vidéo, pas de librairie d'animation externe. Formes en CSS/SVG inline. |
| **Trou webcam** | Découpe réellement transparente : `<svg>` plein canvas + `<mask>` (rect blanc + forme de la découpe en noir). **Ne pas utiliser `<use href>`** pour dupliquer la forme, certains moteurs de capture perdent l'héritage de `fill` et peignent la forme en noir — inliner le `<path>` à chaque fois. |
| **Lisibilité en streaming compressé** | Twitch écrase le bitrate. Pas de texte fin, pas de dégradé subtil sur grande surface, contraste ≥ 4.5:1 pour tout texte. Le style à gros contours noirs joue déjà en notre faveur. |
| **Sur fond imprévisible** | En antenne l'overlay est posé sur la scène OBS. Chaque bloc porte son propre fond opaque. |

---

## 4. Direction artistique

Le diaporama fixe déjà la direction, et elle est bonne. À systématiser, pas à
réinventer.

**Y2K / arcade kawaii.** Contours noirs épais façon sticker, grandes typographies
display condensées à double contour, carrelage en fond, damiers, étoiles à quatre
branches, bornes d'arcade, pastilles très arrondies avec des étoiles qui débordent.

### Palette
Extraire les valeurs exactes du diaporama et en faire des tokens nommés :
- **Rose vif** (fonds de cadres, titres, bandeaux) — la couleur de marque
- **Rose clair / rose pastille** (fonds de carrelage, pastilles de pseudos)
- **Crème** — le fond de toutes les cartes de contenu. C'est lui qui porte le texte.
- **Jaune pâle** — boutons, panneau tchat, compteurs
- **Cyan** et **bleu** — écrans famille et écrans de points
- **Orange** et **orange pâle** — lobby solo, équipe 2
- **Vert pâle** — équipe 1, cadre webcam
- **Violet** — podium, écran de fin
- **Noir** — contours, systématique, épaisseur constante

Prévoir aussi une **suite de couleurs d'équipes** (au moins 4 : vert pâle, orange
pâle, puis deux autres dans la même famille) — le diaporama n'en montre que 2 mais
le nombre d'équipes est réglable.

### Code couleur des fonds (validé)
| Écran | Fond |
|---|---|
| Titre, Vous êtes prêts, La manche, Finale, Merci | **rose** |
| Lobby solo | **orange** |
| Lobby famille, Composition des familles, Points solo, Points famille | **cyan** |

### Typographie
- **Display** : condensée, très grasse, à double contour (l'effet du titre
  « UN FAMILLE EN OR » et de « VOUS ÊTES PRÊTS ? »). Réservée aux grands titres.
- **Titres de section** : grasse arrondie, plus sage (« Les familles », « Les points »).
- **Texte courant / pastilles** : sans-serif grasse, très lisible en petit.
- Les nombres (points, compteurs) en chiffres tabulaires, ils changent en direct.

### Anti-patterns
Pas d'emoji. Pas de néon ni de glow. Pas de dégradés agressifs. Ne pas diluer les
contours noirs : c'est la signature, elle doit être constante partout.

---

## 5. Composants à concevoir

Ces briques sont réutilisées d'un écran à l'autre. À faire **avant** les écrans.

### 5.1 Le cadre de scène
Le grand cadre rose à coins arrondis qui contient la carte crème, avec les étoiles
qui débordent aux angles. Présent sur presque tous les écrans. Doit accepter un
titre optionnel dans sa bordure haute (« Les familles », « Les points »).

### 5.2 Le bandeau d'en-tête
`LET'S PLAY — GAME — TOGETHER`, en haut, pleine largeur. Deux variantes : la pilule
pleine (écran titre) et la version posée directement sur le fond (écrans de jeu).
Une troisième pour la fin : `SEE YOU — NEXT!`.

### 5.3 La pastille de pseudo ⭐ composant le plus réutilisé
Pilule rose avec le pseudo en gras et une grappe d'étoiles qui déborde à droite.
États à prévoir :
- **normal** (lobby, listes)
- **avec points** — une pastille ronde jaune accolée (« 42 POINTS »)
- **qui vient d'arriver** — le joueur vient de rejoindre, doit se remarquer
- **pseudo long** — les pseudos Twitch vont jusqu'à 25 caractères, prévoir la
  troncature ou la réduction

### 5.4 La case de réponse ⭐ composant central du jeu
Une case du plateau. **Quatre états, tous à designer** :

| État | Ce qu'on voit |
|---|---|
| `CACHÉE` | Bandeau rose plein, aucune information |
| `TROUVÉE` | Le bandeau s'est levé : réponse en majuscules + tiret + points. C'est le moment de fête du jeu. |
| `RÉVÉLÉE EN FIN DE MANCHE` | Personne ne l'a trouvée, on la dévoile quand même. **Doit se distinguer nettement d'une case trouvée** — plus terne, sans célébration. |
| `VIDE` | Si la question a moins de cases que la grille, la case n'existe pas (voir grille adaptative). |

**Proposition à valider** : afficher le **pseudo de celui qui a trouvé** en petit
sur la case révélée. Ça récompense le viewer et ça rend le tableau lisible en fin
de manche. Facile à retirer si ça alourdit.

### 5.5 La grille de réponses — adaptative
**De 4 à 10 réponses**, 8 par défaut. Toujours **2 colonnes**, le nombre de lignes
s'adapte (4 → 2×2, 6 → 2×3, 8 → 2×4, 10 → 2×5). Nombre impair : la colonne de
gauche prend la case en plus.

Ordre de remplissage : réponses **triées par points décroissants**, remplies
**colonne par colonne** (toute la colonne de gauche, puis la droite) — c'est ce que
montre le diaporama.

Les cases grandissent quand il y en a moins : une grille de 4 doit remplir l'espace,
pas laisser un grand vide. Donner les tailles pour 4, 6, 8 et 10.

### 5.6 Le bandeau de manche
En bas du plateau, pleine largeur. **Deux états** :
- `MANCHE POINTS NORMAUX`
- `MANCHE POINTS DOUBLES` — nettement plus énergique, on doit le voir sans lire

### 5.7 Le panneau tchat
Carte jaune pâle sur le côté droit, présente uniquement sur les écrans de jeu
(la manche, les points, la finale) — pas sur les lobbies, faute de place. Affiche
les messages du tchat qui défilent. Prévoir la mise en avant d'un message qui
contient une bonne réponse.

### 5.8 Le compteur de participants
Pastille ronde jaune, en haut à droite du cadre, avec le nombre. Doit réagir quand
quelqu'un rejoint.

### 5.9 La colonne d'équipe
Carte colorée avec le nom de l'équipe et ses membres. Une couleur par équipe.
Deux variantes : sans points (composition) et avec le total en grosse pastille
ronde (écran des points).

### 5.10 Le bouton
Pilule jaune pâle à contour noir. Variantes : primaire (l'action principale),
secondaire, et le champ numérique (`Nombre de familles`). Ils vivront dans la barre
de commandes, donc uniquement en vue régie.

### 5.11 La barre de commandes (nouveau, absent du diaporama)
Voir §2. Bande basse, dans la charte, contient de 1 à 4 boutons et parfois un champ.
Doit rester lisible et cliquable vite, en plein live.

### 5.12 Le cadre webcam
Position et taille **fixes sur tous les écrans**, en bas à droite. En antenne :
découpe transparente. En régie : cadre repère.

---

## 6. Les 10 écrans

### `E1` — Écran titre · fond rose
Bornes d'arcade de part et d'autre, afficheurs à segments, damier en bas, titre
display **« UNE FAMILLE EN OR »** *(le diaporama écrit « UN », c'est une coquille)*.
Deux boutons : `Jouer seul` et `Jouer en famille`.
→ Ici les deux boutons sont **le contenu** de l'écran, pas de la régie : ils restent
au centre. Mais ils ne sont cliquables qu'en vue régie.

### `E2` — Lobby solo · fond orange
Cadre de scène, titre **« Écris "moi" dans le tchat pour participer »**, compteur de
participants en haut à droite, grille de pastilles de pseudos (3 colonnes).
Barre de commandes : `Démarrer`.
→ Concevoir le remplissage : de 0 à ~40 pseudos. Prévoir ce qui se passe quand ça
déborde, et l'état vide (personne n'a encore rejoint).

### `E3` — Lobby famille · fond cyan
Identique à E2.
Barre de commandes : champ `Nombre de familles` + `Créer les familles`.

### `E4` — Composition des familles · fond cyan
Titre « Les familles » dans la bordure du cadre. Une colonne par équipe, remplie au
hasard par l'ordinateur.
→ **Doit tenir de 2 à 4 équipes.** Le diaporama n'en montre que 2 : donner aussi la
mise en page à 3 et à 4.
Barre de commandes : `Démarrer`.

### `E5` — « Vous êtes prêts ? » · fond rose
Écran de bascule, titre display plein cadre. Passage obligé avant la première manche.

### `E6` — La manche · fond rose ⭐ écran principal
La question dans une carte crème en haut, la grille de réponses au centre, le
panneau tchat à droite, le bandeau de manche en bas, la webcam en bas à droite.
Barre de commandes : `Voir le nombre de points`.

C'est l'écran le plus vu de la session : il doit rester agréable plusieurs minutes.
→ Prévoir l'enchaînement de fin de manche : au premier appui, **les cases non
trouvées se révèlent** ; il faut réappuyer pour aller aux points. Donc le bouton a
**deux libellés successifs** — à écrire (proposition : `Révéler les réponses`, puis
`Voir le nombre de points`).

### `E7` — Points solo · fond cyan
Titre « Les points ». Pastilles de pseudos avec leur pastille ronde de points à côté.
Barre de commandes : `Prochaine manche`.
→ Trier par points décroissants. Prévoir de 3 à 40 joueurs.

### `E8` — Points famille · fond cyan
Titre « Les familles ». Colonnes d'équipes avec le total en grosse pastille ronde
au centre, face à face.
Barre de commandes : `Prochaine manche`.
→ Tenir de 2 à 4 équipes.

### `E9` — Finale · fond rose ⭐ le morceau
Titre display **« QUI EST LE PLUS CHOUPI DES FOLOLOWS ? »**.

Le classement se révèle **du dernier au premier**, un par un, sur appui (flèche
droite). La liste se construit **du bas vers le haut**. Quand il ne reste que les
trois premiers, l'affichage bascule sur le **podium**, qui se remplit dans l'ordre
**3ᵉ, puis 2ᵉ, puis 1ᵉʳ**, avec confettis.

C'est la séquence la plus difficile du projet. Il faut concevoir :
1. l'état « liste en cours de remplissage » (avec 10, 20, 40 participants),
2. la **bascule** liste → podium, qui doit être fluide et lisible,
3. le podium à 3 marches qui se remplit,
4. l'état final complet.

Barre de commandes : `Suivant`.

⚠️ **En mode famille, un podium à 3 marches n'a pas de sens avec 2 équipes.**
À concevoir : une variante « duel » pour 2 équipes, et le podium normal à partir de 3.

### `E10` — Merci · fond rose
Bandeau `SEE YOU — NEXT!`, bornes d'arcade à cerises, titre display **« MERCI ! »**.

---

## 7. Mouvement — le critère n°1 du projet

Le diaporama est statique par nature, mais **ce n'est pas un site, c'est un plateau
de jeu télévisé**. Le mouvement n'est pas une finition qu'on ajoute à la fin : c'est
la moitié du travail, et c'est là-dessus que le résultat sera jugé.

### 7.1 La loi d'airain

> **Rien n'apparaît, ne disparaît ou ne change « comme ça ».**
> Aucun élément ne doit surgir sans être arrivé de quelque part, ni s'effacer sans
> être parti quelque part. Un changement instantané est un défaut, pas un choix.

Cela vaut pour tout, y compris ce qu'on oublie d'habitude : un compteur qui monte,
un libellé de bouton qui change, une case qui se vide, un titre qui se remplace,
un écran qui se substitue à un autre.

### 7.2 Trois étages de mouvement

C'est la discipline qui sépare « vivant » de « sapin de Noël ». Chaque animation
appartient à un étage, et les étages ne se marchent pas dessus.

| Étage | Rôle | Intensité | Toujours actif ? |
|---|---|---|---|
| **1 · Ambiant** | Le plateau respire. On ne le regarde pas, on le ressent. | Très faible, lent, jamais net | **Oui, en permanence** |
| **2 · Réactif** | Réponse immédiate à un événement (un vote, un clic, un joueur qui arrive) | Moyenne, courte, localisée | À l'événement |
| **3 · Narratif** | Les grands moments : révélation, podium, changement d'écran | Forte, elle prend la scène | Aux moments clés |

**Règle** : quand l'étage 3 joue, l'étage 1 se met en retrait (ralentit ou
s'atténue). On ne veut pas de confettis pendant qu'un titre se pose.

### 7.3 Étage 1 — le plateau ne s'arrête jamais

**Il n'existe aucun écran figé dans ce jeu**, y compris ceux sans action
(« Vous êtes prêts ? », « Merci », un lobby vide). Chacun doit avoir sa boucle de
fond. À concevoir :

- **Le carrelage** de fond : très légère respiration, ou une lumière qui balaie
  lentement en diagonale.
- **Le damier** du bas : défilement horizontal lent et continu, en boucle sans
  couture.
- **Les étoiles à quatre branches** : scintillement décalé, jamais synchronisé.
- **Les bornes d'arcade** (E1, E10) : les afficheurs à segments changent de valeur,
  les écrans jouent une animation pixel, les cerises tournent, le bouton lumineux
  clignote lentement.
- **Le bandeau d'en-tête** `LET'S PLAY — GAME — TOGETHER` : le texte défile en
  boucle, ou les trois mots pulsent l'un après l'autre.
- **Le cadre de scène** : une brillance qui parcourt la bordure de temps en temps.
- **Les grands titres display** : très léger flottement ou pulsation d'échelle
  (1 à 2 %, pas plus).
- **Les cases encore cachées** : le bandeau rose n'est pas mort, il a un reflet qui
  passe dessus de loin en loin — il donne envie qu'on le lève.

Ces boucles doivent être **longues et désynchronisées** (8 s, 13 s, 21 s…) pour ne
jamais retomber en rythme et devenir hypnotiques.

### 7.4 Étage 2 — tout événement a une réaction visible

| Événement | Réaction attendue |
|---|---|
| Un joueur rejoint | Sa pastille arrive (pas de fondu : elle **entre**), le compteur roule d'un cran et pulse |
| Un message arrive dans le tchat | La ligne entre par le bas, les autres se décalent |
| Un message contient une bonne réponse | La ligne se met en avant avant même que la case ne se lève |
| Survol / appui d'un bouton (régie) | Réponse immédiate, ≤ 150 ms |
| Les points d'une équipe changent | Le nombre **roule**, la pastille encaisse le coup |
| Le bandeau de manche passe en double | Il ne se remplace pas : il se retourne, ou grossit |

### 7.5 Étage 3 — les sept grands moments

Chacun est une petite séquence à chorégraphier, pas une transition.

1. **Le bandeau qui se lève** ⭐ — *le* geste signature. Il se rejoue jusqu'à 10 fois
   par manche : il doit être court, franc, satisfaisant, et **ne jamais lasser**.
   Penser au bandeau qui bascule ou coulisse, à l'impact quand la réponse se pose,
   à la pastille de points qui arrive juste après (décalée, pas en même temps).
2. **La révélation des cases non trouvées** — même geste, mais **en mode mineur** :
   plus lent, en cascade, sans célébration. C'est une conclusion, pas une fête. Le
   contraste avec le point 1 doit être évident.
3. **La répartition en équipes** — les pseudos quittent la liste commune et
   **volent** vers leur colonne. C'est un moment gratuit et très payant.
4. **Le décompte de la finale** — chaque appui fait monter toute la liste d'un cran.
   Le nouveau nom arrive par le bas. Le mouvement doit être net et régulier : c'est
   un compte à rebours, il faut de la tension.
5. **La bascule liste → podium** — le moment le plus difficile du projet. Les trois
   derniers noms ne doivent pas disparaître pour laisser place au podium : ils
   **deviennent** le podium.
6. **L'arrivée sur le podium** — 3ᵉ, puis 2ᵉ, puis 1ᵉʳ, chacun avec son impact.
   Confettis sur le premier seulement.
7. **Chaque changement d'écran** — voir ci-dessous.

### 7.6 Les changements d'écran

**Aucun écran ne remplace un autre par un fondu.** Il faut une **transition
signature** récurrente, reconnaissable, réutilisée à chaque passage — c'est elle qui
donne l'unité d'une émission.

Pistes dans l'esprit arcade : un volet en damier qui balaie, un rideau qui tombe
comme une porte de borne, un zoom-écran de jeu vidéo, un balayage de carrelage.

Contraintes :
- L'écran ne doit **jamais** se vider entre deux écrans : la transition couvre le
  changement.
- Le **cadre webcam ne bouge jamais et n'est jamais recouvert** — la streameuse
  reste visible pendant les transitions. C'est ce qui fait « émission en direct »
  plutôt que « diaporama ».
- Le bandeau d'en-tête reste en place lui aussi : il est le fil conducteur.

### 7.7 Principes de fabrication

- **Décalage systématique** (stagger). Jamais deux informations en même temps :
  le lecteur ne sait pas où regarder. 60–90 ms entre les éléments d'une liste.
- **Entrées** en ease-out marqué avec un léger dépassement (un seul rebond, jamais
  d'oscillation élastique). **Sorties** en ease-in. **Déplacements** en ease-in-out.
- **Les nombres roulent**, ils ne se remplacent jamais. Compteurs, points, totaux.
- **Le mouvement porte le sens** : un déplacement = le même objet a changé de place ;
  un fondu = le contenu a changé. Ne pas mélanger les deux.
- **Durées** : micro-feedback 150–250 ms · composant 300–500 ms · changement d'écran
  700–1000 ms · séquences narratives 2–4 s · boucles ambiantes 8–25 s.

### 7.8 Contrainte de performance (à ne pas négliger)

L'overlay tourne **dans OBS, pendant que la machine encode le live**. Une animation
gourmande fait tomber des frames sur le stream, ce qui est bien pire que pas
d'animation du tout.

- N'animer que **`transform` et `opacity`** pour tout ce qui est permanent.
  Ne pas animer en boucle `width`, `height`, `top`, `left`, `margin`, `filter` ou
  `box-shadow` : ils forcent un recalcul de mise en page à chaque image.
- Les boucles ambiantes doivent rester **peu nombreuses et peu coûteuses** : viser
  une dizaine d'éléments animés en permanence, pas deux cents scintillements.
- Les effets lourds (confettis, particules) sont réservés aux **moments narratifs**
  et doivent s'arrêter une fois joués, pas tourner en fond indéfiniment.
- Pas de `filter: blur()` animé sur de grandes surfaces.

---

## 8. Données et règles (pour dimensionner juste)

- **6 manches** par session.
- **4 à 10 réponses** par question, 8 par défaut.
- Points par réponse : entiers, 1 à 100 (le diaporama montre 2 à 10).
- **Manches doubles** : choisies manche par manche à la préparation.
- **Participants** : prévoir de 3 à 40 joueurs. Pseudos Twitch jusqu'à 25 caractères.
- **Équipes** : de 2 à 4.
- **Reconnaissance des réponses** : une case peut accepter plusieurs mots
  (« DESSERT/GATEAU »). Comparaison **insensible aux accents et au pluriel**, mais
  le mot doit être exact — pas de tolérance aux fautes de frappe. *(Impact design :
  prévoir l'affichage d'une case à libellés multiples, qui est plus long.)*
- **Égalités** possibles au classement et au podium.
- Cas limite : **personne ne trouve rien** sur une manche.

---

## 9. Livrables attendus

1. **Le système de design** : palette complète avec rôles, échelle typographique,
   épaisseurs de contour, rayons, ombres, motifs (carrelage, damier, étoiles),
   couleurs d'équipes. En tokens réutilisables.
2. **Les 12 composants** du §5, dans tous leurs états.
3. **Les 10 écrans** du §6, **chacun dans ses deux vues** (antenne / régie).
4. **Les variantes de nombre** : grille à 4/6/8/10 réponses, 2/3/4 équipes.
5. **La spec de mouvement complète** du §7 : pour chaque écran, l'inventaire de ses
   boucles ambiantes ; pour chaque événement, sa réaction ; pour chaque séquence
   narrative, le déroulé image par image. En durées et courbes concrètes,
   implémentables telles quelles.
6. **Un prototype animé** — attendu, pas optionnel. Des images fixes ne permettent
   pas de juger ce qui fait ou défait ce projet. Au minimum :
   le bandeau qui se lève, la transition entre deux écrans, et la séquence finale
   liste → podium.

### Comment ce travail sera jugé

Écran par écran, une seule question : **est-ce que ça ressemble à une émission,
ou à un site web qui change de page ?** Si un élément apparaît sans être arrivé de
quelque part, c'est raté. Si un écran d'attente est parfaitement immobile, c'est
raté.

---

## 10. Points ouverts

- **La finale en mode famille** : podium à 3 marches impossible avec 2 équipes.
  Variante « duel » à concevoir.
- **Le pseudo du trouveur** affiché sur la case révélée : à valider ou à écarter.
- **Le libellé du bouton de fin de manche**, qui change entre le premier et le
  second appui.
- **Le nombre maximum d'équipes** : je pars sur 4, à confirmer.
- **Le débordement du lobby** au-delà de ~40 pseudos.
- Une **identité sonore** sur le bandeau qui se lève et sur le podium serait un
  énorme plus, mais c'est hors périmètre de ce design.
