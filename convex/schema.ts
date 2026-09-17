import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/* Une reponse d'une question. `labels` contient tous les libelles acceptes
   (« DESSERT/GÂTEAU » -> ['dessert', 'gateau']). La comparaison se fait sur une
   forme normalisee : minuscules, sans accent, sans pluriel. Le premier libelle
   est celui qu'on affiche a l'antenne. */
const reponse = v.object({
  labels: v.array(v.string()),
  points: v.number()
});

export default defineSchema({
  /* Reglages d'affichage, hors partie. Une seule ligne.
     Table separee des parties : la cam doit pouvoir se masquer meme quand
     aucune partie ne tourne. */
  reglages: defineTable({
    cam: v.boolean()   // false = trou bouche, on voit le jeu en entier
  }),

  /* ---------- Preparation (hors live) ---------- */

  // Un paquet de questions prepare a l'avance pour une session.
  jeuxDeQuestions: defineTable({
    nom: v.string(),
    creeLe: v.number()
  }),

  questions: defineTable({
    jeuId: v.id('jeuxDeQuestions'),
    ordre: v.number(),          // 1..6
    texte: v.string(),
    double: v.boolean(),        // manche a points doubles, choisie a la preparation
    reponses: v.array(reponse)  // 4 a 10, triees par points decroissants a l'affichage
  }).index('par_jeu', ['jeuId', 'ordre']),

  /* ---------- Partie en cours ---------- */

  /* Une seule partie vit a la fois, mais on garde les anciennes pour l'historique.
     `enCours` distingue la partie active. Tout l'etat de mise en scene est ici :
     l'overlay et la regie s'y abonnent et voient donc rigoureusement la meme chose. */
  parties: defineTable({
    enCours: v.boolean(),
    mode: v.union(v.literal('solo'), v.literal('famille')),
    ecran: v.string(),          // 'E1' … 'E10'
    manche: v.number(),         // 1..6
    jeuId: v.optional(v.id('jeuxDeQuestions')),
    nbEquipes: v.number(),      // 2..6
    phase: v.union(v.literal('jeu'), v.literal('cascade')),
    finaleN: v.number(),        // rangs reveles en partant du dernier
    podium: v.number(),         // 0 liste · 1 3e pose · 2 2e · 3 1er + confettis
    creeLe: v.number()
  }).index('par_etat', ['enCours']),

  joueurs: defineTable({
    partieId: v.id('parties'),
    twitchId: v.string(),
    pseudo: v.string(),
    points: v.number(),
    equipe: v.optional(v.number()),  // index d'equipe en mode famille
    rejointLe: v.number()
  })
    .index('par_partie', ['partieId'])
    // Sert au « on peut rejoindre a tout moment » : on verifie si le viewer joue deja.
    .index('par_partie_twitch', ['partieId', 'twitchId']),

  equipes: defineTable({
    partieId: v.id('parties'),
    index: v.number(),
    nom: v.string(),
    couleur: v.string(),
    points: v.number()
  }).index('par_partie', ['partieId', 'index']),

  /* Une case levee. L'absence de ligne = case encore cachee.
     `cascade` distingue « revelee en fin de manche » de « trouvee ». */
  revelations: defineTable({
    partieId: v.id('parties'),
    manche: v.number(),
    caseIndex: v.number(),
    trouveur: v.optional(v.string()),   // pseudo, pour « trouve par … »
    cascade: v.boolean(),
    a: v.number()
  }).index('par_manche', ['partieId', 'manche']),

  /* Le tchat affiche a l'ecran. On ne garde qu'une fenetre glissante :
     le panneau n'affiche que 7 lignes, inutile d'accumuler. */
  tchat: defineTable({
    partieId: v.id('parties'),
    pseudo: v.string(),
    texte: v.string(),
    bonneReponse: v.boolean(),
    a: v.number()
  }).index('par_partie', ['partieId', 'a'])
});
