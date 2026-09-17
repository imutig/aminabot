# Spec design - « Les Notes de la Semaine »
### Overlay Twitch animé pour la chaîne saysayouu

---

## 1. Le contexte en une phrase

Chaque vendredi, la streameuse note sa semaine sur 7–8 critères. À chaque critère, le chat note **sa propre semaine** sur le même critère. L'overlay compare en direct « la semaine d'Amina » vs « la semaine du chat », puis célèbre le viewer qui a passé la meilleure semaine et console celui qui a passé la pire.

C'est un **segment récurrent d'une émission**, pas un widget. Il doit avoir un générique, un rythme, des reveals. La référence de qualité, c'est une séquence de résultats d'émission TV - pas un plugin OBS.

---

## 2. Contraintes techniques (à respecter absolument)

| Contrainte | Détail |
|---|---|
| **Support** | Page web unique affichée en *Browser Source* dans OBS. Canvas de référence **1920 × 1080**, fond **transparent**. |
| **Implémentable en DOM/CSS/JS** | Tout doit être faisable en HTML + CSS + JS vanilla. Pas de vidéo, pas de Lottie externe, pas de WebGL. Formes en CSS/SVG inline. |
| **Zéro interaction** | Personne ne clique jamais. Pas de hover, pas de focus, pas de bouton. C'est une surface d'affichage pure, pilotée par des événements du chat. |
| **Encombrement limité** | L'overlay **ne doit pas manger l'écran** pendant la phase de vote. La streameuse reste la star. Voir le système de scène (§4). |
| **Lisibilité en streaming compressé** | Twitch écrase le bitrate. Donc : pas de texte fin (<18px, poids <500), pas de pastel-sur-pastel, pas de dégradés subtils sur grandes surfaces (ça fait des bandes), pas de grain fin animé. Tout texte doit passer un contraste ≥ 4.5:1 contre son propre fond. |
| **Sur n'importe quel arrière-plan** | Le fond derrière l'overlay est imprévisible (gameplay, Just Chatting, vidéo). Chaque bloc doit porter son propre fond opaque ou semi-opaque + ombre portée pour se détacher. |

---

## 3. Direction artistique

**Mots-clés : girly, mignon, nuages, rose, doux, aérien, premium.**

L'écueil à éviter : le « kawaii cheap » - Comic Sans, emojis collés, stickers pixelisés, arc-en-ciel saturé. On veut du **mignon bien designé** : une palette resserrée, des formes rondes cohérentes, des ombres douces, une typo soignée. Pense « papeterie japonaise haut de gamme » plutôt que « fond d'écran MSN ».

### Palette
Construire autour de :
- **Un rose principal** saturé et chaleureux, qui sert d'accent et de couleur de marque.
- **Deux roses secondaires** : un très pâle (fonds de cartes) et un plus profond (texte, contours, ombres colorées).
- **Un ciel** : bleu très pâle / lavande, pour les fonds de scène et les nuages - c'est ce qui empêche le tout-rose d'être écœurant.
- **Une couleur chaude neutre** : crème / blanc cassé, pour les surfaces qui portent du texte.
- **Un accent secondaire** : pêche ou lavande, pour les états spéciaux.
- **Un doré** réservé exclusivement au Hall of Fame « meilleure semaine ».
- **Un texte foncé** : ne surtout pas utiliser du noir pur - un prune / brun-rosé très foncé. C'est lui qui garantit la lisibilité.

Prévoir aussi une **échelle de couleur pour les notes** (0 → 10) : du bleu-gris mélancolique pour les notes basses vers le rose vif puis le doré pour les notes hautes. Elle doit rester lisible en 5 paliers, pas en dégradé continu illisible.

### Typographie
- **Titres / gros nombres** : une display ronde, généreuse, avec du caractère. Épaisse. C'est elle qui donne le ton « émission ».
- **Corps / labels** : une sans-serif géométrique arrondie, très lisible en petit.
- **Les nombres sont des héros.** Les notes doivent être énormes, en chiffres tabulaires (largeur fixe) pour ne pas gigoter quand la valeur change.

### Motifs
- **Les nuages sont le système**, pas une décoration. Ils servent de : conteneurs (cartes en forme de nuage), transitions (rideau de nuages), fond (parallaxe), et podium (le gagnant est posé sur un nuage).
- Prévoir une **famille de 4–5 formes de nuages** réutilisables, du petit au très large, cohérentes entre elles.
- Étoiles / cœurs / scintillements : autorisés mais **rares et petits**. Ce sont des ponctuations, pas un motif de fond.
- Éviter : arc-en-ciels, licornes, visages kawaii sur les nuages (ça vieillit mal et ça distrait du contenu).

### Profondeur
Ombres portées douces, larges et **colorées** (rose-violet, jamais grises). 2–3 plans de parallaxe pour les nuages de fond. Un léger flou sur le plan arrière pour créer de la profondeur de champ.

---

## 4. Le système de scène - la pièce maîtresse

L'overlay n'est **pas** figé à un endroit. Il **habite** trois positions et se déplace physiquement de l'une à l'autre. C'est le cœur de l'effet « émission ».

### Position A - `DOCK` (phase de vote, l'essentiel du temps)
Panneau vertical ancré sur un côté de l'écran, largeur ~460–520px, marges généreuses. Compact, discret, il laisse la scène respirer. C'est là que vit le tableau des critères pendant tout le vote.

### Position B - `HERO` (moments forts)
L'élément quitte le dock, **voyage vers le centre** et grandit. Le reste de l'écran est voilé par un **scrim rose translucide** (jamais noir - ça tuerait l'ambiance). Utilisé pour : le calcul des notes, les deux Hall of Fame, le classement final.

### Position C - `HINT` (bandeau discret)
Une petite bande, en bas, qui rappelle comment participer. Présente uniquement pendant la phase de vote.

### La règle d'or du mouvement
Quand on passe de `DOCK` à `HERO`, l'élément **ne fait pas un fondu**. Il **se déplace et se transforme** - c'est le même objet physique qui voyage. Le fondu enchaîné est interdit entre deux états du même contenu ; il est réservé aux changements de contenu.

Les nuages de fond **se réorganisent autour** de l'élément pendant qu'il voyage : ils s'écartent pour lui faire de la place, comme un rideau.

---

## 5. Les composants à concevoir

Ces briques sont réutilisées partout. Elles doivent être designées **avant** les écrans.

### 5.1 La jauge de note `/10` ⭐ composant le plus important
Représente une note de 0 à 10. Deux variantes visuelles à distinguer clairement au premier coup d'œil :
- **Variante « Amina »** (la streameuse)
- **Variante « Chat »** (la moyenne des viewers)

Chaque jauge a besoin de :
- Un **état vide** (en attente) qui suggère la graduation sur 10 sans être bruyant.
- Un **état en remplissage** (le chat vote en direct) - la barre bouge en permanence.
- Un **état verrouillé** (note définitive) - visuellement plus « solide », plus affirmée.
- La **valeur numérique** affichée à côté, en gros. Format : 1 décimale pour le chat (ex. `7.4`), entier pour Amina (ex. `8`).

⚠️ **Piège à traiter dans le design** : la moyenne du chat change à chaque vote. Si la barre saute brutalement, ça fait cheap et ça donne le mal de mer. Il faut spécifier un **lissage** : chaque changement de valeur est une transition amortie d'environ 400ms, jamais un saut. Même le nombre doit rouler vers sa nouvelle valeur, pas se remplacer sèchement.

### 5.2 La ligne de critère
Une ligne du tableau. Contient : une **icône nuage** propre au critère, le **nom du critère**, la jauge Amina, la jauge Chat.

Trois états à designer, très distincts :
| État | Traitement |
|---|---|
| `À VENIR` | Effacé, désaturé, en retrait. On devine qu'il existe, sans plus. |
| `EN COURS` | **Fortement mis en avant** : agrandi, décollé du panneau, ombre plus marquée, accent coloré. C'est le seul point d'attention de l'écran. |
| `TERMINÉ` | Résolu, lisible, les deux notes verrouillées côte à côte. Présent mais calme. |

### 5.3 Le compteur de votes
Petit bloc rattaché au critère en cours : nombre de viewers ayant voté. Doit **réagir visuellement** à chaque nouveau vote (une pulsation légère, un scintillement) - c'est ce qui donne la sensation de vie et prouve au chat que ses messages arrivent.

### 5.4 Le bandeau de participation
Rappelle la règle : *« Note ta semaine - tape un chiffre de 0 à 10 dans le chat »*. Discret, en bas, avec une petite animation d'attention toutes les ~15s.

### 5.5 La carte Hall of Fame
Grande carte centrale présentant un viewer : son **pseudo**, sa **note moyenne** en très grand, et un traitement d'ambiance. Deux déclinaisons opposées :
- **Meilleure semaine** : solaire, doré, nuage lumineux, rayons, confettis, scintillements. Célébration.
- **Pire semaine** : bleuté, petit nuage de pluie au-dessus de la carte, gouttes qui tombent doucement. Le ton est **tendre et drôle, jamais méchant** - on console, on ne se moque pas.

### 5.6 La ligne de classement
Ligne compacte pour le tableau final des viewers : rang, pseudo, note moyenne. Le podium (1-2-3) a un traitement distinct du reste.

### 5.7 Le rideau de nuages (transition signature)
Un système de nuages qui balaie l'écran pour masquer un changement de séquence. C'est **la** transition récurrente de l'émission - elle doit être immédiatement reconnaissable et réutilisée à chaque passage de séquence majeure.

---

## 6. Les séquences à designer

Neuf états. Pour chacun : la composition, la hiérarchie de lecture, et **comment on y entre / comment on en sort**.

---

### `S1` - Générique d'ouverture · ~3s · position HERO
L'overlay naît. Titre **« LES NOTES DE LA SEMAINE »** + la date de la semaine. Les nuages arrivent, le titre se pose.
→ **Sortie** : le titre se réduit et **voyage vers le dock** pour devenir l'en-tête du tableau. C'est une transformation continue, pas une coupe.

### `S2` - Le tableau · position DOCK
Les 7–8 critères apparaissent en cascade (stagger), tous à l'état `À VENIR`. En-tête du panneau avec deux colonnes clairement identifiées : **Amina** / **Chat**.
Le bandeau `HINT` apparaît en bas.

### `S3` - Critère en cours · position DOCK
Une ligne passe en état `EN COURS`. Les votes arrivent : la jauge Chat se remplit en continu, le compteur monte, la valeur roule.
La jauge Amina reste en **état d'attente** - visuellement en suspens, elle « attend » sa note.
C'est l'état le plus vu de tout le segment : il doit rester agréable pendant plusieurs minutes sans fatiguer.

### `S4` - Amina valide · ~1.2s · position DOCK
Sa note **atterrit avec impact** (un « tampon » qui se pose, avec un léger rebond et une onde de choc douce). Les deux notes se verrouillent côte à côte. Un micro-feedback si l'écart entre les deux notes est grand ou si elles sont identiques - un petit moment de sens.
→ **Sortie** : la ligne retombe en `TERMINÉ`, et le **focus voyage vers la ligne suivante** qui monte en `EN COURS`. Ce déplacement du focus doit être fluide et guider l'œil.

*(S3 → S4 boucle 7–8 fois.)*

### `S5` - Calcul des notes · 10s · DOCK → HERO
Après la dernière note : **rideau de nuages**, et le tableau **quitte le dock pour le centre**, en grand. Tableau complet des 7–8 critères avec toutes les notes.
Un indicateur **« calcul des notes… »** occupe la scène - il doit être joli et rythmé, pas un spinner générique. Suggestion : des nuages qui tournent lentement, des chiffres qui défilent, une barre de progression douce calée sur les 10 secondes.
C'est un **moment de suspense volontaire** : on fait attendre avant la révélation.

### `S6` - Hall of Fame · Meilleure semaine · position HERO
Reveal célébratoire. Le pseudo et la note arrivent **en décalé** (le titre du prix d'abord, puis le pseudo, puis la note qui explose). Confettis, rayons dorés, scintillements.
Titre suggéré : *« Meilleure semaine »* / sous-titre *« Celui qui a kiffé sa semaine »*.

### `S7` - Hall of Fame · Pire semaine · position HERO
Bascule d'ambiance : du doré au bleuté. Le petit nuage de pluie arrive. Même structure de reveal en décalé.
Titre suggéré : *« Pire semaine »* / sous-titre *« Celui qui a passé une semaine de merde »*.
→ La transition S6 → S7 doit être un **vrai changement d'ambiance** (température de couleur, lumière), pas juste un changement de texte.

### `S8` - Classement individuel · position HERO
Tableau de tous les viewers avec leur moyenne. Podium mis en avant en haut, puis la liste.
**Défilement automatique** si la liste dépasse la hauteur : à concevoir avec un dégradé de fondu en haut et en bas, une vitesse lente et régulière, et un comportement propre pour 10 comme pour 200 viewers.

### `S9` - Sortie
Tout s'en va. Les nuages emportent l'overlay. L'écran redevient vide. Ne pas bâcler : une fin nette fait partie de la qualité perçue.

---

## 7. Le système de mouvement (priorité n°1)

Le client a insisté : **la fluidité est le critère de réussite du projet**. Une spec de motion explicite est attendue, pas juste des écrans statiques.

### Principes
1. **Rien n'est jamais parfaitement immobile.** Les nuages de fond dérivent en permanence, en parallaxe lente (plusieurs vitesses selon le plan). C'est ce qui fait qu'un overlay est « vivant » plutôt que « collé ».
2. **Toujours décaler l'entrée des éléments (stagger).** Jamais deux informations qui arrivent en même temps : l'œil ne sait pas où regarder. Titre → pseudo → note. ~60–80ms entre les lignes d'une liste.
3. **Jamais de linéaire.** Entrées en ease-out marqué (arrivée franche puis décélération douce), sorties en ease-in (départ doux puis accélération), déplacements en ease-in-out.
4. **Les entrées célébratoires ont un léger dépassement** (overshoot / rebond) - c'est ce qui donne le côté joyeux. Mais un seul rebond, discret. Jamais d'effet élastique qui oscille.
5. **Le mouvement porte le sens.** Un déplacement = « le même objet a changé de place ». Un fondu = « le contenu a changé ». Ne pas mélanger.
6. **Durées** : micro-feedback ~150–250ms · transitions de composant ~300–500ms · voyages de scène ~700–1000ms · séquences narratives (reveals) 2–4s.

### Ce qu'il faut livrer côté motion
Pour **chaque transition entre séquences** (S1→S2, S3→S4, S4→S3 suivant, S5→S6, S6→S7, S7→S8, S8→S9) :
- ce qui bouge, dans quel ordre, avec quel décalage
- durée et courbe d'easing
- ce qui reste à l'écran pendant la transition (continuité) - l'écran ne doit **jamais** se vider entre deux séquences

Plus les **animations perpétuelles** : dérive des nuages, respiration du critère actif, pulsation du compteur de votes, scintillements.

---

## 8. Détails de données (pour dimensionner correctement)

- **Échelle** : 0 à 10. Votes des viewers = entiers. Moyenne du chat = 1 décimale.
- **Un viewer = un vote par critère**, c'est le **dernier** message qui compte (il peut se corriger). Le design doit donc supporter une moyenne qui *baisse*, pas seulement qui monte.
- **Volume** : prévoir de 5 à 300 votants. Le classement final (S8) doit tenir dans les deux cas.
- **Pseudos Twitch** : jusqu'à 25 caractères, casse variable, chiffres et underscores. Prévoir le comportement pour les pseudos longs (troncature ? réduction de taille ?).
- **Critères** : 7 à 8, noms **à confirmer**. Concevoir en supposant des labels de 8 à 22 caractères (ex. « Sommeil », « Vie sociale », « Motivation », « Alimentation »). Chaque critère a sa propre icône nuage.
- **Égalités possibles** au Hall of Fame - prévoir le cas où plusieurs viewers sont à égalité.
- **Cas limite : zéro vote** sur un critère. Prévoir l'état « le chat n'a pas voté ».

---

## 9. Livrables attendus

1. **Le système de design** : palette complète avec rôles, échelle typographique, ombres, rayons, échelle de couleur des notes, famille de nuages. Sous forme de tokens réutilisables.
2. **Les 7 composants** du §5, dans tous leurs états.
3. **Les 9 séquences** du §6, en écrans composés.
4. **La spec de motion** du §7 : le tableau des transitions, et les courbes/durées en valeurs concrètes et implémentables.
5. **Un prototype animé** de la séquence complète si possible - c'est le seul moyen de juger la fluidité, qui est le critère n°1.

---

## 10. Points ouverts

- Le côté du dock (gauche ou droite) dépend de la scène OBS d'Amina - à trancher, mais concevoir de façon symétrisable.
- La liste définitive des 7–8 critères et leurs icônes.
- Faut-il afficher la moyenne générale d'Amina vs celle du chat en fin de tableau (S5) ? *Recommandation : oui, c'est la conclusion naturelle du segment.*
- Un son / une identité sonore serait un énorme plus sur les reveals, mais hors périmètre de ce design.
