import { mutation } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { partieActive } from './partie.ts';
import { COULEURS_EQUIPES, NOMS_EQUIPES } from './lib/regles.ts';

/* Arrivee des joueurs et composition des familles. */

/* Un viewer ecrit « moi ». Fonctionne a n'importe quel moment de la partie -
   y compris en pleine manche : il est alors affecte a l'equipe la moins remplie
   pour ne pas desequilibrer. */
export const rejoindre = mutation({
  args: { twitchId: v.string(), pseudo: v.string() },
  handler: async (ctx, { twitchId, pseudo }) => {
    const p = await partieActive(ctx);
    if (!p) return null;

    const existant = await ctx.db
      .query('joueurs')
      .withIndex('par_partie_twitch', (q) => q.eq('partieId', p._id).eq('twitchId', twitchId))
      .first();
    if (existant) {
      // Deja la : on rafraichit juste le pseudo (il peut avoir change de casse).
      if (existant.pseudo !== pseudo) await ctx.db.patch(existant._id, { pseudo });
      return existant._id;
    }

    const equipe = p.mode === 'famille' ? await equipeLaMoinsRemplie(ctx, p) : undefined;

    return await ctx.db.insert('joueurs', {
      partieId: p._id,
      twitchId,
      pseudo,
      points: 0,
      equipe,
      rejointLe: Date.now()
    });
  }
});

async function equipeLaMoinsRemplie(ctx: MutationCtx, p: Doc<'parties'>) {
  const equipes = await ctx.db.query('equipes')
    .withIndex('par_partie', (q) => q.eq('partieId', p._id)).collect();
  if (!equipes.length) return undefined; // les equipes ne sont pas encore tirees

  const joueurs = await ctx.db.query('joueurs')
    .withIndex('par_partie', (q) => q.eq('partieId', p._id)).collect();
  const effectifs = new Map(equipes.map((e) => [e.index, 0]));
  for (const j of joueurs) {
    if (j.equipe != null) effectifs.set(j.equipe, (effectifs.get(j.equipe) ?? 0) + 1);
  }
  let choix = equipes[0].index;
  for (const e of equipes) {
    if ((effectifs.get(e.index) ?? 0) < (effectifs.get(choix) ?? 0)) choix = e.index;
  }
  return choix;
}

/* Tirage des familles : liste melangee puis distribuee en round-robin, ce qui
   garantit des effectifs equilibres a un joueur pres. */
export const creerEquipes = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const p = await partieActive(ctx);
    if (!p) throw new Error('Aucune partie en cours');

    const anciennes = await ctx.db.query('equipes')
      .withIndex('par_partie', (q) => q.eq('partieId', p._id)).collect();
    await Promise.all(anciennes.map((e) => ctx.db.delete(e._id)));

    const n = Math.max(2, Math.min(6, p.nbEquipes));
    for (let i = 0; i < n; i++) {
      await ctx.db.insert('equipes', {
        partieId: p._id,
        index: i,
        nom: NOMS_EQUIPES[i],
        couleur: COULEURS_EQUIPES[i],
        points: 0
      });
    }

    const joueurs = await ctx.db.query('joueurs')
      .withIndex('par_partie', (q) => q.eq('partieId', p._id)).collect();

    const melange = [...joueurs];
    for (let i = melange.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [melange[i], melange[k]] = [melange[k], melange[i]];
    }
    await Promise.all(melange.map((j, i) => ctx.db.patch(j._id, { equipe: i % n })));

    await ctx.db.patch(p._id, { ecran: 'E4' });
  }
});
