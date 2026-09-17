/* ============================================================
   Site de preparation des questions. Hors live : pas de mise en
   scene, juste de la saisie qui doit etre rapide et sure.
   ============================================================ */

import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const client = new ConvexClient(window.__CONVEX_URL__);
const $ = (id) => document.getElementById(id);
const el = (tag, cls, parent, txt) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  if (parent) parent.appendChild(n);
  return n;
};

const MIN_REPONSES = 4, MAX_REPONSES = 10;

/* Bareme par defaut d'une question : la premiere reponse vaut le plus, et ca
   descend. Evite d'avoir a saisir des points a chaque ligne — ils restent
   modifiables un par un. */
const BAREME = [8, 6, 5, 4, 3, 2, 2, 1, 1, 1];

let jeux = [];
let choisi = null;   // id du paquet ouvert
let brouillons = new Map();  // questionId -> { texte, double, reponses[], sale }

/* ---------------------------------------------------------------- paquets */

client.onUpdate(api.questions.listerJeux, {}, (l) => {
  jeux = l;
  peindreListe();
  // Ouvre le premier paquet au chargement, plutot qu'un ecran vide.
  if (!choisi && jeux.length) ouvrir(jeux[0]._id);
});

function peindreListe() {
  const box = $('liste');
  box.innerHTML = '';
  if (!jeux.length) {
    el('div', 'p-paquet-n', box, 'Aucun paquet pour l’instant.');
    return;
  }
  for (const j of jeux) {
    const p = el('div', `p-paquet${j._id === choisi ? ' on' : ''}`, box);
    const g = el('div', null, p);
    el('div', 'p-paquet-nom', g, j.nom);
    el('div', 'p-paquet-n', g, `${j.nbQuestions} question${j.nbQuestions > 1 ? 's' : ''}`);
    p.onclick = () => ouvrir(j._id);

    const sup = el('button', 'p-paquet-sup', p, '✕');
    sup.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Supprimer « ${j.nom} » et ses questions ?`)) return;
      await client.mutation(api.questions.supprimerJeu, { jeuId: j._id });
      if (choisi === j._id) { choisi = null; $('questions').innerHTML = ''; }
      toast('Paquet supprimé');
    };
  }
}

$('nouveau').onclick = async () => {
  const nom = prompt('Nom du paquet ?', 'Session du ' + new Date().toLocaleDateString('fr-FR'));
  if (nom === null) return;
  const id = await client.mutation(api.questions.creerJeu, { nom });
  ouvrir(id);
  toast('Paquet créé, 6 manches à remplir');
};

/* ---------------------------------------------------------------- questions */

let desabonner = null;

function ouvrir(jeuId) {
  choisi = jeuId;
  brouillons.clear();
  peindreListe();
  if (desabonner) desabonner();
  desabonner = client.onUpdate(api.questions.lireJeu, { jeuId }, (d) => {
    if (!d) return;
    // On ne rebâtit que si la structure change : sinon la saisie en cours
    // serait ecrasee a chaque aller-retour serveur.
    for (const q of d.questions) {
      if (!brouillons.has(q._id)) {
        brouillons.set(q._id, {
          texte: q.texte,
          double: q.double,
          reponses: q.reponses.map((r) => ({ saisie: r.labels.join('/'), points: r.points })),
          sale: false
        });
      }
    }
    peindreQuestions(d.questions);
  });
}

function peindreQuestions(questions) {
  const box = $('questions');
  box.innerHTML = '';

  for (const q of questions) {
    const b = brouillons.get(q._id);
    const carte = el('div', `p-q${b.double ? ' double' : ''}`, box);

    const tete = el('div', 'p-q-tete', carte);
    el('div', 'p-q-num', tete, String(q.ordre));

    const texte = el('input', 'p-q-texte', tete);
    texte.value = b.texte;
    texte.placeholder = 'Citez quelque chose qui…';
    texte.oninput = () => { b.texte = texte.value; marquer(carte, b); };

    const bascule = el('div', `p-bascule${b.double ? ' on' : ''}`, tete);
    el('div', 'p-bascule-puce', bascule);
    el('span', null, bascule, 'POINTS DOUBLES');
    bascule.onclick = () => {
      b.double = !b.double;
      bascule.classList.toggle('on', b.double);
      carte.classList.toggle('double', b.double);
      marquer(carte, b);
    };

    const reps = el('div', 'p-reps', carte);
    const dessinerReps = () => {
      reps.innerHTML = '';
      b.reponses.forEach((r, i) => {
        const l = el('div', 'p-rep', reps);
        el('div', 'p-rep-i', l, `#${i + 1}`);

        const lbl = el('input', 'p-rep-lbl', l);
        lbl.value = r.saisie;
        lbl.placeholder = 'DESSERT/GÂTEAU';
        lbl.title = 'Plusieurs libellés acceptés, séparés par /';
        // majPied aussi : une reponse ne compte que si elle a un libelle,
        // donc le total change des qu'on tape.
        lbl.oninput = () => { r.saisie = lbl.value; marquer(carte, b); majPied(); };

        const pts = el('input', 'p-rep-pts', l);
        pts.type = 'number'; pts.min = '1'; pts.max = '100';
        pts.value = String(r.points);
        pts.oninput = () => { r.points = Number(pts.value) || 1; marquer(carte, b); };

        const sup = el('button', 'p-rep-sup', l, '✕');
        sup.onclick = () => { b.reponses.splice(i, 1); dessinerReps(); marquer(carte, b); majPied(); };
      });
    };
    dessinerReps();

    const pied = el('div', 'p-q-pied', carte);
    const ajouter = el('button', 'p-btn', pied, '+ Réponse');
    ajouter.onclick = () => {
      if (b.reponses.length >= MAX_REPONSES) return;
      b.reponses.push({ saisie: '', points: BAREME[b.reponses.length] ?? 1 });
      dessinerReps(); marquer(carte, b); majPied();
    };
    const etat = el('div', null, pied);
    el('div', 'p-pied-espace', pied);
    const enregistrer = el('button', 'p-btn p-btn-go', pied, 'Enregistrer');

    const majPied = () => {
      const n = b.reponses.filter((r) => r.saisie.trim()).length;
      ajouter.disabled = n >= MAX_REPONSES;
      if (n < MIN_REPONSES) {
        etat.className = 'p-alerte';
        etat.textContent = `${n} réponse${n > 1 ? 's' : ''} - il en faut au moins ${MIN_REPONSES}`;
      } else {
        etat.className = 'p-ok';
        etat.textContent = `${n} réponses`;
      }
    };
    majPied();

    enregistrer.onclick = async () => {
      const r = await client.mutation(api.questions.enregistrerQuestion, {
        questionId: q._id,
        texte: b.texte,
        double: b.double,
        reponses: b.reponses.filter((x) => x.saisie.trim())
      });
      b.sale = false;
      carte.querySelector('.p-btn-go').classList.remove('chaud');
      toast(r.suffisant
        ? `Manche ${q.ordre} enregistrée`
        : `Manche ${q.ordre} enregistrée - attention, ${r.nbReponses} réponse(s) seulement`);
    };

    if (b.sale) enregistrer.classList.add('chaud');
  }
}

function marquer(carte, b) {
  b.sale = true;
  carte.querySelector('.p-btn-go')?.classList.add('chaud');
}

/* ---------------------------------------------------------------- toast */

let minuteurToast = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => t.classList.remove('on'), 2600);
}

// Filet de securite : on previent si on quitte avec de la saisie non enregistree.
window.addEventListener('beforeunload', (e) => {
  if ([...brouillons.values()].some((b) => b.sale)) { e.preventDefault(); e.returnValue = ''; }
});
