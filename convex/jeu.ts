import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { partieActive } from './partie.ts';
import { chercherReponse } from './lib/reponses.ts';
import { LIGNES_TCHAT } from './lib/regles.ts';

/* Le point d'entree du tchat. Tout message passe ici : c'est ce qui alimente le
   panneau a l'ecran ET ce qui declenche la levee des bandeaux.

   La detection vit cote serveur et pas dans le bot : la regle doit etre unique,
   et le bot doit rester bete. */
export const message = mutation({
  args: {
    twitchId: v.string(),
    pseudo: v.string(),
    texte: v.string()
  },
  handler: async (ctx, { twitchId, pseudo, texte }) => {
    const p = await partieActive(ctx);
    if (!p) return { effet: 'aucune-partie' as const };

    let bonneReponse = false;
    let effet: 'rien' | 'trouve' = 'rien';
    let caseIndex = -1;

    // On ne cherche une reponse que pendant qu'une manche est ouverte.
    if (p.ecran === 'E6' && p.phase === 'jeu' && p.jeuId) {
      const question = await ctx.db
        .query('questions')
        .withIndex('par_jeu', (q) => q.eq('jeuId', p.jeuId!).eq('ordre', p.manche))
        .first();

      if (question) {
        const deja = await ctx.db.query('revelations')
          .withIndex('par_manche', (q) => q.eq('partieId', p._id).eq('manche', p.manche))
          .collect();

        // Les reponses sont triees par points decroissants a l'affichage : la
        // detection doit travailler sur le meme ordre, sinon les index divergent.
        const reponses = [...question.reponses].sort((a, b) => b.points - a.points);
        const trouvees = new Set(deja.map((r) => r.caseIndex));

        caseIndex = chercherReponse(texte, reponses, trouvees);
        if (caseIndex >= 0) {
          bonneReponse = true;
          effet = 'trouve';

          // Seul un joueur inscrit marque. Un spectateur qui n'a pas ecrit « moi »
          // leve quand meme la case : le jeu avance, mais sans points.
          const joueur = await ctx.db
            .query('joueurs')
            .withIndex('par_partie_twitch', (q) => q.eq('partieId', p._id).eq('twitchId', twitchId))
            .first();

          await ctx.db.insert('revelations', {
            partieId: p._id,
            manche: p.manche,
            caseIndex,
            trouveur: pseudo,
            cascade: false,
            a: Date.now()
          });

          if (joueur) {
            const pts = reponses[caseIndex].points * (question.double ? 2 : 1);
            await ctx.db.patch(joueur._id, { points: joueur.points + pts });

            if (p.mode === 'famille' && joueur.equipe != null) {
              const eq = await ctx.db
                .query('equipes')
                .withIndex('par_partie', (q) => q.eq('partieId', p._id).eq('index', joueur.equipe!))
                .first();
              if (eq) await ctx.db.patch(eq._id, { points: eq.points + pts });
            }
          }
        }
      }
    }

    await ctx.db.insert('tchat', {
      partieId: p._id, pseudo, texte: texte.slice(0, 120), bonneReponse, a: Date.now()
    });
    await purgerTchat(ctx, p._id);

    return { effet, caseIndex };
  }
});

/* Le panneau n'affiche que 7 lignes. On garde une petite marge et on jette le
   reste : sans ca la table enfle a chaque live pour rien. */
async function purgerTchat(ctx: any, partieId: any) {
  const vieux = await ctx.db
    .query('tchat')
    .withIndex('par_partie', (q: any) => q.eq('partieId', partieId))
    .order('desc')
    .collect();
  for (const l of vieux.slice(LIGNES_TCHAT * 3)) await ctx.db.delete(l._id);
}

/* Filet de securite pour la regie : lever une case a la main si la detection
   passe a cote (orthographe exotique, reponse formulee autrement). */
export const revelerCase = mutation({
  args: { caseIndex: v.number(), trouveur: v.optional(v.string()) },
  handler: async (ctx, { caseIndex, trouveur }) => {
    const p = await partieActive(ctx);
    if (!p) return;
    const deja = await ctx.db.query('revelations')
      .withIndex('par_manche', (q) => q.eq('partieId', p._id).eq('manche', p.manche)).collect();
    if (deja.some((r) => r.caseIndex === caseIndex)) return;

    await ctx.db.insert('revelations', {
      partieId: p._id, manche: p.manche, caseIndex, trouveur, cascade: false, a: Date.now()
    });
  }
});
