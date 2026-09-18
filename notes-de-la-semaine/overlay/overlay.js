/* ============================================================
   Moteur de l'overlay. Le serveur detient les donnees (votes,
   moyennes, classement) ; ce fichier detient la mise en scene.
   ============================================================ */

/* Rectangle festonne (« rectangle nuageux ») : chaque cote est remplace par une
   serie d'arcs convexes. Parcours horaire + sweep-flag 1 = bosses vers l'exterieur,
   et les coins restent des cusps, ce qui garde la lecture « rectangle » et non « blob ».
   Genere plutot que code en dur : la taille de la cam a change une fois, elle
   rechangera. Contrainte : le rayon doit valoir au moins la moitie de la corde. */
function pathFestonne(w, h, nx, ny, rx, ry) {
  const x = w / 2, y = h / 2;
  const cx = w / nx, cy = h / ny;
  const p = [`M ${-x} ${-y}`];
  for (let i = 1; i <= nx; i++) p.push(`A ${rx} ${rx} 0 0 1 ${(-x + i * cx).toFixed(2)} ${-y}`);
  for (let i = 1; i <= ny; i++) p.push(`A ${ry} ${ry} 0 0 1 ${x} ${(-y + i * cy).toFixed(2)}`);
  for (let i = 1; i <= nx; i++) p.push(`A ${rx} ${rx} 0 0 1 ${(x - i * cx).toFixed(2)} ${y}`);
  for (let i = 1; i <= ny; i++) p.push(`A ${ry} ${ry} 0 0 1 ${-x} ${(y - i * cy).toFixed(2)}`);
  return p.join(' ') + ' Z';
}

// La cam occupe TOUTE la partie gauche : de 22 a 1058 en hauteur (festons
// compris), de 17 a 1103 en largeur. Rapport 1040/990 ≈ 1:1 - une webcam 16:9
// doit etre recadree, mais un 1080p recadre donne 1134x1080, soit plus que la
// taille d'affichage : aucune perte de qualite.
const CAM_W = 1040, CAM_H = 990;
const CAM_PATH = pathFestonne(CAM_W, CAM_H, 11, 11, 60, 56);

const COL_LEFT = 1124, COL_W = 756, CAM_X = 560, CAM_Y = 540, STRIP_W = 1000;
// Plafond de noeuds gardes dans le chat. En grand format il en tient une
// trentaine a l'ecran, le conteneur rogne le haut. Sert a ne pas laisser
// la liste enfler pendant tout un live.
const FEED_MAX = 45;
const CURTAIN_OFF = -420, CURTAIN_COVER = 1930, CURTAIN_EXIT = 3920;
const NOTE_COLORS = ['#7E9BC4', '#9A93CE', '#F09BC0', '#EF5F94', '#DC9F2E'];
const $ = (id) => document.getElementById(id);
const el = (tag, cls, parent) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  return n;
};

// ---------------------------------------------------------------- etat

const S = {
  scene: 'idle',
  criteres: [],
  etapes: [],
  reglages: { camSide: 'gauche', camPlaceholder: false, aminaName: 'Amina' },
  rows: [],
  viewers: [],
  active: -1,
  // Viewer dont la semaine remplace les moyennes du chat, ou null.
  focus: null,
  bilan: { participants: 0, classes: 0, criteres: 0 },
  weekLabel: '',
  timers: [],
  calcRun: false,
  calcStart: 0
};

const newRow = () => ({ count: 0, avg: 0, disp: 0, dist: [], amina: null, state: 'upcoming', verdict: '', entered: false, pulse: false });

const after = (ms, fn) => { const id = setTimeout(fn, ms); S.timers.push(id); return id; };
const clearTimers = () => { S.timers.forEach(clearTimeout); S.timers = []; };

function noteColor(v) {
  if (v < 2.5) return NOTE_COLORS[0];
  if (v < 4.5) return NOTE_COLORS[1];
  if (v < 6.5) return NOTE_COLORS[2];
  if (v < 8.5) return NOTE_COLORS[3];
  return NOTE_COLORS[4];
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ---------------------------------------------------------------- construction

const dom = {};

function construireScene() {
  const mir = S.reglages.camSide === 'droite';
  const camX = mir ? 1920 - CAM_X : CAM_X;
  const colLeft = mir ? 1920 - COL_LEFT - COL_W : COL_LEFT;

  document.documentElement.style.setProperty('--col-left', colLeft + 'px');
  document.documentElement.style.setProperty('--strip-left', (camX - STRIP_W / 2) + 'px');

  document.querySelectorAll('[data-cam-path]').forEach((p) => p.setAttribute('d', CAM_PATH));
  document.querySelectorAll('[data-cam-anchor]').forEach((g) => g.setAttribute('transform', `translate(${camX} ${CAM_Y})`));
  $('camPlaceholder').classList.toggle('off', S.reglages.camPlaceholder === false);
  $('colAmina').textContent = S.reglages.aminaName || 'Amina';

  construireLignes();
  construireDecors();
  ajusterEchelle();
}

/* Densite du tableau selon le nombre de criteres.

   Le tableau doit tenir entre le haut de la carte et le chat : au-dela de huit
   criteres il passait derriere. Plutot que de faire defiler (impensable a
   l'antenne) ou de rogner le chat, les lignes se resserrent.

   Le cas contraignant n'est pas le critere en cours mais l'ecran du calcul :
   toutes les lignes y sont la, plus le bloc « moyenne generale ». Mesure faite
   sur l'overlay : la carte commence a 56, le chat replie a 936, l'habillage de
   la carte prend 110 et le bloc moyenne 109. Il reste 649 pour les lignes, et
   huit criteres en occupent 648 - d'ou le facteur 1 jusqu'a huit, la mise en
   page d'origine ne bouge pas. */
const LIGNE_H = 74, LIGNE_GAP = 8, PLACE_LIGNES = 649;

function ajusterDensite(n) {
  const besoin = LIGNE_H * n + LIGNE_GAP * (n - 1);
  // Plancher : en dessous, les chiffres des jauges ne se lisent plus de loin.
  const f = Math.max(0.62, Math.min(1, PLACE_LIGNES / besoin));
  const r = document.documentElement.style;
  const px = (base, min = 0) => Math.max(min, Math.round(base * f)) + 'px';

  r.setProperty('--ligne-h', px(LIGNE_H));
  r.setProperty('--ligne-h-active', px(LIGNE_H + 10));
  r.setProperty('--ligne-gap', px(LIGNE_GAP, 4));
  r.setProperty('--icone', px(38, 24));
  r.setProperty('--meta-h', px(24, 17));
  r.setProperty('--note-taille', px(32, 20));
  r.setProperty('--piste-h', px(13, 8));
  r.setProperty('--hist-h', px(34, 20));
  // Le nom se resserre moins vite que le reste : c'est ce qu'on lit d'abord.
  r.setProperty('--nom-taille', Math.max(14, Math.round(19 * (0.55 + 0.45 * f))) + 'px');
}

function construireLignes() {
  ajusterDensite(S.criteres.length);
  const list = $('rowList');
  list.innerHTML = '';
  dom.rows = S.criteres.map((c, i) => {
    const row = el('div', 'row', list);

    const icon = el('div', 'row-icon', row);
    icon.innerHTML = `<svg viewBox="0 0 180 110"><g fill="${c.edge}"><rect x="26" y="70" width="130" height="38" rx="19"></rect><circle cx="62" cy="62" r="38"></circle><circle cx="114" cy="54" r="42"></circle><circle cx="148" cy="78" r="28"></circle></g><g transform="translate(0 5) scale(.93)" fill="${c.tint}"><rect x="26" y="70" width="130" height="38" rx="19"></rect><circle cx="62" cy="62" r="38"></circle><circle cx="114" cy="54" r="42"></circle><circle cx="148" cy="78" r="28"></circle></g></svg>`;
    const marker = el('div', 'row-marker', icon);
    marker.style.cssText = `width:${c.mw}px;height:${c.mh}px;border-radius:${c.mr};transform:rotate(${c.mrot}deg)`;

    const body = el('div', 'row-body', row);
    const titre = el('div', 'row-titre', body);
    const name = el('div', 'row-name', titre);
    name.textContent = c.nom;
    // Le coefficient ne s'affiche que s'il change quelque chose.
    if ((c.coef ?? 1) !== 1) {
      el('div', 'row-coef', titre).textContent = '×' + c.coef;
    }
    const meta = el('div', 'row-meta', body);
    const votes = el('div', 'votes', meta);
    const dot = el('div', 'votes-dot', votes);
    const votesN = el('div', 'votes-n', votes);
    votesN.textContent = '0';
    const verdict = el('div', 'verdict', meta);

    /* Repartition des votes, visible seulement sur la ligne en cours.
       Une moyenne de 6 peut vouloir dire « tout le monde a mis 6 » ou « la
       moitie a mis 0 et l'autre 10 » : c'est la forme qui fait le moment. */
    const hist = el('div', 'hist', row);
    const barres = el('div', 'hist-barres', hist);
    const hBars = [];
    for (let n = 0; n <= 10; n++) {
      const col = el('div', 'hist-col', barres);
      const f = el('i', null, col);
      f.style.background = noteColor(n);
      hBars.push(f);
    }
    /* Juste les deux bornes : a 10 px de haut, un libelle au milieu devient
       une tache grise. Le degrade de couleur des barres dit deja le bareme. */
    const ax = el('div', 'hist-ax', hist);
    el('span', null, ax).textContent = '0';
    el('span', null, ax).textContent = '10';

    const gA = el('div', 'gauge gauge-a', row);
    const gANum = el('div', 'gauge-n', gA);
    gANum.textContent = '–';
    const gATrack = el('div', 'gauge-track', gA);
    const gAFill = el('div', 'gauge-fill', gATrack);
    const sweep = el('div', 'wait-sweep', gATrack);

    const gC = el('div', 'gauge gauge-c', row);
    const gCNum = el('div', 'gauge-n', gC);
    gCNum.textContent = '–';
    const gCTrack = el('div', 'gauge-track', gC);
    const gCFill = el('div', 'gauge-fill', gCTrack);

    return { row, votes, dot, votesN, verdict, hBars, gA, gANum, gAFill, sweep, gCNum, gCFill };
  });
}

function construireDecors() {
  const rays = $('rays');
  for (let i = 0; i < 8; i++) {
    el('div', 'ray', rays).style.transform = `rotate(${i * 45 + 12}deg)`;
  }
  const rain = $('rain');
  for (let i = 0; i < 12; i++) {
    const d = el('div', 'drop', rain);
    d.style.left = (58 + (i * 18) % 180) + 'px';
    d.style.animationDuration = (1.7 + (i % 4) * 0.3) + 's';
    d.style.animationDelay = (i * 0.26).toFixed(2) + 's';
  }
  const conf = $('confetti');
  const COULEURS = ['#FFD2E3', '#FBE3B9', '#DCD1F7', '#FFDCC2'];
  for (let i = 0; i < 16; i++) {
    const c = el('div', 'conf', conf);
    c.style.cssText = `left:${3 + (i * 6.3) % 94}%;width:${8 + (i % 3) * 3}px;height:${8 + (i % 2) * 5}px;` +
      `border-radius:${i % 3 === 0 ? '50%' : '3px'};background:${COULEURS[i % 4]};` +
      `animation-duration:${3.6 + (i % 5) * 0.5}s;animation-delay:${((i * 0.31) % 3.8).toFixed(2)}s`;
  }
  const L = [2, 96, 6, 93, 1, 98], T = [16, 24, 74, 66, 44, 88];
  for (let i = 0; i < 6; i++) {
    const s = el('div', 'spark', $('hof'));
    s.style.cssText = `left:${L[i]}%;top:${T[i]}%;width:${7 + (i % 3) * 3}px;height:${7 + (i % 3) * 3}px;` +
      `background:${i % 2 ? '#FFE29A' : '#FFFFFF'};animation-duration:${2.6 + (i % 3) * 0.7}s;animation-delay:${(i * 0.37).toFixed(2)}s`;
  }
}

let echelle = 1;
function ajusterEchelle() {
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  echelle = Math.max(0.1, s);
  $('canvas').style.transform = `scale(${echelle})`;
}
window.addEventListener('resize', ajusterEchelle);

/* Chaque vote pris en compte fait jaillir une bulle au pseudo du votant,
   juste a cote du compteur de la ligne en cours.

   C'est la seule preuve, pour quelqu'un dans le chat, que SON message est
   arrive : le compteur qui monte ne dit pas qui, et sur une chaine active on
   ne sait pas si c'est son propre vote ou celui du voisin.

   Les votes arrivent par paquets - le serveur regroupe ce qu'il recoit toutes
   les 120 ms - donc on ne les affiche PAS a la volee : ils entrent dans une
   file et sortent un par un, a intervalle fixe. Trois bulles se lisent ; six
   qui apparaissent d'un coup ne se lisent pas. Quand la file deborde on garde
   les votes les plus recents : mieux vaut du frais qu'un rattrapage.

   Les coordonnees se prennent en pixels du plateau : le canvas est mis a
   l'echelle de la fenetre, donc on divise les rectangles par cette echelle
   pour revenir au repere de dessin (1920x1080). */
const BULLE_DUREE = 4000;        // doit rester egal a l'animation bulleVol
const BULLE_INTERVALLE = 1400;   // une bulle sort de la file toutes les 1,4 s
const BULLES_MAX = 3;            // au-dela ca se chevauche et ne se lit plus
const FILE_MAX = 8;

let fileVotes = [];
let pompe = null;

function bullesDeVote(votants) {
  if (!votants || !votants.length || S.active < 0) return;
  for (const v of votants) fileVotes.push(v);
  if (fileVotes.length > FILE_MAX) fileVotes = fileVotes.slice(-FILE_MAX);
  if (!pompe) defilerFile();
}

// Sort un vote de la file, pose sa bulle, et se rappelle tant qu'il en reste.
function defilerFile() {
  const v = fileVotes.shift();
  if (!v || S.active < 0) { pompe = null; return; }
  poserBulle(v);
  // setTimeout direct, pas after() : ce minuteur se pilote ici, il ne doit pas
  // etre balaye par le clearTimers() d'un changement de scene sans que pompe
  // soit remis a zero - la file resterait bloquee pour le reste du segment.
  pompe = setTimeout(defilerFile, BULLE_INTERVALLE);
}

function viderBulles() {
  clearTimeout(pompe);
  pompe = null;
  fileVotes = [];
  const couche = $('volee');
  if (couche) couche.innerHTML = '';
}

function poserBulle(vt) {
  const d = dom.rows[S.active];
  const carte = $('panelCard');
  const couche = $('volee');
  if (!d || !carte || !couche) return;
  if (couche.children.length >= BULLES_MAX) return;

  const c = carte.getBoundingClientRect();
  const v = d.votes.getBoundingClientRect();
  if (!c.width || !v.width) return;
  // Un leger decalage au depart : deux bulles ne doivent pas monter
  // exactement sur la meme verticale.
  const x = (v.right - c.left) / echelle + 10 + ((Math.random() * 16) | 0);
  const y = (v.top + v.height / 2 - c.top) / echelle - 17;

  const b = el('div', 'bulle', couche);
  b.style.cssText = `left:${x}px;top:${y}px`;
  el('span', 'bulle-nom', b).textContent = trunc(vt.name || '', 14);
  const n = el('span', 'bulle-note', b);
  n.textContent = String(vt.note);
  n.style.color = noteColor(vt.note);
  b.addEventListener('animationend', () => b.remove());
  /* Filet de securite : quand l'onglet n'est pas visible (scene OBS
     inactive), les animations gelent et animationend ne part jamais.
     Sans ca, on retrouverait de vieilles bulles figees au retour. */
  setTimeout(() => b.remove(), BULLE_DUREE + 500);
}

// ---------------------------------------------------------------- peinture

/* Le bandeau de semaine et l'en-tete de la colonne de droite disent la meme
   chose : de qui on lit les notes. Un seul endroit les ecrit, sinon le
   changement d'etape rendrait son libelle au bandeau et effacerait le nom du
   viewer mis a l'antenne. */
function peindreEntete() {
  const f = S.focus;
  $('weekChip').textContent = f ? `La semaine de ${trunc(f.name, 18)}` : S.weekLabel;
  $('colChat').textContent = f ? trunc(f.name, 14) : 'Chat';
  $('panelCard').classList.toggle('focus', !!f);
  $('weekChip').classList.toggle('focus', !!f);
}

function peindreLignes() {
  S.rows.forEach((r, i) => {
    const d = dom.rows[i];
    if (!d) return;
    const up = r.state === 'upcoming';
    const active = r.state === 'active';

    d.row.classList.toggle('entered', r.entered);
    d.row.classList.toggle('active', active);
    d.row.classList.toggle('done', r.state === 'done');

    d.votesN.textContent = String(r.count);
    d.dot.classList.toggle('live', active && r.count > 0);
    d.votes.classList.toggle('pulse', r.pulse);

    d.verdict.className = 'verdict' + (r.verdict ? ' on ' : ' ') + (r.verdict === 'même avis !' ? 'ok' : 'neutre');
    d.verdict.textContent = r.verdict;

    // Jauge Amina
    const aVide = r.amina == null || up;
    d.gANum.textContent = aVide ? (active ? '·' : '–') : String(r.amina);
    d.gA.classList.toggle('filled', !aVide);
    d.gAFill.style.width = (aVide ? 0 : r.amina * 10) + '%';
    d.sweep.classList.toggle('on', active && r.amina == null);

    /* Chaque batonnet est relatif au plus haut : avec 300 votants les hauteurs
       absolues sortiraient de la ligne, et c'est la FORME qu'on veut lire. */
    const dist = r.dist || [];
    const haut = Math.max(1, ...dist);
    d.hBars.forEach((f, n) => { f.style.height = ((dist[n] || 0) / haut * 100) + '%'; });

    /* Colonne de droite : la moyenne du chat, ou la note du viewer mis a
       l'antenne. Sa semaine se lit en entier, y compris sur les criteres pas
       encore joues - c'est tout l'interet de la montrer. */
    if (S.focus) {
      const note = S.focus.notes[i];
      const vide = note == null;
      d.gCNum.textContent = vide ? '–' : String(note);
      d.gCNum.style.color = vide ? '#A2B4CE' : noteColor(note);
      d.gCFill.style.width = (vide ? 0 : note * 10) + '%';
      d.gCFill.style.background = noteColor(vide ? 0 : note);
    } else {
      const v = up ? 0 : r.disp;
      d.gCNum.textContent = up ? '–' : !r.count ? '·' : v.toFixed(1);
      d.gCNum.style.color = !r.count || up ? '#A2B4CE' : noteColor(v);
      d.gCFill.style.width = (v * 10) + '%';
      d.gCFill.style.background = noteColor(v);
    }
  });
}

// Moyennes ponderees par le coefficient de chaque critere.
function moyennePonderee(valeur, garde) {
  let somme = 0, poids = 0;
  S.rows.forEach((r, i) => {
    if (!garde(r)) return;
    const c = S.criteres[i].coef ?? 1;
    somme += valeur(r) * c;
    poids += c;
  });
  return poids ? (somme / poids).toFixed(1) : '–';
}
const moyenneAmina = () => moyennePonderee((r) => r.amina, (r) => r.amina != null);
const moyenneChat = () => moyennePonderee((r) => r.avg, (r) => r.count > 0);

function montrerMoyenneGenerale(on) {
  const slot = $('globalSlot');
  slot.innerHTML = '';
  if (!on) return;
  const g = el('div', 'global', slot);
  const lab = el('div', 'global-label', g);
  lab.textContent = 'Moyenne générale';
  const a = el('div', 'global-v global-a', g);
  a.textContent = moyenneAmina();
  const c = el('div', 'global-v global-c', g);
  // En focus, la valeur de droite est la moyenne du viewer, pas celle du chat.
  c.textContent = S.focus ? S.focus.avg.toFixed(1) : moyenneChat();
}

function peindreHof(type) {
  const hof = $('hof');
  const vw = S.viewers;

  hof.classList.toggle('best', type === 'best');
  hof.classList.toggle('worst', type === 'worst');

  /* Classement vide : personne n'a note tous les criteres. Ca peut arriver
     sur un petit chat, et l'ecran doit le dire au lieu de garder celui
     d'avant a l'antenne. */
  if (!vw.length) {
    const nc = (S.bilan && S.bilan.criteres) || S.criteres.length;
    $('hofTitle').textContent = type === 'best' ? 'Meilleure semaine' : 'Pire semaine';
    $('hofSub').textContent = `il fallait noter les ${nc} critères`;
    $('hofNames').innerHTML = '';
    el('div', 'hof-name', $('hofNames')).textContent = 'personne';
    $('hofScore').innerHTML = '–<span class="hof-slash">/10</span>';
    $('hofFoot').textContent = 'aucun viewer n’a noté toute sa semaine';
    return;
  }

  const best = vw.filter((v) => v.avg === vw[0].avg);
  const gagnants = type === 'best' ? best : [vw[vw.length - 1]];
  const noms = gagnants.slice(0, 3);

  $('hofTitle').textContent = type === 'best' ? 'Meilleure semaine' : 'Pire semaine';
  $('hofSub').textContent = type === 'best' ? 'Celui qui a kiffé sa semaine' : 'Celui qui a passé une semaine de merde';

  const nb = gagnants[0] ? gagnants[0].votes : S.criteres.length;
  $('hofFoot').textContent = noms.length > 1
    ? `ex æquo · moyenne sur ${nb} critères`
    : type === 'best' ? `moyenne sur ${nb} critères` : 'on t’envoie du courage';

  const box = $('hofNames');
  box.innerHTML = '';
  box.classList.toggle('multi', noms.length > 1);
  noms.forEach((v) => { el('div', 'hof-name', box).textContent = trunc(v.name, 15); });

  $('hofScore').innerHTML = (gagnants[0] ? gagnants[0].avg.toFixed(1) : '–') + '<span class="hof-slash">/10</span>';
}

function peindreClassement() {
  const vw = S.viewers;
  const b = S.bilan || {};
  /* La regle du classement s'affiche : quelqu'un qui a vote et ne se voit pas
     doit comprendre pourquoi plutot que de croire a un bug. */
  const nc = b.criteres || S.criteres.length;
  $('rankSub').textContent = vw.length
    ? `${vw.length} classé${vw.length > 1 ? 's' : ''} sur ${b.participants} participants · il fallait noter les ${nc} critères`
    : `personne n'a noté les ${nc} critères`;

  const pod = $('podium');
  pod.innerHTML = '';
  const BADGE = [
    ['#FBE3B9', '#E5B863', '#8A5A12'],
    ['#FFD2E3', '#F7B4CD', '#A8386A'],
    ['#DCD1F7', '#C3B2EE', '#5B4A9B']
  ];
  vw.slice(0, 3).forEach((v, i) => {
    const c = el('div', 'pod' + (i === 0 ? ' first' : ''), pod);
    const b = el('div', 'pod-badge', c);
    b.textContent = String(v.rank);
    b.style.cssText = `background:${BADGE[i][0]};border:2px solid ${BADGE[i][1]};color:${BADGE[i][2]}`;
    el('div', 'pod-name', c).textContent = trunc(v.name, 11);
    const s = el('div', 'pod-score', c);
    s.textContent = v.avg.toFixed(1);
    s.style.color = i === 0 ? '#C9911F' : noteColor(v.avg);
  });

  const list = $('rankList');
  list.innerHTML = '';
  list.style.transition = 'none';
  list.style.transform = 'translateY(0)';
  vw.slice(3).forEach((v, i) => {
    const r = el('div', 'rk' + (i % 2 ? ' alt' : ''), list);
    const n = el('div', 'rk-n', r);
    n.textContent = '#' + v.rank;
    el('div', 'rk-name', r).textContent = trunc(v.name, 20);
    const bar = el('div', 'rk-bar', r);
    const fill = el('div', null, bar);
    fill.style.cssText = `width:${v.avg * 10}%;background:${noteColor(v.avg)}`;
    const val = el('div', 'rk-v', r);
    val.textContent = v.avg.toFixed(1);
    val.style.color = noteColor(v.avg);
  });
}

/* Le chat s'empile vers le bas (justify-content: flex-end cote CSS) : les
   lignes anciennes sortent par le haut et sont rognees par le conteneur.
   On garde quand meme un plafond de noeuds, une session dure longtemps. */
function pousserChat(messages) {
  if (!messages || !messages.length) return;
  const list = $('feedList');
  messages.forEach((m) => {
    const item = el('div', 'fd', list);
    item.dataset.id = m.id;
    item.dataset.user = (m.name || '').toLowerCase();

    const n = el('span', 'fd-name', item);
    n.textContent = trunc(m.name, 22);

    // Un chiffre seul pendant un critere ouvert : on le montre comme une note.
    if (m.vote != null && S.active >= 0) {
      const chip = el('span', 'fd-note', item);
      chip.textContent = String(m.vote);
      chip.style.color = noteColor(m.vote);
    } else {
      const t = el('span', 'fd-msg', item);
      t.textContent = m.texte;
    }
  });
  while (list.children.length > FEED_MAX) list.removeChild(list.firstChild);
}

// Moderation : retirer un message, tout ce qu'a dit un viewer, ou tout effacer.
function supprimerChat({ id, name, tout }) {
  const list = $('feedList');
  if (tout) { list.innerHTML = ''; return; }
  [...list.children].forEach((n) => {
    if ((id && n.dataset.id === id) || (name && n.dataset.user === name.toLowerCase())) n.remove();
  });
}


// ---------------------------------------------------------------- rideau

function balayage(pendantLaCouverture) {
  const c = $('curtain');
  c.style.transform = `translateX(${CURTAIN_COVER}px)`;
  after(900, () => {
    if (pendantLaCouverture) pendantLaCouverture();
    after(320, () => {
      c.style.transform = `translateX(${CURTAIN_EXIT}px)`;
      after(950, () => {
        c.style.transition = 'none';
        c.style.transform = `translateX(${CURTAIN_OFF}px)`;
        requestAnimationFrame(() => { c.style.transition = ''; });
      });
    });
  });
}

// ---------------------------------------------------------------- machine a etats

/* Rend le panneau visible en le laissant s'animer. Passer de display:none a
   visible et enlever .out dans la meme frame annulerait la transition : il faut
   forcer un reflow entre les deux. */
function montrerPanneau() {
  const p = $('panel');
  if (!p.classList.contains('hidden')) { p.classList.remove('out'); return; }
  p.classList.remove('hidden');
  void p.offsetWidth;
  p.classList.remove('out');
}

function go(scene, arg) {
  clearTimers();
  S.calcRun = false;
  S.scene = scene;
  if (scene !== 's3' && scene !== 's4') S.active = -1;
  viderBulles();

  const panel = $('panel'), hof = $('hof'), rank = $('rank');

  const cacherResultats = () => {
    hof.classList.remove('in', 's1', 's2', 's3');
    rank.classList.remove('in');
    after(700, () => {
      if (S.scene !== 's6' && S.scene !== 's7') hof.classList.remove('mounted');
      if (S.scene !== 's8') rank.classList.remove('mounted');
    });
  };

  // Le chat ne quitte jamais l'ecran, meme au repos et pendant les resultats.
  // Au repos il occupe toute la colonne ; des que le segment demarre il se
  // replie sous le tableau (le classement s'arrete a 838, lui commence a 866).
  $('feed').classList.add('in');
  $('feed').classList.toggle('compact', scene !== 'idle');
  $('feed').classList.toggle('mini', scene === 's5');

  if (scene === 'idle') {
    panel.classList.add('out');
    $('hint').classList.remove('in');
    $('calc').classList.remove('in');
    cacherResultats();
    $('mood').setAttribute('opacity', '0');
    after(900, () => panel.classList.add('hidden'));
  }

  else if (scene === 's1') {
    // Le generique : le rideau de nuages balaye l'ecran et decouvre la carte
    // titre. C'est la seule apparition du segment, elle merite le balayage.
    montrerMoyenneGenerale(false);
    cacherResultats();
    $('hint').classList.remove('in');
    $('calc').classList.remove('in');
    $('mood').setAttribute('opacity', '0');
    panel.classList.add('intro');
    peindreLignes();
    balayage(() => montrerPanneau());
  }

  else if (scene === 's2') {
    montrerPanneau();
    panel.classList.remove('intro');
    montrerMoyenneGenerale(false);
    S.rows.forEach((r) => { r.entered = false; r.state = 'upcoming'; });
    peindreLignes();
    // Cascade d'arrivee des 8 lignes : c'est de l'animation, pas une etape.
    S.rows.forEach((r, i) => after(420 + i * 78, () => { r.entered = true; peindreLignes(); }));
    after(1100, () => $('hint').classList.add('in'));
  }

  else if (scene === 's3') {
    const i = arg == null ? 0 : arg;
    S.active = i;
    montrerPanneau();
    panel.classList.remove('intro');
    cacherResultats();
    montrerMoyenneGenerale(false);
    $('calc').classList.remove('in');
    $('hint').classList.add('in');
    S.rows.forEach((r, k) => {
      r.entered = true;
      /* Une ligne deja jouee reste « done », meme si Amina n'a pas donne sa
         note : sinon passer au critere suivant la renvoyait a « a venir » et
         effacait la moyenne du chat qu'on venait d'afficher. La jauge d'Amina
         sait deja montrer « – » quand la note manque.

         On se fie aussi aux votes recus, pas seulement a la position : en
         revenant en arriere, les criteres deja notes doivent garder leurs
         chiffres. */
      const dejaJouee = k < i || r.amina != null || r.count > 0;
      r.state = k === i ? 'active' : dejaJouee ? 'done' : 'upcoming';
    });
    peindreLignes();
  }

  else if (scene === 's5') {
    montrerPanneau();
    panel.classList.remove('intro');
    cacherResultats();
    S.rows.forEach((r) => { r.entered = true; r.state = 'done'; });
    peindreLignes();
    $('hint').classList.remove('in');
    after(450, () => {
      $('calc').classList.add('in');
      S.calcRun = true;
      S.calcStart = Date.now();
    });
    // Le calcul est une animation de 9 s puis la moyenne generale reste a
    // l'ecran : c'est elle qui decide quand passer a la meilleure semaine.
    after(9800, () => {
      S.calcRun = false;
      $('calcFill').style.width = '100%';
      $('calcNum').textContent = moyenneChat();
      montrerMoyenneGenerale(true);
    });
    after(11200, () => $('calc').classList.remove('in'));
  }

  else if (scene === 's6') {
    $('hint').classList.remove('in');
    $('calc').classList.remove('in');
    rank.classList.remove('in', 'mounted');
    balayage(() => {
      panel.classList.add('out');
      peindreHof('best');
      $('hof').classList.add('mounted');
      $('mood').setAttribute('fill', '#FFD98A');
      $('mood').setAttribute('opacity', '0.22');
    });
    after(1000, () => hof.classList.add('in'));
    after(1150, () => hof.classList.add('s1'));
    after(1900, () => hof.classList.add('s2'));
    after(2750, () => hof.classList.add('s3'));
  }

  else if (scene === 's7') {
    panel.classList.add('out');
    hof.classList.add('mounted', 'in', 's1');
    peindreHof('worst');
    $('mood').setAttribute('fill', '#6E86A8');
    $('mood').setAttribute('opacity', '0.42');
    after(600, () => hof.classList.add('s2'));
    after(1400, () => hof.classList.add('s3'));
  }

  else if (scene === 's8') {
    balayage(() => {
      panel.classList.add('out');
      hof.classList.remove('in', 'mounted', 's1', 's2', 's3');
      $('mood').setAttribute('opacity', '0');
      peindreClassement();
      rank.classList.add('mounted');
    });
    after(1250, () => rank.classList.add('in'));
    after(2850, () => {
      const lignes = Math.max(0, S.viewers.length - 3);
      const debord = Math.max(0, lignes * 47 - 500);
      // 30 px/s (valeur du handoff), mais plafonne : au-dela de ~90 viewers
      // le defilement durerait plusieurs minutes a cette vitesse.
      const max = S.reglages.defilementMaxSec || 40;
      const duree = debord > 0 ? Math.min(debord / 30, max) : 0.001;
      const list = $('rankList');
      list.style.transition = `transform ${duree}s linear`;
      list.style.transform = `translateY(${-debord}px)`;
      // Le defilement se termine tout seul, mais on reste sur le classement :
      // c'est la telecommande qui declenche la sortie.
    });
  }

  else if (scene === 's9') {
    $('hint').classList.remove('in');
    $('calc').classList.remove('in');
    after(200, () => {
      panel.classList.add('out');
      rank.classList.remove('in');
      hof.classList.remove('in', 's1', 's2', 's3');
    });
    balayage(() => {
      hof.classList.remove('mounted');
      rank.classList.remove('mounted');
      $('mood').setAttribute('opacity', '0');
      montrerMoyenneGenerale(false);
      panel.classList.add('hidden');
    });
  }
}

// Amina vient de valider : tampon + onde + verdict.
function valider(index, note, tally) {
  const r = S.rows[index];
  const d = dom.rows[index];
  if (!r || !d) return;
  clearTimers();
  S.scene = 's4';
  r.amina = note;
  if (tally) { r.count = tally.count; r.avg = tally.avg; r.dist = tally.dist || []; }

  const ecart = Math.abs(note - r.avg);
  r.verdict = r.count === 0 ? 'le chat n’a pas voté' : ecart < 0.35 ? 'même avis !' : ecart >= 2.6 ? 'gros écart' : '';

  peindreLignes();

  // Le tampon et l'onde doivent rejouer a chaque validation : on force le redemarrage.
  d.gANum.style.animation = 'none';
  void d.gANum.offsetWidth;
  d.gANum.style.animation = 'stampIn .55s cubic-bezier(.2,1.3,.4,1) both';
  const ring = el('div', 'ring', d.gANum);
  after(800, () => ring.remove());

  after(1200, () => { r.state = 'done'; peindreLignes(); });
}

// ---------------------------------------------------------------- boucle 60ms

setInterval(() => {
  let sale = false;
  S.rows.forEach((r) => {
    const cible = r.state === 'upcoming' ? 0 : r.avg;
    if (Math.abs(r.disp - cible) > 0.004) { r.disp += (cible - r.disp) * 0.22; sale = true; }
    if (r.pulse) { r.pulse = false; sale = true; }
  });
  if (sale) peindreLignes();

  if (S.calcRun) {
    const p = Math.min(1, (Date.now() - S.calcStart) / 9000);
    $('calcFill').style.width = (p * 100) + '%';
    $('calcNum').textContent = p < 0.94 ? (Math.random() * 10).toFixed(1) : moyenneChat();
    if (p >= 1) S.calcRun = false;
  }
}, 60);

// ---------------------------------------------------------------- WebSocket

let ws = null;
function envoyer(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function connecter() {
  // wss:// quand la page est servie en HTTPS : un navigateur refuse une
  // connexion ws:// non chiffree depuis une page securisee.
  const protocole = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocole}://${location.host}`);

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);

    if (m.t === 'hello') {
      // Le serveur a redemarre depuis que cette page est ouverte : son code a
      // peut-etre change, on repart proprement plutot que de rester desynchronise.
      if (S.instance && S.instance !== m.instance) { location.reload(); return; }
      S.instance = m.instance;
      S.reglages = { ...S.reglages, ...m.reglages };
      S.criteres = m.criteres;
      S.etapes = m.etapes;
      S.rows = S.criteres.map(newRow);
      // Le viewer a l'antenne fait partie de l'etat : une page rechargee en
      // pleine emission doit le retrouver, pas revenir au tableau global.
      S.focus = m.etat.focus || null;
      S.bilan = m.etat.bilan || S.bilan;
      S.weekLabel = m.etat.weekLabel || '';
      construireScene();
      reprendre(m.etat);
      peindreEntete();
      return;
    }
    // Toute la sequence est pilotee par les etapes envoyees par le serveur.
    if (m.t === 'etape') {
      S.weekLabel = m.weekLabel;
      if (m.bilan) S.bilan = m.bilan;
      peindreEntete();
      if (m.viewers && m.viewers.length) S.viewers = m.viewers;
      if (m.id === 's1') S.rows = S.criteres.map(newRow);
      go(m.activeIndex >= 0 ? 's3' : m.id, m.activeIndex);
      return;
    }
    if (m.t === 'etat') {
      S.focus = m.etat.focus || null;
      if (m.etat.bilan) S.bilan = m.etat.bilan;
      peindreEntete();
      peindreLignes();
      if (!m.etat.actif) go('idle');
      return;
    }
    // La regie met la semaine d'un viewer a l'antenne, ou revient au tableau.
    if (m.t === 'focus') {
      S.focus = m.viewer || null;
      peindreEntete();
      peindreLignes();
      // La moyenne generale affichee doit suivre, si elle est a l'ecran.
      if ($('globalSlot').children.length) montrerMoyenneGenerale(true);
      return;
    }
    // Les criteres ont change depuis la telecommande : on refait le tableau.
    if (m.t === 'criteres') {
      S.criteres = m.criteres;
      S.etapes = m.etapes;
      S.rows = S.criteres.map(newRow);
      construireLignes();
      go('idle');
      return;
    }
    if (m.t === 'amina-annulee') {
      const r = S.rows[m.index];
      if (r) { r.amina = null; r.verdict = ''; r.state = 'active'; peindreLignes(); }
      return;
    }
    if (m.t === 'tally') {
      bullesDeVote(m.votants);
      const r = S.rows[m.index];
      if (r) { r.count = m.count; r.avg = m.avg; r.dist = m.dist || []; r.pulse = true; peindreLignes(); }
      return;
    }
    if (m.t === 'chat') { pousserChat(m.messages); return; }
    if (m.t === 'chat-suppr') { supprimerChat(m); return; }
    if (m.t === 'amina') { valider(m.index, m.note, m.tally); return; }
  };

  ws.onclose = () => setTimeout(connecter, 1500);
  ws.onerror = () => ws.close();
}

// Rechargement de l'overlay en plein segment : on se remet a la bonne image.
function reprendre(etat) {
  if (!etat || !etat.actif) { go('idle'); return; }
  $('weekChip').textContent = etat.weekLabel;
  etat.rows.forEach((r, i) => {
    S.rows[i].count = r.count;
    S.rows[i].avg = r.avg;
    S.rows[i].disp = r.avg;
    S.rows[i].dist = r.dist || [];
    S.rows[i].amina = r.amina;
  });
  S.viewers = etat.viewers || [];
  go(etat.activeIndex >= 0 ? 's3' : etat.etapeId, etat.activeIndex);
}

// Le pilotage se fait uniquement depuis /control : cette page n'est qu'un
// affichage, elle n'ecoute ni le clavier ni la souris.

connecter();
