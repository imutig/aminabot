import { EventEmitter } from 'node:events';
import { config, libelleSemaine } from '../config.js';
import { charger as chargerCriteres, sauver as sauverCriteres } from './criteres.js';

/* Source de verite du segment. Ne connait rien de Twitch ni de l'affichage.
   Tout est manuel : rien n'avance sans un appel explicite (telecommande /control,
   commande dans le chat, ou raccourci clavier). Aucun minuteur. */

// La sequence, dans l'ordre. Les criteres sont inseres entre le tableau et le calcul.
function construireEtapes(criteres) {
  return [
    { id: 's1', label: 'Générique', court: 'S1' },
    { id: 's2', label: 'Tableau', court: 'S2' },
    ...criteres.map((c, i) => ({ id: 'c' + i, label: c.nom, court: String(i + 1), critere: i })),
    { id: 's5', label: 'Calcul des notes', court: 'S5' },
    { id: 's6', label: 'Meilleure semaine', court: 'S6' },
    { id: 's7', label: 'Pire semaine', court: 'S7' },
    { id: 's8', label: 'Classement', court: 'S8' },
    { id: 's9', label: 'Sortie', court: 'S9' }
  ];
}

export class Session extends EventEmitter {
  constructor() {
    super();
    this.criteres = chargerCriteres();
    this.etapes = construireEtapes(this.criteres);
    this.reset();
  }

  // Remplace la liste des criteres (depuis la telecommande). Refuse pendant
  // un segment a l'antenne : ca invaliderait les votes deja recus.
  definirCriteres(liste) {
    if (this.actif) return { ok: false, raison: 'Segment en cours' };
    const ok = sauverCriteres(liste);
    if (!ok) return { ok: false, raison: 'Liste invalide' };
    this.criteres = ok;
    this.etapes = construireEtapes(this.criteres);
    this.reset();
    this.emit('criteres', { criteres: this.criteres, etapes: this.etapes });
    return { ok: true };
  }

  reset() {
    this.actif = false;      // le segment est-il a l'antenne
    this.pas = -1;           // index dans this.etapes, -1 = au repos
    this.activeIndex = -1;   // critere ouvert au vote, -1 = aucun
    this.focusId = null;     // viewer dont la semaine est a l'antenne
    this.weekLabel = config.weekLabel || libelleSemaine();
    this.rows = this.criteres.map(() => ({ votes: new Map(), amina: null, locked: false }));
    this.viewers = [];
    this.emit('etat', this.snapshot());
  }

  // ---- Pilotage ----

  start() {
    this.reset();
    this.actif = true;
    this.allerA(0);
    return true;
  }

  stop() {
    this.actif = false;
    this.pas = -1;
    this.activeIndex = -1;
    this.emit('etat', this.snapshot());
    return true;
  }

  suivant() { return this.allerA(this.pas + 1); }
  precedent() { return this.allerA(this.pas - 1); }

  // Le seul point d'entree qui fait bouger la sequence.
  allerA(n) {
    if (!this.actif) return false;
    const i = Math.max(0, Math.min(this.etapes.length - 1, n));
    const etape = this.etapes[i];
    this.pas = i;

    if (etape.critere != null) {
      // Ouvrir (ou rouvrir) un critere : les votes repartent, meme si on revient
      // en arriere apres l'avoir verrouille.
      this.activeIndex = etape.critere;
      this.rows[etape.critere].locked = false;
    } else {
      this.activeIndex = -1;
    }

    // Le classement se calcule des qu'on atteint le calcul, pour que les trois
    // ecrans de resultats parlent tous des memes chiffres.
    if (['s5', 's6', 's7', 's8'].includes(etape.id)) {
      this.rows.forEach((r) => { r.locked = true; });
      this.viewers = this.classement();
    }

    this.emit('etape', {
      pas: i,
      id: etape.id,
      label: etape.label,
      activeIndex: this.activeIndex,
      viewers: this.viewers
    });
    return true;
  }

  // Aller directement a un critere par son numero (1..8).
  allerAuCritere(n) {
    const i = this.etapes.findIndex((e) => e.critere === n - 1);
    return i >= 0 ? this.allerA(i) : false;
  }

  // ---- Notes ----

  // Note de la streameuse. Ne fait PAS avancer la sequence : c'est elle qui
  // decide quand passer au suivant. Une note deja posee peut etre corrigee.
  noterAmina(note) {
    const i = this.activeIndex;
    const row = this.rows[i];
    if (!this.actif || !row) return false;
    const n = clampNote(note);
    if (n == null) return false;
    row.amina = n;
    row.locked = true;
    this.emit('amina', { index: i, note: n, tally: this.tally(i) });
    return true;
  }

  // Annule la note du critere en cours et rouvre les votes.
  annulerNote() {
    const row = this.rows[this.activeIndex];
    if (!row) return false;
    row.amina = null;
    row.locked = false;
    this.emit('amina-annulee', { index: this.activeIndex, tally: this.tally(this.activeIndex) });
    return true;
  }

  // Un viewer note SA semaine sur le critere en cours. Dernier vote = celui qui compte.
  voter(userId, name, note) {
    const i = this.activeIndex;
    const row = this.rows[i];
    if (!this.actif || !row || row.locked) return false;
    const n = clampNote(note);
    if (n == null) return false;
    const correction = row.votes.has(userId);
    row.votes.set(userId, { name, note: n });
    this.emit('vote', { index: i, tally: this.tally(i), votant: { name, note: n, correction } });
    return true;
  }

  tally(i) {
    const row = this.rows[i];
    if (!row) return { index: i, count: 0, avg: 0 };
    let sum = 0;
    for (const v of row.votes.values()) sum += v.note;
    const count = row.votes.size;
    return { index: i, count, avg: count ? sum / count : 0 };
  }

  // ---- Participants ----

  /* La semaine de chaque votant, critere par critere.

     Recalcule a la demande plutot que maintenu : les votes changent en
     permanence pendant un critere, et un miroir a jour serait une source de
     bugs pour une liste qu'on ne regarde que par moments. */
  participants() {
    const m = new Map();
    this.rows.forEach((row, i) => {
      const coef = this.criteres[i].coef ?? 1;
      for (const [id, v] of row.votes) {
        let e = m.get(id);
        if (!e) {
          e = { id, name: v.name, notes: this.rows.map(() => null), sum: 0, poids: 0, n: 0 };
          m.set(id, e);
        }
        e.name = v.name;
        e.notes[i] = v.note;
        e.sum += v.note * coef;
        e.poids += coef;
        e.n += 1;
      }
    });
    return [...m.values()]
      .map((e) => ({
        id: e.id,
        name: e.name,
        notes: e.notes,
        n: e.n,
        avg: e.poids ? Math.round((e.sum / e.poids) * 10) / 10 : 0
      }))
      // Les plus assidus en haut : ce sont eux qu'on veut montrer a l'antenne.
      .sort((a, b) => b.n - a.n || b.avg - a.avg || a.name.localeCompare(b.name));
  }

  // Met la semaine d'un viewer a l'antenne, a la place des moyennes du chat.
  // id vide = retour au tableau global.
  montrerViewer(id) {
    if (!id) {
      this.focusId = null;
      this.emit('focus', { viewer: null });
      return true;
    }
    const p = this.participants().find((x) => x.id === id);
    if (!p) return false;
    this.focusId = id;
    this.emit('focus', { viewer: p });
    return true;
  }

  // Le viewer a l'antenne, recalcule : ses notes ont pu bouger depuis le clic.
  focusActuel() {
    if (!this.focusId) return null;
    return this.participants().find((x) => x.id === this.focusId) || null;
  }

  // ---- Classement ----

  // Moyenne de chaque viewer sur SES notes, ponderee par le coefficient
  // de chaque critere. Un critere a coef 2 pese double dans sa moyenne.
  classement() {
    const seuil = config.minCriteresPourClasser != null
      ? config.minCriteresPourClasser
      : Math.ceil(this.criteres.length * 0.75);

    const parViewer = new Map();
    this.rows.forEach((row, i) => {
      const coef = this.criteres[i].coef ?? 1;
      for (const [id, v] of row.votes) {
        let e = parViewer.get(id);
        if (!e) { e = { name: v.name, sum: 0, poids: 0, n: 0 }; parViewer.set(id, e); }
        e.name = v.name;
        e.sum += v.note * coef;
        e.poids += coef;
        e.n += 1;
      }
    });

    let list = [...parViewer.values()].filter((e) => e.n >= seuil);
    // Si le seuil vide le classement (peu de votants), on l'abaisse progressivement.
    if (list.length < 3) {
      for (let s = seuil - 1; s >= 1 && list.length < 3; s--) {
        list = [...parViewer.values()].filter((e) => e.n >= s);
      }
    }

    list = list.map((e) => ({
      name: e.name,
      avg: Math.round((e.sum / e.poids) * 10) / 10,
      votes: e.n
    }));
    list.sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));

    let rank = 1;
    list.forEach((v, i) => {
      if (i > 0 && v.avg < list[i - 1].avg) rank = i + 1;
      v.rank = rank;
    });
    return list;
  }

  snapshot() {
    return {
      actif: this.actif,
      pas: this.pas,
      etapeId: this.pas >= 0 ? this.etapes[this.pas].id : null,
      activeIndex: this.activeIndex,
      weekLabel: this.weekLabel,
      // Un overlay qui se recharge en pleine emission doit retrouver la
      // semaine du viewer qui etait affichee.
      focus: this.focusActuel(),
      rows: this.rows.map((r, i) => {
        const t = this.tally(i);
        return { count: t.count, avg: t.avg, amina: r.amina, locked: r.locked };
      }),
      viewers: this.viewers
    };
  }
}

function clampNote(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < config.minNote || r > config.maxNote) return null;
  return r;
}
