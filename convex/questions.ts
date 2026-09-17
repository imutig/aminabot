import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { decouperLibelles } from './lib/reponses.ts';
import { NB_MANCHES, MIN_REPONSES, MAX_REPONSES } from './lib/regles.ts';

/* Preparation des questions, en amont du live. */

export const listerJeux = query({
  args: {},
  handler: async (ctx) => {
    const jeux = await ctx.db.query('jeuxDeQuestions').order('desc').collect();
    return await Promise.all(jeux.map(async (j) => {
      const qs = await ctx.db.query('questions')
        .withIndex('par_jeu', (q) => q.eq('jeuId', j._id)).collect();
      return { ...j, nbQuestions: qs.length };
    }));
  }
});

export const lireJeu = query({
  args: { jeuId: v.id('jeuxDeQuestions') },
  handler: async (ctx, { jeuId }) => {
    const jeu = await ctx.db.get(jeuId);
    if (!jeu) return null;
    const questions = await ctx.db.query('questions')
      .withIndex('par_jeu', (q) => q.eq('jeuId', jeuId)).collect();
    return { jeu, questions: questions.sort((a, b) => a.ordre - b.ordre) };
  }
});

export const creerJeu = mutation({
  args: { nom: v.string() },
  handler: async (ctx, { nom }) => {
    const jeuId = await ctx.db.insert('jeuxDeQuestions', {
      nom: nom.trim() || 'Sans titre',
      creeLe: Date.now()
    });
    // On amorce les 6 manches vides : la streameuse remplit, elle ne cree pas.
    for (let i = 1; i <= NB_MANCHES; i++) {
      await ctx.db.insert('questions', {
        jeuId, ordre: i, texte: '', double: i > NB_MANCHES - 2, reponses: []
      });
    }
    return jeuId;
  }
});

/* La saisie arrive telle que tapee : « DESSERT/GÂTEAU » avec ses points.
   On decoupe ici, une fois, plutot qu'a chaque message du tchat. */
export const enregistrerQuestion = mutation({
  args: {
    questionId: v.id('questions'),
    texte: v.string(),
    double: v.boolean(),
    reponses: v.array(v.object({ saisie: v.string(), points: v.number() }))
  },
  handler: async (ctx, { questionId, texte, double, reponses }) => {
    const propres = reponses
      .map((r) => ({ labels: decouperLibelles(r.saisie), points: Math.max(1, Math.round(r.points)) }))
      .filter((r) => r.labels.length > 0)
      .slice(0, MAX_REPONSES);

    await ctx.db.patch(questionId, { texte: texte.trim(), double, reponses: propres });
    return { nbReponses: propres.length, suffisant: propres.length >= MIN_REPONSES };
  }
});

export const supprimerJeu = mutation({
  args: { jeuId: v.id('jeuxDeQuestions') },
  handler: async (ctx, { jeuId }) => {
    const qs = await ctx.db.query('questions')
      .withIndex('par_jeu', (q) => q.eq('jeuId', jeuId)).collect();
    await Promise.all(qs.map((q) => ctx.db.delete(q._id)));
    await ctx.db.delete(jeuId);
  }
});
