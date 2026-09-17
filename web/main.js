/* ============================================================
   Moteur de l'application. Un seul rendu, deux vues :
   - antenne : Browser Source OBS, trou webcam perce, aucune commande
   - regie   : le meme ecran au pixel pres + la barre de commandes
   Bascule par ?vue=regie dans l'URL, ou par la touche V.
   ============================================================ */

import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { rendreEcran, ECRANS_FOND } from './screens.js';

// Injectee dans <head> par vite.config.js, depuis .env.local.
const client = new ConvexClient(window.__CONVEX_URL__);

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(location.search);
let vue = params.get('vue') === 'regie' ? 'regie' : 'antenne';

export const S = {
  etat: null,          // dernier snapshot Convex
  cam: true,           // le trou webcam est-il percé
  ecranAffiche: null,  // ecran actuellement monte dans le DOM
  volet: false         // une transition est en cours : on gele la navigation
};

/* ---------------------------------------------------------------- vues */

function appliquerVue() {
  document.body.classList.toggle('regie', vue === 'regie');
  ajusterEchelle();
}

/* Le canvas fait 1920x1080 en dur ; on le met a l'echelle de la fenetre.
   En regie il faut aussi loger la barre de commandes sous le canvas. */
function ajusterEchelle() {
  const hBarre = vue === 'regie' ? 132 : 0;
  const k = Math.min(window.innerWidth / 1920, window.innerHeight / (1080 + hBarre));
  const e = Math.max(0.1, k);
  $('cadre').style.transform = `scale(${e})`;
  $('cadre').style.marginBottom = `${(e - 1) * 1080}px`;
  const barre = $('barre');
  if (barre) {
    barre.style.transform = `scale(${e})`;
    barre.style.marginBottom = `${(e - 1) * 132}px`;
  }
}
window.addEventListener('resize', ajusterEchelle);

/* ---------------------------------------------------------------- volet */

/* La transition signature. Le contenu change SOUS le volet : l'ecran ne se vide
   jamais. L'en-tete et la webcam restent au-dessus, jamais recouverts. */
function transition(remplacer) {
  const v = $('volet');
  S.volet = true;
  v.classList.add('actif', 'entre');
  v.classList.remove('sort');

  setTimeout(() => {
    remplacer();
    v.classList.remove('entre');
    v.classList.add('sort');
    setTimeout(() => {
      v.classList.remove('actif', 'sort');
      S.volet = false;
    }, 460);
  }, 440);
}

/* ---------------------------------------------------------------- rendu */

function peindre(etat) {
  S.etat = etat;

  if (!etat) {
    // Aucune partie : on reste sur l'ecran titre, pas d'ecran vide.
    monter('E1');
    majBarre(null);
    return;
  }

  const cible = etat.partie.ecran;
  if (cible !== S.ecranAffiche) {
    // Premier montage : pas de volet, sinon on voit un balayage au chargement.
    if (S.ecranAffiche === null) monter(cible);
    else transition(() => monter(cible));
  } else {
    rendreEcran(cible, etat, $('plateau'), false);
  }
  majFond(cible);
  majBarre(etat);
}

function monter(ecran) {
  S.ecranAffiche = ecran;
  const hote = $('plateau');
  hote.innerHTML = '';
  rendreEcran(ecran, S.etat, hote, true);
  majFond(ecran);
}

function majFond(ecran) {
  const f = $('fond');
  f.classList.remove('orange', 'cyan');
  const c = ECRANS_FOND[ecran];
  if (c) f.classList.add(c);
}

/* ---------------------------------------------------------------- barre */

const LIBELLES = {
  E1: null,
  E2: 'Démarrer', E3: 'Créer les familles', E4: 'Démarrer',
  E5: 'Lancer la manche',
  E7: 'Prochaine manche', E8: 'Prochaine manche',
  E9: 'Suivant', E10: 'Rejouer'
};

function majBarre(etat) {
  const code = $('barreCode');
  const ctx = $('barreCtx');
  const actions = $('barreActions');
  actions.innerHTML = '';

  if (!etat) {
    code.textContent = 'E1 · TITRE';
    ctx.textContent = 'Choisis un mode pour ouvrir une partie';
    boutonCam(actions);
    return;
  }

  const p = etat.partie;
  code.textContent = p.ecran === 'E6' ? `E6 · MANCHE ${p.manche}` : `${p.ecran}`;
  ctx.textContent = contexte(etat);

  // E3 : le champ nombre de familles, avant le bouton.
  if (p.ecran === 'E3') {
    const champ = el('div', 'champ', actions);
    el('span', 'champ-lbl', champ).textContent = 'Nombre de familles';
    const moins = el('button', 'champ-pm', champ); moins.textContent = '−';
    const val = el('span', 'champ-val', champ); val.textContent = String(p.nbEquipes);
    const plus = el('button', 'champ-pm', champ); plus.textContent = '+';
    moins.onclick = () => client.mutation(api.partie.reglerNbEquipes, { n: p.nbEquipes - 1 });
    plus.onclick = () => client.mutation(api.partie.reglerNbEquipes, { n: p.nbEquipes + 1 });
  }

  let libelle = LIBELLES[p.ecran];
  if (p.ecran === 'E6') {
    libelle = p.phase === 'jeu' ? 'Révéler les réponses' : 'Voir le nombre de points';
  }
  if (libelle) {
    const b = el('button', 'btn', actions);
    b.textContent = libelle;
    b.onclick = actionPrincipale;
  }

  boutonCam(actions);

  const stop = el('button', 'btn secondaire', actions);
  stop.textContent = 'Arrêter';
  stop.onclick = () => client.mutation(api.partie.arreter, {});
}

/* Masquer la cam sert quand elle recouvre du texte qu'on veut montrer :
   le trou se bouche et le jeu redevient visible en entier. */
function boutonCam(actions) {
  const b = el('button', 'btn secondaire', actions);
  b.textContent = S.cam === false ? 'Cam : masquée (C)' : 'Cam : affichée (C)';
  b.classList.toggle('actif', S.cam === false);
  b.onclick = () => client.mutation(api.reglages.basculerCam, {});
}

function contexte(etat) {
  const p = etat.partie;
  const n = etat.joueurs.length;
  switch (p.ecran) {
    case 'E2': case 'E3': return `${n} joueur${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}`;
    case 'E4': return `${etat.equipes.length} familles tirées au sort`;
    case 'E6': {
      const trouvees = etat.revelations.filter((r) => !r.cascade).length;
      const total = etat.question?.reponses.length ?? 0;
      return p.phase === 'jeu'
        ? `${trouvees}/${total} réponses trouvées`
        : 'réponses dévoilées - prêt pour les points';
    }
    case 'E9': return p.podium > 0 ? `podium : ${p.podium}/3` : `${p.finaleN} rang(s) révélé(s)`;
    default: return `manche ${p.manche}/${etat.nbManches}`;
  }
}

/* ---------------------------------------------------------------- actions */

/* L'unique point d'entree de l'action principale : bouton de la barre ET
   fleche droite passent par ici. Un seul chemin, sinon E3 declenchait a la fois
   la creation des equipes et le passage a l'ecran suivant. */
export function actionPrincipale() {
  if (S.volet || !S.etat) return;   // on ne double pas une transition en cours
  const ecran = S.etat.partie.ecran;
  if (ecran === 'E3') return void client.mutation(api.joueurs.creerEquipes, {});
  client.mutation(api.partie.suivant, {});
}

export function demarrer(mode, jeuId) {
  client.mutation(api.partie.demarrer, jeuId ? { mode, jeuId } : { mode });
}

export function listerJeux() {
  return client.query(api.questions.listerJeux, {});
}

/* ---------------------------------------------------------------- clavier */

window.addEventListener('keydown', (e) => {
  if (e.key === 'v' || e.key === 'V') {
    vue = vue === 'regie' ? 'antenne' : 'regie';
    appliquerVue();
    return;
  }
  if (vue !== 'regie') return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); actionPrincipale(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); if (!S.volet) client.mutation(api.partie.precedent, {}); }
  if (e.key === 'c' || e.key === 'C') client.mutation(api.reglages.basculerCam, {});
});

function el(tag, cls, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
}

/* ---------------------------------------------------------------- boot */

appliquerVue();
monter('E1');

client.onUpdate(api.partie.etat, {}, (etat) => {
  $('lien').textContent = 'connectée';
  $('lien').classList.remove('ko');
  peindre(etat);
});

/* Abonnement separe : la cam doit pouvoir se masquer meme quand aucune partie
   ne tourne, donc ce reglage ne peut pas vivre dans l'etat de la partie. */
client.onUpdate(api.reglages.lire, {}, (r) => {
  S.cam = r.cam;
  document.body.classList.toggle('sans-cam', !r.cam);
  if (S.etat !== undefined) majBarre(S.etat);
});
