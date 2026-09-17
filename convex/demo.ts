import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { decouperLibelles } from './lib/reponses.ts';
import { NB_MANCHES } from './lib/regles.ts';

/* Donnees de demonstration, pour repeter sans avoir a tout saisir.
   A lancer avec : npx convex run demo:remplir */

const QUESTIONS = [
  ['Citez quelque chose qui fait partie d’un pique-nique réussi', false, [
    ['SANDWICHS/SANDWICH', 10], ['DESSERT/GÂTEAU', 8], ['BONNE AMBIANCE', 8],
    ['CHOCOLAT', 7], ['NAPPE', 5], ['JEU/JEUX', 2], ['BOISSON/BOISSONS', 6], ['SOLEIL', 4]
  ]],
  ['Citez une chose qu’on oublie toujours en partant en vacances', false, [
    ['CHARGEUR', 10], ['BROSSE À DENTS', 8], ['MAILLOT/MAILLOT DE BAIN', 7],
    ['CRÈME SOLAIRE', 6], ['PASSEPORT', 5], ['CLÉS', 3]
  ]],
  ['Citez un truc qu’on fait quand on s’ennuie', false, [
    ['TÉLÉPHONE/SCROLLER', 10], ['DORMIR', 9], ['MANGER', 8], ['SÉRIE/NETFLIX', 7],
    ['MÉNAGE', 4], ['MUSIQUE', 4], ['SORTIR', 3], ['JEU VIDÉO', 6]
  ]],
  ['Citez quelque chose qu’on trouve dans un sac à main', false, [
    ['CLÉS', 10], ['TÉLÉPHONE', 9], ['PORTEFEUILLE', 8], ['MOUCHOIRS', 6], ['ROUGE À LÈVRES', 5]
  ]],
  ['Citez une excuse pour ne pas aller au sport', true, [
    ['FATIGUE/FATIGUÉ', 10], ['PAS LE TEMPS', 9], ['BLESSURE', 7],
    ['MAUVAIS TEMPS', 6], ['PAS ENVIE', 5], ['TRAVAIL', 4]
  ]],
  ['Citez quelque chose qui rend une soirée inoubliable', true, [
    ['MUSIQUE', 10], ['AMIS', 9], ['NOURRITURE', 7], ['DANSE', 6],
    ['RIRE/RIGOLADE', 5], ['SURPRISE', 4], ['PHOTOS', 3]
  ]]
];

export const remplir = mutation({
  args: { nom: v.optional(v.string()) },
  handler: async (ctx, { nom }) => {
    const jeuId = await ctx.db.insert('jeuxDeQuestions', {
      nom: nom ?? 'Démo', creeLe: Date.now()
    });

    for (let i = 0; i < NB_MANCHES; i++) {
      const [texte, double, reps] = QUESTIONS[i] as [string, boolean, [string, number][]];
      await ctx.db.insert('questions', {
        jeuId,
        ordre: i + 1,
        texte,
        double,
        reponses: reps.map(([saisie, points]) => ({ labels: decouperLibelles(saisie), points }))
      });
    }
    return jeuId;
  }
});

/* Faux joueurs, pour voir le lobby et les equipes se remplir. */
export const faussJoueurs = mutation({
  args: { n: v.number() },
  handler: async (ctx, { n }) => {
    const partie = await ctx.db.query('parties')
      .withIndex('par_etat', (q) => q.eq('enCours', true)).first();
    if (!partie) throw new Error('Aucune partie en cours');

    const A = ['pixie', 'moon', 'choco', 'sakura', 'nova', 'kiwi', 'lulu', 'mochi', 'zephyr', 'plume', 'bubble', 'cosmo'];
    const B = ['_gaming', 'chan', 'ette', '_ttv', '77', 'boo', '_uwu', 'zinho', '_off', 'ita'];

    for (let i = 0; i < n; i++) {
      await ctx.db.insert('joueurs', {
        partieId: partie._id,
        twitchId: 'demo-' + i,
        pseudo: A[i % A.length] + B[(i * 3) % B.length],
        points: 0,
        equipe: undefined,
        rejointLe: Date.now() + i
      });
    }
    return n;
  }
});
