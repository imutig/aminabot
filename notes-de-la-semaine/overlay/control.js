/* ============================================================
   Telecommande de regie. Elle n'a aucune logique metier : elle
   envoie des commandes et affiche ce que le serveur renvoie.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, parent) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
};

const S = { etapes: [], criteres: [], etat: null, tallies: {}, aminaName: 'Amina', brouillon: null, gens: [], focusId: null };

let ws = null;
const envoyer = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const cmd = (act, extra = {}) => envoyer({ t: 'cmd', act, ...extra });

// ---------------------------------------------------------------- rendu

let dernierPasVu = null;

function etapeCourante() {
  const e = S.etat;
  return e && e.actif && e.pas >= 0 ? S.etapes[e.pas] : null;
}

function peindre() {
  const etat = S.etat || {};
  const actif = !!etat.actif;
  const cur = etapeCourante();
  const suite = actif && etat.pas + 1 < S.etapes.length ? S.etapes[etat.pas + 1] : null;

  $('etapeNum').textContent = cur ? cur.court : '·';
  $('etapeLabel').textContent = cur ? cur.label : 'Au repos';
  $('etapeSuite').textContent = suite ? suite.label : actif ? 'fin de la séquence' : 'lance le segment';

  $('btnPrev').disabled = !actif || etat.pas <= 0;
  $('btnNext').disabled = !actif || etat.pas >= S.etapes.length - 1;

  // Bloc note : actif seulement quand un critere est ouvert.
  const i = etat.activeIndex;
  const surCritere = actif && i >= 0;
  $('notesCard').classList.toggle('off', !surCritere);
  $('liveCard').classList.toggle('off', !surCritere);

  const row = surCritere && etat.rows ? etat.rows[i] : null;
  document.querySelectorAll('.note').forEach((b) => {
    b.classList.toggle('on', row && row.amina === Number(b.dataset.n));
  });
  $('btnAnnuler').disabled = !row || row.amina == null;
  $('etatVote').textContent = !surCritere ? 'en veille'
    : row && row.amina != null ? 'notée · votes fermés' : 'en attente de sa note';

  const t = surCritere ? (S.tallies[i] || { count: row?.count || 0, avg: row?.avg || 0 }) : null;
  $('liveCount').textContent = t ? `${t.count} vote${t.count > 1 ? 's' : ''}` : '0 vote';
  $('liveAvg').textContent = t && t.count ? t.avg.toFixed(1) : '–';
  $('liveAmina').textContent = row && row.amina != null ? String(row.amina) : '–';

  document.querySelectorAll('.et').forEach((b) => {
    const p = Number(b.dataset.pas);
    b.classList.toggle('on', actif && p === etat.pas);
    b.classList.toggle('faite', actif && p < etat.pas);
  });

  /* La liste des etapes defile toute seule : avec huit criteres elle depasse
     sa boite, et l'etape en cours doit rester visible sans y toucher.
     On ne le fait qu'au changement, sinon chaque vote du chat relancerait
     le defilement. */
  if (actif && etat.pas !== dernierPasVu) {
    dernierPasVu = etat.pas;
    document.querySelector('.et.on')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  if (!actif) dernierPasVu = null;

  /* Le tableau se remplit au fil du segment : une ligne par critere, la
     note d'Amina et la moyenne du chat a droite. C'est le releve de la
     semaine, visible d'un coup d'oeil sans quitter la regie. */
  document.querySelectorAll('.crit').forEach((l) => {
    const n = Number(l.dataset.i);
    const r = actif && etat.rows ? etat.rows[n] : null;
    const t = S.tallies[n];
    const votes = t ? t.count : (r?.count ?? 0);
    const moy = t ? t.avg : (r?.avg ?? 0);
    const note = r && r.amina != null ? r.amina : null;

    l.classList.toggle('on', actif && n === etat.activeIndex);

    const cA = l.querySelector('.crit-amina');
    cA.textContent = note != null ? String(note) : '–';
    cA.classList.toggle('rempli', note != null);

    const cC = l.querySelector('.crit-chat');
    cC.textContent = votes ? moy.toFixed(1) : '–';
    cC.classList.toggle('rempli', !!votes);

    const cV = l.querySelector('.crit-votes');
    cV.textContent = votes ? String(votes) : '–';
    cV.classList.toggle('rempli', !!votes);

    l.querySelector('.crit-bar > i').style.width = votes ? `${moy * 10}%` : '0';
  });

  // Les criteres ne se modifient pas pendant un segment : les votes deja
  // recus n'auraient plus de sens.
  $('critVerrou').classList.toggle('off', !actif);
  document.querySelectorAll('#critListe input, #critListe button, #critAjout, #critSauver')
    .forEach((n) => { n.disabled = actif; });
}

function construireEtapes() {
  const box = $('etapes');
  box.innerHTML = '';
  S.etapes.forEach((e, i) => {
    /* Code court et libelle dans deux colonnes distinctes : alignes les uns
       sous les autres, on retrouve une etape sans la lire en entier. */
    const b = el('button', 'et', box);
    el('span', 'et-num', b).textContent = e.court;
    el('span', 'et-nom', b).textContent = e.label;
    b.dataset.pas = String(i);
    b.onclick = () => cmd('aller', { pas: i });
  });
}

function construireNotes() {
  const box = $('notes');
  box.innerHTML = '';
  for (let n = 0; n <= 10; n++) {
    const b = el('button', 'note', box);
    b.textContent = String(n);
    b.dataset.n = String(n);
    b.onclick = () => cmd('note', { value: n });
  }
}

// ---------------------------------------------------------------- criteres

// On edite un brouillon local, on ne pousse au serveur qu'au clic sur Enregistrer.
function construireCriteres() {
  if (!S.brouillon) S.brouillon = S.criteres.map((c) => ({ nom: c.nom, coef: c.coef ?? 1 }));
  const box = $('critListe');
  box.innerHTML = '';

  S.brouillon.forEach((c, i) => {
    const l = el('div', 'crit', box);
    l.dataset.i = String(i);

    const num = el('div', 'crit-n', l);
    num.textContent = String(i + 1);

    const nom = el('input', 'crit-nom', l);
    nom.value = c.nom;
    nom.maxLength = 22;
    nom.placeholder = 'Nom du critère';
    nom.oninput = () => { c.nom = nom.value; marquerModifie(); };

    const coefBox = el('div', 'crit-coef', l);
    const moins = el('button', 'crit-pm', coefBox);
    moins.textContent = '−';
    const val = el('div', 'crit-cv', coefBox);
    val.textContent = '×' + c.coef;
    const plus = el('button', 'crit-pm', coefBox);
    plus.textContent = '+';
    moins.onclick = () => { c.coef = Math.max(0.5, c.coef - 0.5); val.textContent = '×' + c.coef; marquerModifie(); };
    plus.onclick = () => { c.coef = Math.min(5, c.coef + 0.5); val.textContent = '×' + c.coef; marquerModifie(); };

    /* Cotes resultats : vides hors segment, remplis par peindre() au fil
       des notes. Le tableau sert donc aussi de releve de la semaine. */
    el('div', 'crit-amina', l).textContent = '–';
    el('div', 'crit-chat', l).textContent = '–';
    el('i', null, el('div', 'crit-bar', l));
    el('div', 'crit-votes', l).textContent = '–';

    const sup = el('button', 'crit-sup', l);
    sup.textContent = '✕';
    sup.title = 'Supprimer';
    sup.onclick = () => { S.brouillon.splice(i, 1); construireCriteres(); marquerModifie(); };
  });

  $('critNb').textContent = `${S.brouillon.length} critère${S.brouillon.length > 1 ? 's' : ''}`;
  peindre();
}

let modifie = false;
function marquerModifie() {
  modifie = true;
  $('critSauver').classList.add('chaud');
  $('critEtat').textContent = 'modifications non enregistrées';
}

function reinitCriteres() {
  S.brouillon = null;
  modifie = false;
  $('critSauver').classList.remove('chaud');
  $('critEtat').textContent = '';
  construireCriteres();
}

// ---------------------------------------------------------------- participants

/* Qui a vote, et la semaine de qui est a l'antenne.

   La liste se redemande au serveur plutot que d'etre diffusee : avec 300
   votants, la pousser a chaque vote sature la liaison pour un panneau qu'on
   ne regarde que par moments. On la rafraichit toutes les 4 s, et tout de
   suite apres une action. */
const demanderGens = () => envoyer({ t: 'participants?' });

function construireGens() {
  const box = $('gensListe');
  const q = $('gensQ').value.trim().toLowerCase();
  const liste = q ? S.gens.filter((g) => g.name.toLowerCase().includes(q)) : S.gens;

  box.innerHTML = '';
  $('gensNb').textContent = S.gens.length
    ? `${S.gens.length} participant${S.gens.length > 1 ? 's' : ''}`
    : '0';
  $('gensRetour').disabled = !S.focusId;
  $('gensRetour').classList.toggle('chaud', !!S.focusId);

  if (!liste.length) {
    const v = el('div', 'gens-vide', box);
    v.textContent = S.gens.length
      ? 'Aucun pseudo ne correspond.'
      : "Personne n'a encore voté.";
    return;
  }

  liste.forEach((g) => {
    const b = el('button', 'gens', box);
    b.classList.toggle('on', g.id === S.focusId);
    el('span', 'gens-nom', b).textContent = g.name;
    el('span', 'gens-n', b).textContent = String(g.n);
    el('span', 'gens-moy', b).textContent = g.avg.toFixed(1);
    // Reclic sur celui qui est deja a l'antenne = retour au tableau global.
    b.onclick = () => {
      cmd('focus', { id: g.id === S.focusId ? null : g.id });
      setTimeout(demanderGens, 120);
    };
  });
}

// ---------------------------------------------------------------- WebSocket

function connecter() {
  // wss:// quand la page est servie en HTTPS : un navigateur refuse une
  // connexion ws:// non chiffree depuis une page securisee.
  const protocole = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocole}://${location.host}`);

  ws.onopen = () => { $('lien').textContent = 'connectée'; $('lien').classList.remove('ko'); };
  ws.onclose = () => {
    $('lien').textContent = 'déconnectée, reconnexion…';
    $('lien').classList.add('ko');
    setTimeout(connecter, 1500);
  };
  ws.onerror = () => ws.close();

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);

    if (m.t === 'hello') {
      // Le serveur a redemarre : on recharge pour ne pas rester sur du vieux code.
      if (S.instance && S.instance !== m.instance) { location.reload(); return; }
      S.instance = m.instance;
      S.etapes = m.etapes;
      S.criteres = m.criteres;
      S.etat = m.etat;
      S.aminaName = m.reglages.aminaName || 'Amina';
      $('nomAmina').textContent = S.aminaName;
      construireEtapes();
      construireNotes();
      reinitCriteres();
      peindre();
      demanderGens();
      return;
    }
    if (m.t === 'participants') {
      S.gens = m.liste;
      S.focusId = m.focusId;
      construireGens();
      return;
    }
    if (m.t === 'focus') {
      S.focusId = m.viewer ? m.viewer.id : null;
      construireGens();
      return;
    }
    if (m.t === 'criteres') {
      S.criteres = m.criteres;
      S.etapes = m.etapes;
      construireEtapes();
      reinitCriteres();
      $('critEtat').textContent = 'enregistré ✓';
      setTimeout(() => { if (!modifie) $('critEtat').textContent = ''; }, 2500);
      return;
    }
    if (m.t === 'etape') {
      S.etat = { ...(S.etat || {}), actif: true, pas: m.pas, activeIndex: m.activeIndex };
      S.tallies = {};
      demanderEtat();
      peindre();
      return;
    }
    if (m.t === 'etat') { S.etat = m.etat; peindre(); return; }
    if (m.t === 'tally') { S.tallies[m.index] = { count: m.count, avg: m.avg }; peindre(); return; }
    if (m.t === 'amina' || m.t === 'amina-annulee') { demanderEtat(); return; }
    if (m.t === 'refus') { $('critEtat').textContent = 'refusé : ' + m.raison; return; }
  };
}

// Le serveur renvoie un snapshot complet a la demande : plus simple que de
// maintenir un miroir de l'etat cote telecommande.
const demanderEtat = () => envoyer({ t: 'etat?' });

// ---------------------------------------------------------------- branchements

$('btnPrev').onclick = () => cmd('precedent');
$('btnNext').onclick = () => cmd('suivant');
$('btnStart').onclick = () => cmd('start');
$('btnStop').onclick = () => cmd('stop');
$('btnAnnuler').onclick = () => cmd('annuler-note');
$('btnReset').onclick = () => {
  if (confirm('Tout remettre à zéro ? Les votes déjà reçus seront effacés.')) cmd('reset');
};
$('critAjout').onclick = () => {
  S.brouillon.push({ nom: '', coef: 1 });
  construireCriteres();
  marquerModifie();
  const inputs = document.querySelectorAll('.crit-nom');
  inputs[inputs.length - 1]?.focus();
};
$('gensQ').oninput = () => construireGens();
$('gensRetour').onclick = () => { cmd('focus', { id: null }); setTimeout(demanderGens, 120); };
// Les votes arrivent en continu : la liste se rafraichit toute seule.
setInterval(() => { if (ws && ws.readyState === 1) demanderGens(); }, 4000);

$('critAnnuler').onclick = () => reinitCriteres();
$('critSauver').onclick = () => {
  const liste = S.brouillon.filter((c) => c.nom.trim());
  if (liste.length < 2) { $('critEtat').textContent = 'il faut au moins 2 critères'; return; }
  envoyer({ t: 'cmd', act: 'criteres', liste });
};

// Fleches clavier : pratique sur un second ecran.
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') { e.preventDefault(); cmd('suivant'); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); cmd('precedent'); }
  if (/^[0-9]$/.test(e.key)) cmd('note', { value: Number(e.key) });
  if (e.key.toLowerCase() === 'a') cmd('note', { value: 10 });
});

connecter();
