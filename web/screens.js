/* ============================================================
   Rendu des 10 ecrans.

   Deux modes d'appel :
   - `neuf = true`  : l'ecran vient d'etre monte, on construit tout
   - `neuf = false` : simple mise a jour, on patche en place pour ne pas
     casser les animations en cours (regle : rien ne doit « resurgir »)
   ============================================================ */

import { demarrer, listerJeux } from './main.js';

export const ECRANS_FOND = {
  E1: null, E5: null, E6: null, E9: null, E10: null,
  E2: 'orange',
  E3: 'cyan', E4: 'cyan', E7: 'cyan', E8: 'cyan'
};

const el = (tag, cls, parent, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  if (parent) parent.appendChild(n);
  return n;
};

/* Ne reconstruit un bloc que si ce qu'il montre a change.

   Sans ca, chaque mise a jour Convex (un message de tchat suffit) rebatit le
   DOM et relance les animations d'entree : les marches du podium repoussent du
   sol, les colonnes d'equipes reapparaissent. C'est le « ca resurgit » que la
   spec interdit. */
function siChange(noeud, signature, construire) {
  if (noeud.dataset.sig === signature) return false;
  noeud.dataset.sig = signature;
  noeud.innerHTML = '';
  construire();
  return true;
}

export function rendreEcran(ecran, etat, hote, neuf) {
  const f = {
    E1: e1, E2: lobby, E3: lobby, E4: e4, E5: e5,
    E6: e6, E7: e7, E8: e8, E9: e9, E10: e10
  }[ecran];
  if (f) f(etat, hote, neuf, ecran);
}

/* ---------------------------------------------------------------- E1 */

function e1(etat, hote, neuf) {
  if (!neuf) return;
  const s = el('div', 'ecran', hote);
  borne(s, 'g'); borne(s, 'd');
  el('div', 'damier', s);

  const t = el('div', 'titre-display e1-titre', s);
  t.innerHTML = 'UNE FAMILLE<br>EN OR';

  const box = el('div', 'e1-boutons', s);
  const solo = el('button', 'e1-btn solo', box, 'Jouer seul');
  const fam = el('button', 'e1-btn famille', box, 'Jouer en famille');

  /* Le choix du paquet de questions vit dans la barre de regie, pas ici :
     il n'a rien a faire a l'antenne. On garde la selection en local. */
  let jeuId;
  const choix = el('select', 'e1-paquet', box);
  el('option', null, choix, 'Chargement des paquets…');
  listerJeux().then((jeux) => {
    choix.innerHTML = '';
    if (!jeux.length) {
      el('option', null, choix, 'Aucun paquet - va les préparer');
      choix.disabled = true;
      return;
    }
    for (const j of jeux) {
      const o = el('option', null, choix, `${j.nom} · ${j.nbQuestions} questions`);
      o.value = j._id;
    }
    jeuId = jeux[0]._id;
    choix.onchange = () => { jeuId = choix.value; };
  });

  solo.onclick = () => demarrer('solo', jeuId);
  fam.onclick = () => demarrer('famille', jeuId);
}

function borne(hote, cote) {
  const b = el('div', `borne ${cote}`, hote);
  el('div', 'borne-aff', b, String(1000 + Math.floor(Math.random() * 8999)));
  const ecr = el('div', 'borne-ecran', b);
  for (let i = 0; i < 4; i++) el('div', 'borne-px', ecr);
  el('div', 'borne-joy', b);
  el('div', 'borne-btn b1', b);
  el('div', 'borne-btn b2', b);
  // L'afficheur change de valeur : le plateau ne s'arrete jamais.
  const aff = b.querySelector('.borne-aff');
  setInterval(() => { aff.textContent = String(1000 + Math.floor(Math.random() * 8999)); }, 4200);
}

/* ---------------------------------------------------------------- E2 / E3 · lobby */

function lobby(etat, hote, neuf) {
  if (neuf) {
    const s = el('div', 'ecran', hote);
    const sc = el('div', 'scene', s);
    const c = el('div', 'scene-carte', sc);
    el('div', 'lobby-consigne', c, 'Écris « moi » dans le tchat pour participer');
    el('div', 'lobby-grille', c);
    const cpt = el('div', 'compteur', sc);
    el('div', 'compteur-n', cpt, '0');
  }
  if (!etat) return;

  const grille = hote.querySelector('.lobby-grille');
  const joueurs = etat.joueurs.slice(0, 27);
  const vus = new Set([...grille.children].map((n) => n.dataset.id));

  // On n'ajoute que les nouveaux : les pastilles deja posees ne rejouent pas
  // leur animation d'entree a chaque mise a jour.
  for (const j of joueurs) {
    if (vus.has(j._id)) continue;
    const p = el('div', 'pseudo entre', grille, j.pseudo);
    p.dataset.id = j._id;
  }
  for (const n of [...grille.children]) {
    if (!joueurs.some((j) => j._id === n.dataset.id)) n.remove();
  }

  const reste = etat.joueurs.length - joueurs.length;
  let plus = hote.querySelector('.lobby-plus');
  if (reste > 0) {
    if (!plus) plus = el('div', 'lobby-plus', hote.querySelector('.scene-carte'));
    plus.textContent = `+${reste} autres joueurs`;
  } else if (plus) plus.remove();

  // Etat vide : jamais d'ecran mort.
  let vide = hote.querySelector('.lobby-vide');
  if (!etat.joueurs.length) {
    if (!vide) {
      vide = el('div', 'lobby-vide', hote.querySelector('.scene-carte'));
      el('div', 'etoile', vide);
      el('div', 'lobby-vide-txt', vide, 'On attend les premiers joueurs…');
    }
  } else if (vide) vide.remove();

  const n = hote.querySelector('.compteur-n');
  if (n.textContent !== String(etat.joueurs.length)) {
    n.textContent = String(etat.joueurs.length);
    const cpt = hote.querySelector('.compteur');
    cpt.classList.remove('bump'); void cpt.offsetWidth; cpt.classList.add('bump');
  }
}

/* ---------------------------------------------------------------- E4 · familles */

function e4(etat, hote, neuf) {
  if (!neuf || !etat) return;
  const s = el('div', 'ecran', hote);
  const sc = el('div', 'scene', s);
  el('div', 'scene-titre', sc, 'Les familles');
  const c = el('div', 'scene-carte', sc);
  const box = el('div', 'equipes', c);

  etat.equipes.forEach((e, i) => {
    const col = el('div', 'equipe', box);
    col.style.background = e.couleur;
    col.style.animationDelay = `${90 * i}ms`;
    el('div', 'equipe-nom', col, e.nom);
    const membres = etat.joueurs.filter((j) => j.equipe === e.index);
    membres.forEach((m, k) => {
      const p = el('div', 'pseudo vole', col, m.pseudo);
      // Les pseudos volent depuis la liste commune, en cascade.
      p.style.animationDelay = `${250 + i * 70 + k * 75}ms`;
    });
  });
}

/* ---------------------------------------------------------------- E5 */

function e5(etat, hote, neuf) {
  if (!neuf) return;
  const s = el('div', 'ecran', hote);
  const sc = el('div', 'scene', s);
  const c = el('div', 'scene-carte', sc);
  const t = el('div', 'titre-display e5-titre', c);
  t.innerHTML = 'VOUS ÊTES<br>PRÊTS ?';
  const m = el('div', 'e5-manche', c);
  el('span', null, m, `MANCHE ${etat?.partie.manche ?? 1} / ${etat?.nbManches ?? 6}`);
  etoile(c, 90, 130, 110); etoile(c, 1600, 620, 150);
}

function etoile(hote, x, y, taille) {
  const e = el('div', 'etoile', hote);
  e.style.cssText = `left:${x}px;top:${y}px;width:${taille}px;height:${taille}px;animation-duration:${6 + Math.random() * 11}s`;
}

/* ---------------------------------------------------------------- E6 · la manche */

function e6(etat, hote, neuf) {
  if (!etat) return;
  if (neuf) {
    const s = el('div', 'ecran', hote);
    el('div', 'q-carte', s);
    el('div', 'grille', s);
    el('div', 'manche-bandeau', s);
    const t = el('div', 'tchat', s);
    el('div', 'tchat-tete', t, 'Le tchat');
    el('div', 'tchat-liste', t);
  }

  const q = etat.question;
  hote.querySelector('.q-carte').textContent = q?.texte || 'Question non renseignée';

  const bandeau = hote.querySelector('.manche-bandeau');
  bandeau.textContent = q?.double ? 'MANCHE POINTS DOUBLES' : 'MANCHE POINTS NORMAUX';
  bandeau.classList.toggle('double', !!q?.double);

  grilleReponses(hote.querySelector('.grille'), etat, neuf);
  tchat(hote.querySelector('.tchat-liste'), etat);
}

function grilleReponses(grille, etat, neuf) {
  const reps = etat.question?.reponses ?? [];
  const n = reps.length;
  const lignes = Math.max(1, Math.ceil(n / 2));

  if (neuf || grille.children.length !== n) {
    grille.innerHTML = '';
    grille.style.gridTemplateRows = `repeat(${lignes}, 1fr)`;
    // Tailles imposees par le handoff : la case doit remplir l'espace quand
    // il y a peu de reponses.
    const fs = n <= 4 ? 52 : n <= 6 ? 44 : n <= 8 ? 38 : 32;
    const hp = n <= 6 ? 58 : 46;
    const fp = n <= 6 ? 30 : 24;
    reps.forEach((r, i) => {
      const c = el('div', 'case', grille);
      c.dataset.i = String(i);
      const g = el('div', null, c);
      const t = el('div', 'case-txt', g, r.labels[0].toUpperCase());
      t.style.fontSize = `${fs}px`;
      el('div', 'case-sub', g);
      const p = el('div', 'case-pts', c, `${r.points} PTS`);
      p.style.height = `${hp}px`; p.style.fontSize = `${fp}px`;
      const bandeau = el('div', 'bandeau', c);
      /* Reflets desynchronises d'une case a l'autre, via une variable CSS.

         Surtout PAS un animation-delay en style en ligne sur le bandeau : le
         reflet vit sur ::after, et le style en ligne l'emportait sur la feuille
         de style au moment de l'ouverture — il retardait la levee du bandeau de
         plusieurs secondes, variable selon la position de la case. */
      bandeau.style.setProperty('--reflet-retard', `${((i * 2.3) % 9).toFixed(1)}s`);
    });
  }

  const parIndex = new Map(etat.revelations.map((r) => [r.caseIndex, r]));

  /* Les cases de la cascade se programment UNE SEULE FOIS.

     Avant, le decalage etait recalcule a chaque mise a jour Convex : un simple
     message de tchat pendant la cascade replanifiait tout, et plusieurs
     minuteurs pour la meme case se chevauchaient. D'ou des cases qui se levaient
     a deux et un ordre qui paraissait aleatoire. */
  const aProgrammer = [...grille.children]
    .filter((c) => parIndex.get(Number(c.dataset.i))?.cascade && !c.dataset.programmee)
    // De la moins bonne a la meilleure : la grille etant triee par points
    // decroissants, on part du dernier index.
    .sort((a, b) => Number(b.dataset.i) - Number(a.dataset.i));

  aProgrammer.forEach((c, rang) => {
    c.dataset.programmee = '1';
    setTimeout(() => c.classList.add('cascade', 'levee'), 260 + rang * 240);
  });

  for (const c of grille.children) {
    const r = parIndex.get(Number(c.dataset.i));
    if (!r) continue;
    // Trouvee par le tchat : elle se leve tout de suite, sans decalage.
    if (!r.cascade && !c.classList.contains('levee')) c.classList.add('levee');
    const sub = c.querySelector('.case-sub');
    if (r.trouveur && sub.textContent !== `trouvé par ${r.trouveur}`) {
      sub.textContent = `trouvé par ${r.trouveur}`;
    }
  }
}

function tchat(liste, etat) {
  const vus = new Set([...liste.children].map((n) => n.dataset.id));
  for (const m of etat.tchat) {
    if (vus.has(m._id)) continue;
    const l = el('div', `tchat-l${m.bonneReponse ? ' hit' : ''}`, liste);
    l.dataset.id = m._id;
    el('span', 'tchat-qui', l, m.pseudo);
    el('span', null, l, m.texte);
  }
  const ids = new Set(etat.tchat.map((m) => m._id));
  for (const n of [...liste.children]) if (!ids.has(n.dataset.id)) n.remove();
}

/* ---------------------------------------------------------------- E7 / E8 · points */

function e7(etat, hote, neuf) {
  if (!etat) return;
  if (neuf) {
    const s = el('div', 'ecran', hote);
    const sc = el('div', 'scene', s);
    el('div', 'scene-titre', sc, 'Les points');
    const c = el('div', 'scene-carte', sc);
    el('div', 'points-grille', c);
    tchatLateral(s, etat);
  }
  const g = hote.querySelector('.points-grille');
  const dix = etat.joueurs.slice(0, 10);
  siChange(g, dix.map((j) => `${j._id}:${j.points}`).join('|'), () => {
    dix.forEach((j, i) => {
      const l = el('div', 'points-l', g);
      el('div', 'points-rang', l, String(i + 1));
      el('div', 'pseudo', l, j.pseudo);
      const v = el('div', 'points-val', l);
      v.innerHTML = `${j.points}<small>POINTS</small>`;
    });
  });
}

function e8(etat, hote, neuf) {
  if (!etat) return;
  if (neuf) {
    const s = el('div', 'ecran', hote);
    const sc = el('div', 'scene', s);
    el('div', 'scene-titre', sc, 'Les familles');
    const c = el('div', 'scene-carte', sc);
    el('div', 'equipes', c);
  }
  const box = hote.querySelector('.equipes');
  const sig = etat.equipes.map((e) => `${e.index}:${e.points}`).join('|')
    + '#' + etat.joueurs.map((j) => `${j._id}:${j.equipe}`).join(',');
  siChange(box, sig, () => {
    etat.equipes.forEach((e, i) => {
      const col = el('div', 'equipe', box);
      col.style.background = e.couleur;
      col.style.animationDelay = `${90 * i}ms`;
      el('div', 'equipe-nom', col, e.nom);
      el('div', 'equipe-pts', col, String(e.points));
      etat.joueurs.filter((j) => j.equipe === e.index).forEach((m) => el('div', 'pseudo', col, m.pseudo));
    });
  });
}

function tchatLateral(s, etat) {
  const t = el('div', 'tchat', s);
  el('div', 'tchat-tete', t, 'Le tchat');
  const l = el('div', 'tchat-liste', t);
  tchat(l, etat);
}

/* ---------------------------------------------------------------- E9 · finale */

function e9(etat, hote, neuf) {
  if (!etat) return;
  if (neuf) {
    const s = el('div', 'ecran', hote);
    const t = el('div', 'finale-titre', s);
    t.innerHTML = 'QUI EST LE PLUS CHOUPI<br>DES FOLOLOWS ?';
    el('div', 'finale-corps', s);
  }
  const corps = hote.querySelector('.finale-corps');
  const p = etat.partie;
  const classes = classementLocal(etat);
  const total = classes.length;
  const marches = Math.min(3, total);
  const duel = p.mode === 'famille' && total === 2;

  // Seuls finaleN et podium font bouger cet ecran : un message de tchat ne doit
  // pas relancer la poussee des marches ni relacher des confettis.
  const change = siChange(corps, `${p.finaleN}/${p.podium}/${total}`, () => construire());
  if (!change) return;

  function construire() {
  if (p.finaleN === 0 && p.podium === 0) {
    el('div', 'finale-attente', corps, 'Le classement se révèle du dernier au premier');
    etoile(corps, 140, 300, 120); etoile(corps, 1660, 700, 140);
    return;
  }

  /* Le classement remonte vers le podium : le dernier arrive tout en bas, et
     chaque revelation pousse toute la pile d'un cran vers le haut. Ce qui passe
     sous la zone du podium s'efface. */
  const revelesEnListe = Math.min(p.finaleN, total - marches);
  for (let k = 0; k < revelesEnListe; k++) {
    const idx = total - 1 - k;             // on part du dernier
    const c = classes[idx];
    const l = el('div', 'finale-l', corps);
    const y = 1000 - (revelesEnListe - 1 - k) * 86;
    l.style.top = `${y}px`;
    // Le podium occupe 200 → 600 : on ne s'efface qu'une fois passe dessous.
    if (y < 620) l.classList.add('sorti');
    el('div', 'rang', l, `${idx + 1}`);
    el('div', 'pseudo', l, c.nom);
    el('div', 'pts', l, `${c.points}`);
  }

  // Le podium, en haut. Les finalistes montent dessus un par un : 3e, 2e, 1er.
  if (duel) {
    for (let m = 0; m < p.podium; m++) {
      const rang = marches - m;
      const c = classes[rang - 1];
      if (!c) continue;
      const d = el('div', `duel d${rang}`, corps);
      d.style.background = c.couleur;
      el('div', 'duel-nom', d, c.nom);
      el('div', 'duel-pts', d, String(c.points));
    }
  } else if (p.podium > 0) {
    const box = el('div', 'podium', corps);
    for (let m = 0; m < p.podium; m++) {
      const rang = marches - m;            // 3e d'abord, puis 2e, puis 1er
      const c = classes[rang - 1];
      if (!c) continue;
      const mar = el('div', `marche m${rang}`, box);
      el('div', 'marche-rang', mar, String(rang));
      el('div', 'marche-nom', mar, c.nom);
      el('div', 'marche-pts', mar, `${c.points} pts`);
    }
  }

  if (p.podium >= marches && !duel) confettis(corps);
  }
}

function classementLocal(etat) {
  if (etat.partie.mode === 'famille') {
    return [...etat.equipes].map((e) => ({ nom: e.nom, points: e.points, couleur: e.couleur }))
      .sort((a, b) => b.points - a.points);
  }
  return etat.joueurs.map((j) => ({ nom: j.pseudo, points: j.points, couleur: '#D8F0AE' }));
}

/* Confettis : joues une fois puis demontes. Jamais en boucle de fond. */
function confettis(hote) {
  const cs = ['#FF8FBF', '#F9E96B', '#A9E7F2', '#D9BDF2', '#D8F0AE'];
  for (let i = 0; i < 26; i++) {
    const c = el('div', 'confetti', hote);
    c.style.left = `${4 + (i * 3.6) % 92}%`;
    c.style.background = cs[i % cs.length];
    c.style.animationDelay = `${(i * 0.09).toFixed(2)}s`;
    c.style.animationDuration = `${2.1 + (i % 5) * 0.28}s`;
    setTimeout(() => c.remove(), 3600);
  }
}

/* ---------------------------------------------------------------- E10 */

function e10(etat, hote, neuf) {
  if (!neuf) return;
  const s = el('div', 'ecran', hote);
  borne(s, 'g'); borne(s, 'd');
  el('div', 'damier', s);
  el('div', 'titre-display e10-titre', s, 'MERCI !');
}
