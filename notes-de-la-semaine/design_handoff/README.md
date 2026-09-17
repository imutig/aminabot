# Handoff : Overlay Twitch « Les notes de la semaine »

## Overview

Overlay d'émission Twitch pour un segment récurrent : la streameuse (Amina) et le chat notent la semaine sur 8 critères, de 0 à 10. Le chat vote en tapant un chiffre dans le tchat, Amina donne sa note en direct au clavier, puis l'overlay calcule les moyennes et enchaîne sur trois écrans de résultats (meilleure semaine, pire semaine, classement complet des viewers).

L'overlay est conçu pour être chargé comme **Browser Source 1920×1080 dans OBS**, par‑dessus la source webcam. Il contient un emplacement cam **fixe et transparent** en forme de rectangle nuageux : la streameuse place sa cam une seule fois, elle reste visible pendant toute la séquence.

Direction artistique : « girly » doux et épuré — ciel bleu animé, nuages, cartes blanc chaud à bordures rose pâle, typo arrondie. Pas de néon, pas de dégradés agressifs, pas d'emoji.

## About the Design Files

Le fichier livré dans ce bundle (`Notes de la Semaine.dc.html`) est une **référence de design réalisée en HTML** : un prototype qui montre l'apparence et le comportement attendus, pas du code de production à copier tel quel.

L'objectif est de **recréer ce design dans l'environnement du codebase cible** (React, Vue, Svelte, une app Electron/OBS dock, etc.) en suivant ses conventions, ses composants et ses libs existantes. S'il n'existe pas encore d'environnement, choisir le framework le plus adapté (pour un overlay Twitch : une page statique + un petit runtime JS, ou React/Vite, suffit largement) et y implémenter le design.

Le prototype utilise un runtime de composants interne (`<x-dc>` + classe `Component`) qui **n'a pas à être reproduit** : c'est un simple équivalent de composant à état avec un template. Toute la logique métier (scènes, votes, moyennes, timings) est en JavaScript classique et se transpose directement.

Point technique à conserver tel quel en revanche : la **technique du trou de cam** (masque SVG), décrite en détail plus bas. C'est ce qui permet d'avoir une découpe non rectangulaire réellement transparente dans OBS.

## Fidelity

**High-fidelity (hifi).** Couleurs, typographies, tailles, espacements, timings d'animation et copies sont définitifs. Recréer l'UI au pixel près en utilisant les libs du codebase. Toutes les valeurs exactes sont listées dans « Design Tokens » et par écran ci‑dessous.

Seule zone volontairement laissée libre : le contenu réel des votes (branchement IRC/EventSub). Le prototype simule les votes avec un générateur aléatoire, voir « State Management ».

---

## Canvas & structure globale

- Canvas de design : **1920 × 1080 px**, fond **transparent** (`html, body { background: transparent }`).
- Le prototype scale le canvas pour tenir dans la fenêtre : `scale = min(innerWidth/1920, innerHeight/1080)` appliqué sur un wrapper de 1920×1080 centré (`transform-origin: center`). Dans OBS la source fait exactement 1920×1080, le scale vaut 1. À conserver pour l'aperçu hors OBS.
- Trois zones fixes, jamais déplacées d'une scène à l'autre :

| Zone | Position | Taille |
|---|---|---|
| Fenêtre cam | centre `(568, 436)` | 1010 × 568 (hors festons ; ~1065 × 620 festons compris) |
| Colonne de contenu | `left: 1124` | largeur 756 (marge droite 40) |
| Bande sous la cam | centrée sur x=568, `top: 800` | largeur 1000, hauteur 200 |

- Ordre de painting (du fond vers l'avant) : ciel SVG masqué → colonne de contenu (panneau / hall of fame / classement) → bande sous la cam → rideau de transition SVG masqué → cadre de la cam SVG → panneau de régie (dev).
- Miroir : un flag `camSide` (`"gauche"` par défaut, `"droite"`) inverse horizontalement les trois zones : `camX = 1920 - 568`, `colLeft = 1920 - 1124 - 756`, la bande suit la cam. Aucune autre valeur ne change.

---

## La fenêtre cam (élément central)

### Forme

Un **rectangle festonné** (« rectangle nuageux ») : rectangle 1010 × 568 centré sur l'origine, dont chaque côté est remplacé par une série d'arcs convexes.

- Côtés haut et bas : 10 bosses, corde 101, `r = 60` (saillie ≈ 27.6 px).
- Côtés gauche et droit : 6 bosses, cordes ~94.7, `r = 56` (saillie ≈ 26 px).
- Sens de parcours horaire, `sweep-flag = 1` → bosses vers l'extérieur.
- Les coins restent des cusps entre deux bosses : c'est ce qui donne la lecture « rectangle » et non « blob ».

Path exact (à réutiliser tel quel, coordonnées centrées sur 0,0) :

```
M -505 -284 A 60 60 0 0 1 -404 -284 A 60 60 0 0 1 -303 -284 A 60 60 0 0 1 -202 -284
A 60 60 0 0 1 -101 -284 A 60 60 0 0 1 0 -284 A 60 60 0 0 1 101 -284 A 60 60 0 0 1 202 -284
A 60 60 0 0 1 303 -284 A 60 60 0 0 1 404 -284 A 60 60 0 0 1 505 -284
A 56 56 0 0 1 505 -189 A 56 56 0 0 1 505 -95 A 56 56 0 0 1 505 0 A 56 56 0 0 1 505 95
A 56 56 0 0 1 505 189 A 56 56 0 0 1 505 284
A 60 60 0 0 1 404 284 A 60 60 0 0 1 303 284 A 60 60 0 0 1 202 284 A 60 60 0 0 1 101 284
A 60 60 0 0 1 0 284 A 60 60 0 0 1 -101 284 A 60 60 0 0 1 -202 284 A 60 60 0 0 1 -303 284
A 60 60 0 0 1 -404 284 A 60 60 0 0 1 -505 284
A 56 56 0 0 1 -505 189 A 56 56 0 0 1 -505 95 A 56 56 0 0 1 -505 0 A 56 56 0 0 1 -505 -95
A 56 56 0 0 1 -505 -189 A 56 56 0 0 1 -505 -284 Z
```

Ce path est utilisé **quatre fois**, toujours dans un `<g transform="translate(568 436)">` :
1. dans le masque du ciel (rempli noir),
2. dans le masque du rideau de transition (rempli noir),
3. remplissage du placeholder + label « CAM »,
4. deux passes de contour pour le cadre.

### La découpe transparente (à reproduire fidèlement)

Le fond ne doit pas être un `<div>` : c'est un `<svg viewBox="0 0 1920 1080">` dont tout le contenu est dans un `<g mask="url(#camHoleSky)">`. Le masque contient un rect blanc plein canvas + le path de la cam en noir :

```html
<mask id="camHoleSky" maskUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080">
  <rect x="0" y="0" width="1920" height="1080" fill="#FFFFFF"></rect>
  <g fill="#000000" transform="translate(568 436)">
    <path d="…path ci-dessus…"></path>
  </g>
</mask>
```

Blanc = visible, noir = trou. Résultat : à l'intérieur du feston, rien n'est peint → la page est transparente → OBS laisse voir la webcam placée derrière.

Le **rideau de transition** porte une copie indépendante du même masque (`id="camHoleCurtain"`, géométrie identique), sinon il recouvrirait la cam pendant les balayages. Deux masques distincts plutôt qu'une référence croisée entre deux `<svg>`.

Pièges rencontrés, à éviter :
- **Ne pas utiliser `<use href="#shape">`** pour dupliquer la forme : certains moteurs de rendu/capture perdent l'héritage de `fill` et peignent la forme en noir. Inliner le `<path>` à chaque fois.
- Pour un masque **animé** (si un jour la cam devait bouger), mettre le `transform` en CSS sur le `<g>` du masque avec `transform-box: view-box; transform-origin: 0 0;` et emboîter le contenu qui bouge dans un `<g>` interne pour que la géométrie du masque reste en espace écran. Ici la cam est fixe : un `transform` en attribut suffit.

### Cadre

Deux contours superposés sur le même path, `fill: none`, `stroke-linejoin: round` :

| Passe | Couleur | Épaisseur |
|---|---|---|
| Extérieure (ombre ciel) | `#B7D8F0` | 26 |
| Intérieure (bord nuage) | `#FFFFFF` | 16 |

Le SVG du cadre est `pointer-events: none` et se place **au‑dessus du rideau**, pour que le cadre reste visible même pendant une transition.

### Placeholder

Actif par défaut, désactivable (flag `camPlaceholder`) pour la prod :
- remplissage du path en `#CFE0EE`,
- texte « CAM » centré, `<text x="0" y="26" text-anchor="middle">`, Baloo 2 800, `86px`, `letter-spacing: 10px`, `fill: #93AEC6`,
- groupe en `opacity: 0 | 1`, transition `.4s ease`.

---

## Le ciel

### Dégradé

`linearGradient` vertical (`x1=0 y1=0 x2=0 y2=1`) sur un rect plein canvas :

| Stop | Couleur |
|---|---|
| 0 | `#79BEEC` |
| 0.55 | `#9FD2F2` |
| 1 | `#BFE3F8` |

### Voile d'ambiance

Un second rect plein canvas au‑dessus du dégradé, couleur et opacité pilotées par la scène, transition `opacity 1s ease, fill 1s ease` :

| Scène | fill | opacity |
|---|---|---|
| Défaut | `#FFFFFF` | 0 |
| Meilleure semaine (S6) | `#FFD98A` | 0.22 |
| Pire semaine (S7) | `#6E86A8` | 0.42 |

### Nuages en boucle

Trois couches de parallaxe qui défilent **vers la droite**, en boucle sans couture. Technique : chaque couche est un `<g>` animé de `translateX(-1920px)` → `translateX(0)`, contenant **deux fois** la même tuile de nuages, la seconde décalée de `translate(1920 0)`. Aux deux extrémités du cycle l'image est identique → pas de saut.

```css
@keyframes loopRight { from { transform: translateX(-1920px); } to { transform: translateX(0px); } }
```

| Couche | Durée | Opacité | Nuages (translate, scale, couleurs) |
|---|---|---|---|
| Lointaine | 210s linear infinite | .5 | C `(60,84) .78` `#E3F1FC` · A `(620,36) .9` `#E9F4FD` · B `(1120,120) .85` `#E3F1FC` · A `(1540,54) .72` `#E9F4FD` |
| Médiane | 145s | .8 | B `(170,296) 1.05` · C `(780,232) .95` · A `(1330,318) 1.1` — bord `#C6E3F6`, corps `#F4FAFE` |
| Proche | 98s | 1 | C `(-40,872) 1.3` · A `(700,904) 1.4` · B `(1320,852) 1.45` — bord `#B9DCF3`, corps `#FFFFFF` |

Les couches médiane et proche utilisent le nuage « à bord » : la même silhouette peinte deux fois, une passe couleur de bord puis une passe corps réduite (`translate(0 6) scale(.93~.96)`), ce qui simule un liseré sans stroke.

### Silhouettes de nuages réutilisables

Trois primitives, toujours composées d'un `<rect>` arrondi + des `<circle>` (jamais de path dessiné à la main) :

```
cloudA — viewBox 240×130 : rect x22 y76 w196 h46 rx23 ; circles (72,70,44) (132,56,52) (186,82,36) (42,92,32)
cloudB — viewBox 180×110 : rect x26 y70 w130 h38 rx19 ; circles (62,62,38) (114,54,42) (148,78,28)
cloudC — viewBox 380×150 : rect x26 y94 w330 h48 rx24 ; circles (92,82,54) (176,60,64) (264,76,50) (322,98,38) (48,102,36)
```

Ces trois formes servent partout : nuages de fond, décor du panneau, icônes de critères, bosses du rideau, nuage de pluie, spinner de calcul.

---

## Screens / Views

Le tableau des critères et son en‑tête forment un seul panneau réutilisé par les scènes 1 à 5 ; le hall of fame et le classement sont deux blocs distincts qui prennent la place de la colonne.

### 1. Panneau principal (générique + tableau)

Position : `left: colLeft (1124)`, `width: 756`, `top` variable, transitions `top .8s cubic-bezier(.5,.02,.3,1)`, `opacity .55s`, `transform .7s cubic-bezier(.4,0,.3,1)`.

Carte : fond `#FFFDFB`, bordure `3px solid #EFD3E4`, `border-radius: 36px`, `box-shadow: 0 18px 40px -26px rgba(46,76,104,.55)`, padding variable.

Décor : deux petits nuages en `position: absolute` qui débordent en haut de la carte — cloudA à `left: 5%; top: -54px; 168×91`, cloudB à `right: 7%; top: -42px; 132×81` (bord `#D9EBF8`, corps `#FFFDFB`).

En‑tête :
- Titre « LES NOTES DE LA SEMAINE », Baloo 2 800, `line-height: 1`, `letter-spacing: .4px`, `color: #A8386A`, `text-transform: uppercase`, `text-wrap: balance`.
- Ligne suivante en `display: flex; justify-content: space-between` : pastille de semaine à gauche, en‑têtes de colonnes à droite.
- Pastille semaine : fond `#FFF0F6`, bordure `2px solid #F5C6DC`, texte `#A8386A` 800, `border-radius: 999px`, `white-space: nowrap`. Copie : « Semaine du 24 → 30 juillet » (paramétrable).
- En‑têtes de colonnes : deux blocs de `118px`, centrés, 900, `letter-spacing: 1.4px`, uppercase. « AMINA » en `#BB6690`, « CHAT » en `#7E8FC0`.

Deux variantes de la même carte :

| | Générique (S1) | Tableau (S2–S5) |
|---|---|---|
| `top` | 336 | 56 |
| padding | 38 | 22 |
| taille titre | 68 | 34 |
| taille pastille | 26 | 16 |
| padding pastille | 8 / 22 | 4 / 13 |
| gap en‑tête | 20 | 10 |
| en‑têtes colonnes | masqués (`opacity: 0`) | visibles |
| tableau | absent | présent |

### 2. Ligne de critère

Huit lignes, `gap: 8px`, `margin-top: 14px`.

Structure : `display: flex; align-items: center; gap: 11px; padding: 0 13px; border-radius: 22px; box-sizing: border-box; overflow: hidden`.

Trois états :

| | à venir | actif | terminé |
|---|---|---|---|
| hauteur | 74 | **84** | 74 |
| fond | `#FFFCFD` | `#FFFFFF` | `#FFF9FB` |
| bordure | `2px solid #EFD3E4` | `3px solid #F58EBA` | `2px solid #EFD3E4` |
| ombre | none | `0 12px 26px -18px rgba(233,84,143,.8)` | none |
| décalage x | 0 | `-10px` | 0 |
| animation | — | `breathe 4.6s ease-in-out infinite` (±2px vertical) | — |
| couleur label | `#63505C` | `#3D1730` | `#3D1730` |
| opacité des jauges | 0.42 | 1 | 1 |

Important : la mise en retrait des lignes « à venir » passe par la **couleur du label et l'opacité des jauges**, jamais par une opacité globale (contraste de lecture insuffisant sinon).

Transitions de la ligne : `opacity .5s cubic-bezier(.33,1,.68,1)`, `transform .6s cubic-bezier(.2,1.05,.3,1)`, `background/box-shadow/border-color .5s ease`, `height .55s cubic-bezier(.33,1,.68,1)`.

Contenu de gauche à droite :

1. **Icône** 38×38 : cloudB bicolore + une petite forme blanche `#FFFDFB` par‑dessus, propre à chaque critère (voir tableau des critères).
2. **Bloc texte** (`flex: 1`) : nom du critère 800 `19px`, `white-space: nowrap; text-overflow: ellipsis` ; sous‑ligne de 24px de haut contenant :
   - compteur de votes : pastille `#FFF0F6` / bordure `2px solid #F5D0E1` / `border-radius: 999px` / `padding: 1px 9px` / `white-space: nowrap`, avec un point de 6px (`#E8548F` si la ligne est active et a des votes, sinon `#DFBACE`) et le **nombre brut** (800, 15px, `#A8386A`, `tabular-nums`). Le compteur reste sur une seule ligne quel que soit le nombre de votes — pas de retour à la ligne quand on passe à 300.
   - verdict optionnel : `border-radius: 999px; padding: 1px 10px`, 800 15px. « même avis ! » → texte `#2F7A5E` sur `#DDF2E9` ; « gros écart » et « le chat n'a pas voté » → texte `#A8386A` sur `#FFEAF2`.
3. **Jauge Amina**, largeur 118, colonne centrée `gap: 5px` : note en Baloo 2 800 `32px` `tabular-nums` (`#E8548F`, ou `#D3AEC1` tant qu'elle n'a pas voté ; affiche `·` sur la ligne active, `–` sinon) + barre de 13px, `border-radius: 999px`, fond `#FFF0F6`, `box-shadow: inset 0 0 0 2px #F3CCDF`, hachures `repeating-linear-gradient(90deg, rgba(168,56,106,.13) 0 2px, transparent 2px 10%)`, remplissage `#F58EBA` (`width: note*10%`, transition `.5s cubic-bezier(.22,1,.36,1)`).
4. **Jauge Chat**, largeur 118 : même structure, moyenne à une décimale, couleur selon le barème (voir tokens), fond de barre `#EFF5FD`, `inset 0 0 0 2px #D3E3F5`, hachures `rgba(46,76,104,.12)`.

### 3. Ligne « Moyenne générale »

Apparaît en bas du panneau quand le calcul est fini (S5) : fond `#FFF0F6`, bordure `3px solid #F5C6DC`, `border-radius: 22px`, `padding: 10px 16px`, `margin-top: 12px`, animation `stampIn .6s cubic-bezier(.22,1.25,.4,1) both`. Libellé Baloo 2 800 `23px` uppercase `#A8386A` ; deux valeurs de 118px de large, Baloo 2 800 `38px` — Amina `#E8548F`, chat `#5D77B0`.

### 4. Bande sous la cam

Conteneur `left: stripLeft, top: 800, width: 1000, height: 200`. Deux blocs superposés en `position: absolute` qui se croisent en fondu (`opacity`, `transform: translateY(26px → 0)`, transitions `.55s / .7s cubic-bezier(.2,1.05,.3,1)`).

**Rappel de vote** (S2–S4) : pilule `#FFFDFB`, bordure `3px solid #EFD3E4`, `border-radius: 999px`, `padding: 15px 26px`, `box-shadow: 0 14px 32px -22px rgba(46,76,104,.7)`, animation `hintNudge 16s ease-in-out infinite` (petit sursaut toutes les 16s). Contient une pastille « 0 → 10 » (Baloo 2 800 26px, `#FFF0F6` / `2px solid #F5C6DC` / `#A8386A`) et le texte « Note ta semaine : tape un chiffre de 0 à 10 dans le chat » (800, 26px, `#3D1730`, `nowrap`).

**Calcul** (S5) : carte `border-radius: 34px`, même fond/bordure/ombre. À gauche un spinner de 72px composé de deux cloudB (`#F5C6DC` et `#CFE0F5`) en `spinSlow 12s linear infinite`. À droite « Calcul des notes… » (Baloo 2 800 34px `#A8386A`) suivi d'un nombre qui défile aléatoirement (`#BB6690`, `tabular-nums`), puis une barre de progression de 15px (fond `#FFF0F6`, `inset 0 0 0 2px #F3CCDF`, remplissage `#F58EBA`, `transition: width .3s linear`).

### 5. Hall of fame (S6 meilleure / S7 pire)

Bloc `left: colLeft; top: 190; width: 756`. Entrée : `opacity` + `translateY(30px → 0)`, `.6s / .75s cubic-bezier(.2,1.05,.3,1)`.

Carte : `border-radius: 40px`, `padding: 34px 34px 38px`, `text-align: center`, `box-shadow: 0 22px 46px -30px rgba(46,76,104,.6)`, animation `floatUp 10s ease-in-out infinite` (±9px), transitions de couleur `1s ease`.

Révélation en trois temps (déclenchées à +1150 / +1900 / +2750 ms après le balayage) :
- étape 1 : pastille « HALL OF FAME » + titre + sous‑titre (`opacity 0→1`, `translateY(18px→0)`, délai `.06s` sur le titre) ;
- étape 2 : pseudos (`translateY(14px→0)`) ;
- étape 3 : score (`opacity`, `scale(.7→1)` en `.65s cubic-bezier(.2,1.35,.4,1)`) + pied de carte.

Typographie : pastille 900 18px `letter-spacing: 2.4px` uppercase, `padding: 6px 18px`, `border-radius: 999px` · titre Baloo 2 800 54px · sous‑titre 700 21px · pseudos Baloo 2 800 38px (30px s'il y en a plusieurs), `border-radius: 20px`, `padding: 9px 20px`, `gap: 12px`, `flex-wrap: wrap` · score Baloo 2 800 124px `tabular-nums` avec le « /10 » en 54px `opacity: .5` · pied 800 17px `letter-spacing: 1.6px` uppercase.

Deux thèmes :

| | Meilleure semaine | Pire semaine |
|---|---|---|
| fond carte | `#FFFDFB` | `#F5F9FF` |
| bordure | `4px solid #EFC97F` | `4px solid #BFD5EE` |
| pastille | `#FBE3B9` / `2px #E5B863` / `#8A5A12` | `#DCE7F5` / `2px #B4C9E2` / `#42607F` |
| titre | `#A8386A` | `#3F5D7C` |
| sous‑titre & pied | `#B4658C` | `#6B85A5` |
| pseudo | `#FFF6E6` / `3px #EFC97F` / `#8A5A12` | `#E9F0F9` / `3px #BFD5EE` / `#3F5D7C` |
| score | `#DC9F2E` | `#89A3C1` |

Copies : titre « Meilleure semaine » / « Pire semaine » · sous‑titre « Celui qui a kiffé sa semaine » / « Celui qui a passé une semaine de merde » · pied « moyenne sur 8 critères », « ex æquo · moyenne sur 8 critères » s'il y a égalité, « on t'envoie du courage » pour la pire semaine. Ton cash assumé, pas de tirets cadratins dans les copies.

Décors :
- **Rayons** (meilleure semaine) : 8 barres de 16×466, `transform-origin: 50% 0`, `rotate(i*45+12)`, `linear-gradient(180deg, rgba(255,214,102,.42), transparent)`, conteneur de 940×940 centré en `spinSlow 72s linear infinite`.
- **Confettis** (meilleure semaine, après l'étape 3) : 16 éléments, `left: 3 + (i*6.3)%94 %`, 8–14 × 8–13, moitié ronds moitié `3px`, couleurs `#FFD2E3 #FBE3B9 #DCD1F7 #FFDCC2`, `fallConf 3.6–5.6s cubic-bezier(.35,.1,.6,1)` en boucle avec délais échelonnés, conteneur `overflow: hidden; height: 720px`.
- **Scintillements** : 6 points de 7–13px aux positions `left [2,96,6,93,1,98]%` / `top [16,24,74,66,44,88]%`, `twinkle 2.6–4s`.
- **Pluie** (pire semaine) : un cloudA gris de 300×162 (`#8FA8C6` bord, `#B4C9E0` corps) au‑dessus de la carte en `floatUp 6.5s`, plus 12 gouttes de 6×17 `#8FA8C6` en `fallDrop 1.7–2.6s` avec délais échelonnés.

### 6. Classement (S8)

Bloc `left: colLeft; top: 62; width: 756`.

- Titre « CLASSEMENT DE LA SEMAINE », centré, Baloo 2 800 44px, `line-height: 1.05`, uppercase, `#A8386A`.
- Sous‑titre « N viewers ont noté leur semaine », centré, 700 19px, `#4E6E96`.
- **Podium** : 3 cartes `flex: 1 1 0; min-width: 0`, `gap: 12px`, `border-radius: 24px`, `padding: 14px 10px 16px`, `box-shadow: 0 14px 30px -22px rgba(46,76,104,.6)`. La première est surélevée de `-10px`, fond `#FFFAEE`, bordure `#EFC97F` ; les autres `#FFFDFB` / `#EFD3E4`. Badge rond de 40px (rang 1 `#FBE3B9`/`2px #E5B863`/`#8A5A12`, rang 2 `#FFD2E3`/`#F7B4CD`/`#A8386A`, rang 3 `#DCD1F7`/`#C3B2EE`/`#5B4A9B`), pseudo Baloo 2 800 21px tronqué, score Baloo 2 800 42px (`#C9911F` pour le premier, sinon couleur du barème).
- **Liste défilante** : carte `#FFFDFB`, bordure `3px solid #EFD3E4`, `border-radius: 28px`, `padding: 14px 16px`, hauteur 542, `overflow: hidden`. Fondu haut/bas via `mask-image: linear-gradient(180deg, transparent 0, #000 46px, #000 calc(100% - 46px), transparent)`. Défilement : `transform: translateY(-overflow)` avec `transition: transform Ns linear`, vitesse ≈ 30 px/s, démarré 2850 ms après l'apparition.
- **Rang de liste** : hauteur 42, `gap: 10px`, `padding: 0 12px`, `border-radius: 14px`, fond alterné `#FFFDFB` / `#FFF9FB`. Colonnes : rang `#N` (46px, 900 17px, `#BB6690`) · pseudo (700 19px, `#3D1730`, ellipsis) · mini‑barre 84×9 (fond `#EFF5FD`, `inset 0 0 0 2px #D3E3F5`, remplissage couleur du barème) · note (54px, Baloo 2 800 23px, `tabular-nums`).

### 7. Rideau de transition

SVG plein canvas, `pointer-events: none`, masqué par `#camHoleCurtain`.

Contenu : un `<rect x="-1930" y="-200" width="1930" height="1480" fill="#EAF5FE">` suivi de bosses de nuages qui débordent sur son bord droit (cloudA `(-150,-10) 1.85`, cloudC `(-260,290) 1.55`, cloudA `(-130,600) 1.95`, cloudB `(-110,880) 2.4`, toutes en `#EAF5FE`) et de deux nuages blancs semi‑transparents à l'intérieur pour la profondeur (`opacity .55` et `.45`).

Le tout est translaté horizontalement : `-420` (hors écran à gauche) → `1930` (couvre tout) → `3920` (sorti à droite), `transition: transform .85s cubic-bezier(.6,.02,.3,1)`.

Séquence d'un balayage : on passe à `1930`, on attend 900 ms, on **change le contenu de la colonne pendant que l'écran est couvert**, 320 ms de pause, on part à `3920`, puis après 950 ms on repositionne discrètement à `-420`.

### 8. Panneau de régie (dev uniquement)

`left: 24; bottom: 24`, fond `rgba(30,52,74,.9)`, `border-radius: 18px`, `padding: 13px 15px`, texte `#EAF5FE`. Contient le label de scène courante, 9 boutons S1–S9 (38×32, `border-radius: 10px`, actif `#F58EBA` sur texte `#2A3F58`), les boutons « Critère suivant ⏎ » / « Rejouer » / « Masquer (H) », et le rappel des raccourcis. Masquable par la touche `H` et par un flag `showDev`.

---

## Interactions & Behavior

### Machine à états des scènes

Ordre de navigation : `s1 → s2 → s3 → s5 → s6 → s7 → s8 → s9 → (reprise en s1)`. `s4` n'est pas une étape de navigation, c'est l'état transitoire « Amina vient de valider ».

| Scène | Rôle | Sortie |
|---|---|---|
| S1 | Générique : grande carte titre, tableau absent | auto à +3200 ms |
| S2 | Le tableau arrive : 8 lignes en cascade (`+420 + i*78 ms`, `opacity 0→1`, `translateY(18→0)`), rappel de vote à +1100 | auto à +1700 → S3(0) |
| S3 | Un critère actif, les votes du chat arrivent | **manuelle** |
| S4 | Amina a validé : tampon sur sa note, verdict | +1200 ms → la ligne passe en « terminé » |
| S5 | Calcul : bande de calcul 9 s, puis moyenne générale à +9800, bande retirée à +11200 | auto à +13400 → S6 |
| S6 | Meilleure semaine (balayage + révélation 3 temps) | auto à +8400 → S7 |
| S7 | Pire semaine (pas de balayage, transition de thème du ciel et de la carte en 1s) | auto à +7600 → S8 |
| S8 | Classement (balayage, podium, liste défilante) | auto à la fin du défilement +2400 ms → S9 |
| S9 | Sortie : tout se retire, balayage, reset complet | +2900 ms → S1 |

Tous les délais passent par un helper `after(ms, fn)` qui divise par un facteur `speed` (0.5×–2×) et enregistre le timer pour pouvoir tout annuler au changement de scène. Chaque `go(scene)` commence par annuler les timers en cours et l'intervalle de votes.

### Avance des critères : manuelle

C'est le point de pilotage principal en direct. **Aucun passage automatique au critère suivant par défaut** (un flag `autoAdvance`, désactivé par défaut, permet de rejouer la séquence en démo).

Raccourcis clavier :

| Touche | Effet |
|---|---|
| `0`–`9` | Amina valide sa note sur le critère actif |
| `A` | Amina valide un 10 |
| `Entrée` | Critère suivant (valide d'abord la note par défaut si Amina n'a pas encore voté) |
| `←` / `→` | Scène précédente / suivante |
| `H` | Afficher/masquer la régie |

### Validation d'une note (S3 → S4)

1. On arrête l'arrivée des votes et on annule les timers.
2. On enregistre la note, on verrouille la ligne.
3. Le nombre d'Amina apparaît en `stampIn .55s cubic-bezier(.2,1.3,.4,1)` (scale 1.7 → 0.96 → 1) avec une onde : cercle de 58px, `3px solid #F58EBA`, `ring .75s cubic-bezier(.22,1,.36,1) forwards` (scale .6 → 2.1, opacity .4 → 0). Une seule onde, discrète.
4. Verdict calculé sur l'écart avec la moyenne du chat : `< 0.35` → « même avis ! » ; `≥ 2.6` → « gros écart » ; aucun vote → « le chat n'a pas voté » ; sinon rien.
5. Après 1200 ms la ligne passe en « terminé » et attend `Entrée`.

### Animations récapitulées

| Nom | Usage | Détail |
|---|---|---|
| `loopRight` | nuages de fond | `translateX(-1920px → 0)`, 98s / 145s / 210s linear infinite |
| `breathe` | ligne active | ±2px vertical, 4.6s ease-in-out |
| `stampIn` | note d'Amina, moyenne générale | scale 1.7 → .96 → 1, .55–.6s |
| `ring` | onde de validation | scale .6 → 2.1, opacity .4 → 0, .75s |
| `waitSweep` | barre d'attente d'Amina | bloc de 24% qui balaye, 2.2s cubic-bezier(.45,0,.55,1) infinite |
| `spinSlow` | spinner de calcul, rayons | rotation 360°, 12s / 72s linear |
| `hintNudge` | rappel de vote | sursaut de -6px + rotation ±.4°, une fois par cycle de 16s |
| `floatUp` | carte hall of fame, nuage de pluie | ±9px, 6.5–10s |
| `fallConf` | confettis | chute + rotation 520°, 3.6–5.6s |
| `fallDrop` | gouttes | chute de 180px + étirement, 1.7–2.6s |
| `twinkle` | scintillements | opacity 0→.85, scale .6→1 |

### Easings de référence

- Déplacements de panneaux / rideau : `cubic-bezier(.6,.02,.3,1)` et `cubic-bezier(.5,.02,.3,1)`.
- Entrées d'éléments : `cubic-bezier(.2,1.05,.3,1)` (léger dépassement).
- Rebonds marqués (score, tampon) : `cubic-bezier(.2,1.35,.4,1)`.
- Fondus : `ease`, 0.4–0.6s.
- Barres de jauges : `cubic-bezier(.22,1,.36,1)` (Amina), `cubic-bezier(.22,.9,.24,1)` (chat).

---

## State Management

### État global

```
scene            's1'…'s9'
mode             'intro' | 'table'   (variante du panneau)
active           index du critère en cours, -1 sinon
rows[8]          état par critère
curtain          -420 | 1930 | 3920
calcIn/calcRun   bande de calcul visible / calcul en cours
calcPct          0–100
calcScramble     nombre affiché pendant le calcul
showGlobal       moyenne générale visible
hof              null | 'best' | 'worst'
hofStage         0–3 (révélation)
showRank/rankIn  classement monté / entré
scrollY, scrollDur  défilement de la liste
hintIn           rappel de vote visible
panelOut         panneau principal retiré
viewers[]        { name, avg, rank }
fit              facteur d'échelle du canvas
```

### État par critère (`rows[i]`)

```
votes[]   notes reçues du chat
sum, avg  somme et moyenne réelles
disp      moyenne affichée, lissée
amina     note d'Amina ou null
landed    timestamp de validation (fenêtre d'animation de 720 ms)
locked    votes clos
state     'upcoming' | 'active' | 'done'
verdict   texte du verdict
pulse     échelle du compteur de votes (1 ou 1.07)
entered   ligne entrée en scène
```

### Boucle d'animation

Un unique `setInterval` à 60 ms :
- lisse `disp` vers `avg` (`disp += (avg - disp) * 0.22`) → la moyenne du chat monte en douceur au lieu de sauter ;
- retombe `pulse` à 1 (le compteur de votes fait un petit pop à chaque salve) ;
- fait avancer la progression du calcul et tire un nombre aléatoire pour l'effet de défilement, jusqu'à afficher la vraie moyenne dans les 6 derniers % ;
- ne déclenche un rendu que si quelque chose a bougé.

### Données à remplacer par du réel

Tout ce qui suit est de la **simulation à brancher sur les vraies sources** :

- `incomingVotes(i)` : ajoute 1 à 3 votes toutes les 170 ms autour d'une valeur de base par critère (`base + (random-0.5)*5.4`, borné 0–10), et remplace un vote existant quand le nombre de votants est atteint. À remplacer par les messages du tchat (un vote par utilisateur, dernier vote prioritaire, plage 0–10).
- `buildViewers()` : génère N pseudos (`voterCount`, 100 par défaut, 5–300) avec une moyenne aléatoire, trie, force une égalité en tête (pour tester l'affichage ex æquo) et calcule les rangs avec égalités (`1, 1, 3, …`). À remplacer par les moyennes réelles par viewer.
- `fillAll()` : remplit les critères non notés quand on saute directement à une scène de résultats — utile en régie, inutile en prod.
- `AMINA_NOTES` : notes de démo `[4, 8, 6, 5, 3, 6, 9, 7]`, utilisées uniquement par `Entrée` sans saisie et par le mode auto.
- Le critère « Sport » a un délai d'arrivée des votes de 2400 ms au lieu de 280 ms, pour donner un gag de « personne ne vote ».

### Règles métier à conserver

- **Ex æquo** : tous les pseudos à égalité en tête sont affichés côte à côte sur la carte (jusqu'à 3), le pied de carte passe à « ex æquo · moyenne sur 8 critères », et les rangs de la liste sautent les places occupées.
- **Moyenne générale** : moyenne des 8 notes d'Amina d'un côté, des 8 moyennes du chat de l'autre. C'est la conclusion du segment, affichée à la fin du calcul.
- **Pseudos longs** : troncature avec `…` — 15 caractères sur la carte hall of fame, 11 sur le podium, 20 dans la liste.
- Une valeur absente s'affiche `–` (jamais `0`), `·` quand on attend une valeur imminente, `—` pour une moyenne impossible à calculer.

### Paramètres exposés

| Nom | Type | Défaut | Effet |
|---|---|---|---|
| `camSide` | `gauche` / `droite` | `gauche` | Miroir complet de la mise en page |
| `camPlaceholder` | booléen | `true` | Affiche le remplissage « CAM » (à désactiver en prod) |
| `autoAdvance` | booléen | `false` | Enchaîne les critères tout seul (démo) |
| `weekLabel` | texte | « Semaine du 24 → 30 juillet » | Pastille de semaine |
| `aminaName` | texte | « Amina » | En‑tête de la colonne de gauche |
| `voterCount` | entier 5–300 | 100 | Nombre de viewers simulés |
| `speed` | 0.5–2 | 1 | Facteur global sur tous les délais |
| `showDev` | booléen | `true` | Panneau de régie |

---

## Design Tokens

### Couleurs — roses (marque)

| Rôle | Hex |
|---|---|
| Rose profond (titres) | `#A8386A` |
| Rose vif (note d'Amina, moyenne) | `#E8548F` |
| Rose moyen (remplissages, accents) | `#F58EBA` |
| Rose secondaire (labels, spinner) | `#BB6690` |
| Bordure rose | `#EFD3E4` |
| Bordure rose pastille | `#F5C6DC` |
| Bordure rose claire | `#F5D0E1`, `#F3CCDF` |
| Fond rose très clair | `#FFF0F6` |
| Fond de ligne (terminée) | `#FFF9FB` |
| Fond de ligne (à venir) | `#FFFCFD` |
| Blanc chaud (cartes) | `#FFFDFB` |
| Point de compteur inactif | `#DFBACE` |
| Note d'Amina en attente | `#D3AEC1` |

### Couleurs — ciel et bleus

| Rôle | Hex |
|---|---|
| Ciel haut / milieu / bas | `#79BEEC` / `#9FD2F2` / `#BFE3F8` |
| Nuages lointains | `#E3F1FC`, `#E9F4FD` |
| Nuages médians (bord / corps) | `#C6E3F6` / `#F4FAFE` |
| Nuages proches (bord / corps) | `#B9DCF3` / `#FFFFFF` |
| Cadre cam (extérieur / intérieur) | `#B7D8F0` / `#FFFFFF` |
| Placeholder cam (fond / texte) | `#CFE0EE` / `#93AEC6` |
| Rideau | `#EAF5FE` |
| Décor de panneau | `#D9EBF8` |
| Barre du chat (fond / bordure) | `#EFF5FD` / `#D3E3F5` |
| En‑tête « CHAT » | `#7E8FC0` |
| Moyenne chat | `#5D77B0` |
| Sous‑titre de classement | `#4E6E96` |
| Voile « pire semaine » | `#6E86A8` à 42% |
| Voile « meilleure semaine » | `#FFD98A` à 22% |

### Couleurs — texte

| Rôle | Hex |
|---|---|
| Texte principal | `#3D1730` |
| Label de critère à venir | `#63505C` |
| Verdict positif (texte / fond) | `#2F7A5E` / `#DDF2E9` |
| Verdict neutre (texte / fond) | `#A8386A` / `#FFEAF2` |

### Couleurs — barème de notes

Appliqué à la moyenne du chat, aux mini‑barres et aux scores du classement :

| Plage | Hex |
|---|---|
| `< 2.5` | `#7E9BC4` |
| `2.5 – 4.5` | `#9A93CE` |
| `4.5 – 6.5` | `#F09BC0` |
| `6.5 – 8.5` | `#EF5F94` |
| `≥ 8.5` | `#DC9F2E` |

### Couleurs — or (hall of fame / podium)

`#DC9F2E` (score) · `#C9911F` (score du premier) · `#EFC97F` (bordure) · `#E5B863` (bordure de badge) · `#FBE3B9` (fond de badge) · `#FFF6E6` (fond de pseudo) · `#FFFAEE` (carte du premier) · `#8A5A12` (texte).

### Les 8 critères

| # | Nom | Teinte corps | Teinte bord | Marqueur blanc | Base de simulation |
|---|---|---|---|---|---|
| 1 | Sommeil | `#DCD1F7` | `#C3B2EE` | rond 15×15 | 4.2 |
| 2 | Vie sociale | `#FFD2E3` | `#F9B4CD` | pilule 19×8, `-18°` | 7.6 |
| 3 | Motivation | `#FFDCC2` | `#F7C09B` | carré 14×14, `45°` | 6.1 |
| 4 | Alimentation | `#CFEBDE` | `#A9D8C3` | dôme 17×11 | 5.4 |
| 5 | Sport | `#CFE0FA` | `#A9C4EE` | barre 8×17 | 3.3 |
| 6 | Charge mentale | `#E4D6FA` | `#C9B4EE` | losange arrondi 13×13 | 5.8 |
| 7 | Petits plaisirs | `#FFD9E9` | `#F9BAD3` | pilule 18×9 | 8.3 |
| 8 | Semaine globale | `#FBE3B9` | `#F0CB86` | pétale 15×15, `45°` | 6.7 |

### Typographie

Deux familles Google Fonts :
- **Baloo 2** (600/700/800) — titres, chiffres, pseudos, tout ce qui doit être rond et affirmé.
- **Nunito** (600/700/800/900) — labels, textes courants, interface.

Échelle utilisée : 124 / 68 / 54 / 44 / 42 / 38 / 34 / 32 / 30 / 26 / 23 / 21 / 19 / 18 / 17 / 15 / 14 px. Minimum absolu 14px (les pastilles de la régie), 15px pour tout contenu à l'antenne.

Tous les nombres utilisent `font-variant-numeric: tabular-nums` pour éviter les sauts de largeur pendant l'animation.

### Rayons

`999px` (pilules) · 40 (fenêtre hall of fame) · 36 (panneau) · 34 (bande de calcul) · 28 (liste de classement) · 24 (podium) · 22 (lignes, moyenne générale) · 20 (pseudo hall of fame) · 18 (régie) · 14 (rang de liste).

### Ombres

| Usage | Valeur |
|---|---|
| Panneau principal | `0 18px 40px -26px rgba(46,76,104,.55)` |
| Liste de classement | `0 18px 40px -28px rgba(46,76,104,.55)` |
| Carte hall of fame | `0 22px 46px -30px rgba(46,76,104,.6)` |
| Podium | `0 14px 30px -22px rgba(46,76,104,.6)` |
| Bande sous la cam | `0 14px 32px -22px rgba(46,76,104,.7)` |
| Ligne active | `0 12px 26px -18px rgba(233,84,143,.8)` |
| Fond de barre (Amina) | `inset 0 0 0 2px #F3CCDF` |
| Fond de barre (chat) | `inset 0 0 0 2px #D3E3F5` |

### Espacements

Gaps : 5 / 6 / 8 / 10 / 11 / 12 / 14 / 16 / 20 / 22 px. Paddings de cartes : 14 / 22 / 34 / 38 px. Marges de canvas : 34–40 px sur les bords.

---

## Assets

Aucun asset binaire. Tout est vectoriel et inline :
- les nuages sont des groupes SVG de `<rect>` + `<circle>` (trois primitives réutilisées partout) ;
- la fenêtre cam est un `<path>` d'arcs ;
- les marqueurs d'icônes de critères sont des `<div>` avec `border-radius` et `rotate` ;
- pas d'icône bitmap, pas d'emoji.

Polices : Baloo 2 et Nunito via Google Fonts. Dans le codebase cible, préférer un auto‑hébergement (`@font-face` + woff2) pour éviter une dépendance réseau dans OBS.

## Files

- `Notes de la Semaine.dc.html` — le prototype complet (template + logique). Autonome : il s'ouvre directement dans un navigateur, `support.js` mis à part.
- `support.js` — runtime du prototype (template + rendu). **Ne pas porter** : c'est un simple équivalent de composant à état, à remplacer par le framework du codebase.

## Notes d'implémentation pour OBS

- Browser Source 1920×1080, « Shutdown source when not visible » désactivé (sinon les animations et l'état des votes repartent de zéro), « Refresh browser when scene becomes active » désactivé.
- Le fond doit rester transparent : ne pas ajouter de couleur sur `html`/`body`.
- Placer la source webcam **sous** la source overlay, cadrée dans la zone du feston (centre `(568, 436)`, zone utile ~1010×568 ; le feston mord d'environ 27px sur les bords).
- Désactiver `camPlaceholder` en production.
- Les raccourcis clavier supposent que la Browser Source a le focus ; pour un usage en direct, prévoir plutôt un canal de contrôle (WebSocket local, ou OBS `obs-websocket` + hotkeys) plutôt que de compter sur le focus de la page.
