import { query, mutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';

/* Reglages d'affichage partages par l'antenne et la regie.

   Pourquoi passer par la base pour un simple interrupteur : l'antenne (OBS) et
   la regie sont deux navigateurs distincts. Un etat local ne serait vu que d'un
   cote - la streameuse masquerait la cam chez elle sans que le public le voie. */

async function ligne(ctx: MutationCtx) {
  const r = await ctx.db.query('reglages').first();
  if (r) return r;
  const id = await ctx.db.insert('reglages', { cam: true });
  return (await ctx.db.get(id))!;
}

export const lire = query({
  args: {},
  handler: async (ctx) => {
    const r = await ctx.db.query('reglages').first();
    // Par defaut la cam est affichee : c'est le cas normal en live.
    return { cam: r?.cam ?? true };
  }
});

export const basculerCam = mutation({
  args: {},
  handler: async (ctx) => {
    const r = await ligne(ctx);
    await ctx.db.patch(r._id, { cam: !r.cam });
    return !r.cam;
  }
});
