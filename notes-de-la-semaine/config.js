// Configuration du segment « Les notes de la semaine ».
// C'est le seul fichier a editer au quotidien.

export const config = {
  // ---- Serveur ----
  port: 4747,

  // ---- Scene ----
  // Cote ou se trouve la fenetre cam dans l'overlay : 'gauche' ou 'droite'.
  camSide: 'gauche',
  // Affiche le rectangle bleu « CAM » qui montre ou placer la webcam.
  // Passe a true si tu as besoin de revoir le reperage.
  camPlaceholder: false,

  // ---- Contenu ----
  aminaName: 'Amina',
  // Laisse a null pour que le libelle soit calcule automatiquement
  // a partir de la date du jour (ex. « Semaine du 24 → 30 juillet »).
  weekLabel: null,

  // ---- Regles de vote ----
  // Un viewer note SA propre semaine, de 0 a 10, en tapant un chiffre dans le chat.
  // Le dernier message envoye remplace le vote precedent.
  minNote: 0,
  maxNote: 10,
  // Nombre minimum de criteres notes pour apparaitre au classement.
  // Evite qu'un viewer arrive au dernier critere, tape 10, et gagne la semaine.
  // null = les trois quarts des criteres (6 sur 8).
  minCriteresPourClasser: null,

  // ---- Pilotage ----
  // TOUT est manuel : rien n'avance sans une action. Le pilotage se fait depuis
  // la telecommande http://localhost:4747/control (ou depuis le chat).
  //
  // Quand la streameuse tape un chiffre seul dans le chat, c'est sa note.
  // (Ne se declenche que si le message est EXACTEMENT un nombre, et
  // uniquement pendant qu'un critere est en cours.)
  chiffreSeulPourAmina: true,
  // Pseudos autorises a piloter le segment, en plus de la streameuse et des mods.
  pilotes: [],

  // Duree maximale du defilement du classement final, en secondes.
  // Le handoff prevoit 30 px/s, ce qui donne 88 s pour 70 viewers et plus de
  // 7 minutes pour 300. On garde 30 px/s tant qu'on tient dans ce plafond,
  // et on accelere au-dela pour que la fin du segment reste regardable.
  defilementMaxSec: 40,

  // ---- Commandes ----
  commandes: {
    start: ['!notes', '!lesnotes', '!notesdelasemaine'],
    next: ['!next', '!suivant'],
    prev: ['!prev', '!retour'],
    note: ['!note', '!n'],
    stop: ['!stop', '!fin'],
    reset: ['!reset']
  }
};

// Les 8 criteres. L'ordre est celui du tableau a l'ecran.
// tint/edge = les deux teintes du petit nuage, marker = la forme blanche par-dessus.
export const CRITERES = [
  { nom: 'Sommeil',         tint: '#DCD1F7', edge: '#C3B2EE', mw: 15, mh: 15, mr: '50%',                  mrot: 0 },
  { nom: 'Vie sociale',     tint: '#FFD2E3', edge: '#F9B4CD', mw: 19, mh: 8,  mr: '999px',                mrot: -18 },
  { nom: 'Motivation',      tint: '#FFDCC2', edge: '#F7C09B', mw: 14, mh: 14, mr: '4px',                  mrot: 45 },
  { nom: 'Alimentation',    tint: '#CFEBDE', edge: '#A9D8C3', mw: 17, mh: 11, mr: '999px 999px 5px 5px',  mrot: 0 },
  { nom: 'Sport',           tint: '#CFE0FA', edge: '#A9C4EE', mw: 8,  mh: 17, mr: '999px',                mrot: 0 },
  { nom: 'Charge mentale',  tint: '#E4D6FA', edge: '#C9B4EE', mw: 13, mh: 13, mr: '4px 12px 4px 12px',    mrot: 0 },
  { nom: 'Petits plaisirs', tint: '#FFD9E9', edge: '#F9BAD3', mw: 18, mh: 9,  mr: '999px',                mrot: 0 },
  { nom: 'Semaine globale', tint: '#FBE3B9', edge: '#F0CB86', mw: 15, mh: 15, mr: '5px 15px 5px 15px',    mrot: 45 }
];

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

// « Semaine du 24 → 30 juillet » — calcule sur la semaine qui vient de s'ecouler.
export function libelleSemaine(date = new Date()) {
  const fin = new Date(date);
  const debut = new Date(date);
  debut.setDate(debut.getDate() - 6);
  const memeMois = debut.getMonth() === fin.getMonth();
  const g = memeMois ? `${debut.getDate()}` : `${debut.getDate()} ${MOIS[debut.getMonth()]}`;
  return `Semaine du ${g} → ${fin.getDate()} ${MOIS[fin.getMonth()]}`;
}
