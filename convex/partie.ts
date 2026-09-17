import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { COULEURS_EQUIPES, NB_MANCHES } from './lib/regles.ts';

/* Cycle de vie de la partie et navigation entre les 10 ecrans.

   Une seule partie est `enCours` a la fois. Tout l'etat de mise en scene vit
   dans le document `parties` : l'overlay et la regie s'y abonnent, ils voient
   donc rigoureusement la meme chose - c'est la contrainte n°1 du handoff. */

export async function partieActive(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query('parties')
    .withIndex('par_etat', (q) => q.eq('enCours', true))
    .first();
}

async function exigerPartie(ctx: MutationCtx) {
  const p = await partieActive(ctx);
  if (!p) throw new Error('Aucune partie en cours');
  return p;
}

/* ---------------------------------------------------------------- lecture */

/* L'unique abonnement des deux vues. Renvoie tout ce qu'un ecran peut afficher :
   mieux vaut une requete un peu large qu'une demi-douzaine d'abonnements qui
   arrivent dans le desordre et font clignoter l'affichage. */
export const etat = query({
  args: {},
  handler: async (ctx) => {
    const partie = await partieActive(ctx);
    if (!partie) return null;

    const [joueurs, equipes, revelations, tchat] = await Promise.all([
      ctx.db.query('joueurs').withIndex('par_partie', (q) => q.eq('partieId', partie._id)).collect(),
      ctx.db.query('equipes').withIndex('par_partie', (q) => q.eq('partieId', partie._id)).collect(),
      ctx.db.query('revelations')
        .withIndex('par_manche', (q) => q.eq('partieId', partie._id).eq('manche', partie.manche))
        .collect(),
      ctx.db.query('tchat')
        .withIndex('par_partie', (q) => q.eq('partieId', partie._id))
        .order('desc').take(7)
    ]);

    const question = partie.jeuId ? await questionDeLaManche(ctx, partie.jeuId, partie.manche) : null;

    return {
      partie,
      joueurs: joueurs.sort((a, b) => b.points - a.points || a.rejointLe - b.rejointLe),
      equipes: equipes.sort((a, b) => a.index - b.index),
      revelations,
      tchat: tchat.reverse(),
      question: question && {
        texte: question.texte,
        double: question.double,
        // Les points affiches sont deja multiplies : la manche double doit se
        // lire sur les cases, pas seulement sur le bandeau du bas.
        reponses: question.reponses
          .map((r) => ({ ...r, points: r.points * (question.double ? 2 : 1) }))
          .sort((a, b) => b.points - a.points)
      },
      nbManches: NB_MANCHES
    };
  }
});

async function questionDeLaManche(ctx: QueryCtx | MutationCtx, jeuId: Id<'jeuxDeQuestions'>, manche: number) {
  return await ctx.db
    .query('questions')
    .withIndex('par_jeu', (q) => q.eq('jeuId', jeuId).eq('ordre', manche))
    .first();
}

/* ---------------------------------------------------------------- pilotage */

export const demarrer = mutation({
  args: { mode: v.union(v.literal('solo'), v.literal('famille')), jeuId: v.optional(v.id('jeuxDeQuestions')) },
  handler: async (ctx, { mode, jeuId }) => {
    // Une partie deja ouverte est close, jamais supprimee : on garde l'historique.
    const ancienne = await partieActive(ctx);
    if (ancienne) await ctx.db.patch(ancienne._id, { enCours: false });

    /* Sans choix explicite, on prend le paquet le plus recent QUI CONTIENT
       VRAIMENT DES QUESTIONS. Un paquet fraichement cree est plein de manches
       vides : le prendre donnerait une partie sans question ni reponse, donc
       injouable, et sans rien pour le signaler a l'ecran. */
    let choisi = jeuId;
    if (!choisi) {
      const jeux = await ctx.db.query('jeuxDeQuestions').order('desc').collect();
      for (const j of jeux) {
        const qs = await ctx.db.query('questions')
          .withIndex('par_jeu', (q) => q.eq('jeuId', j._id)).collect();
        if (qs.some((q) => q.texte.trim() && q.reponses.length > 0)) { choisi = j._id; break; }
      }
    }

    return await ctx.db.insert('parties', {
      enCours: true,
      mode,
      ecran: mode === 'solo' ? 'E2' : 'E3',
      manche: 1,
      jeuId: choisi,
      nbEquipes: 2,
      phase: 'jeu',
      finaleN: 0,
      podium: 0,
      creeLe: Date.now()
    });
  }
});

/* Saut direct vers un ecran (regie). Arriver sur la finale par ce chemin la
   rejoue depuis le debut : sinon on retombe sur un podium deja rempli, ce qui
   n'a aucun sens quand on veut la relancer. `precedent` ne passe pas par ici. */
export const allerA = mutation({
  args: { ecran: v.string() },
  handler: async (ctx, { ecran }) => {
    const p = await exigerPartie(ctx);
    const remise = ecran === 'E9' ? { finaleN: 0, podium: 0 } : {};
    await ctx.db.patch(p._id, { ecran, ...remise });
  }
});

export const reglerNbEquipes = mutation({
  args: { n: v.number() },
  handler: async (ctx, { n }) => {
    const p = await exigerPartie(ctx);
    await ctx.db.patch(p._id, { nbEquipes: Math.max(2, Math.min(6, Math.round(n))) });
  }
});

/* L'action principale de la barre de commandes : une seule fonction qui connait
   tout l'enchainement. La regie n'a pas a savoir ou elle en est. */
export const suivant = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const p = await exigerPartie(ctx);
    const ecranPoints = p.mode === 'solo' ? 'E7' : 'E8';

    switch (p.ecran) {
      case 'E2':
      case 'E4':
        return await ctx.db.patch(p._id, { ecran: 'E5' });

      case 'E5':
        return await ctx.db.patch(p._id, { ecran: 'E6', phase: 'jeu' });

      case 'E6':
        // Deux temps : on devoile d'abord les cases non trouvees, puis on sort.
        if (p.phase === 'jeu') {
          await revelerRestantes(ctx, p);
          return await ctx.db.patch(p._id, { phase: 'cascade' });
        }
        return await ctx.db.patch(p._id, { ecran: ecranPoints });

      case 'E7':
      case 'E8':
        if (p.manche >= NB_MANCHES) {
          return await ctx.db.patch(p._id, { ecran: 'E9', finaleN: 0, podium: 0 });
        }
        return await ctx.db.patch(p._id, { ecran: 'E6', manche: p.manche + 1, phase: 'jeu' });

      case 'E9':
        return await avancerFinale(ctx, p);

      case 'E10':
        return await ctx.db.patch(p._id, { enCours: false });

      default:
        return;
    }
  }
});

/* La finale : on revele du dernier au premier, puis les trois derniers deviennent
   le podium (3e, puis 2e, puis 1er). En mode famille a 2 equipes, pas de podium
   a trois marches : c'est un duel. */
async function avancerFinale(ctx: MutationCtx, p: Doc<'parties'>) {
  const classes = await classement(ctx, p);
  const total = classes.length;
  const marches = Math.min(3, total);

  // Phase 1 : derouler la liste jusqu'a ne laisser que les finalistes.
  if (p.finaleN < total - marches) {
    return await ctx.db.patch(p._id, { finaleN: p.finaleN + 1 });
  }
  // Phase 2 : poser les marches une par une.
  if (p.podium < marches) {
    return await ctx.db.patch(p._id, { podium: p.podium + 1 });
  }
  return await ctx.db.patch(p._id, { ecran: 'E10' });
}

export const precedent = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const p = await exigerPartie(ctx);
    if (p.ecran === 'E9') {
      if (p.podium > 0) return await ctx.db.patch(p._id, { podium: p.podium - 1 });
      if (p.finaleN > 0) return await ctx.db.patch(p._id, { finaleN: p.finaleN - 1 });
      return await ctx.db.patch(p._id, { ecran: p.mode === 'solo' ? 'E7' : 'E8' });
    }
    if (p.ecran === 'E6' && p.phase === 'cascade') {
      // On rouvre la manche : les cases devoilees en cascade redeviennent cachees,
      // celles trouvees par le tchat restent acquises.
      const rev = await ctx.db.query('revelations')
        .withIndex('par_manche', (q) => q.eq('partieId', p._id).eq('manche', p.manche)).collect();
      await Promise.all(rev.filter((r) => r.cascade).map((r) => ctx.db.delete(r._id)));
      return await ctx.db.patch(p._id, { phase: 'jeu' });
    }
    const retour: Record<string, string> = {
      E5: p.mode === 'solo' ? 'E2' : 'E4', E4: 'E3', E6: 'E5', E7: 'E6', E8: 'E6', E10: 'E9'
    };
    const cible = retour[p.ecran];
    if (cible) await ctx.db.patch(p._id, { ecran: cible, phase: 'jeu' });
  }
});

export const arreter = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const p = await partieActive(ctx);
    if (p) await ctx.db.patch(p._id, { enCours: false });
  }
});

/* ---------------------------------------------------------------- interne */

/* Devoile toutes les cases encore cachees de la manche. `cascade: true` les
   distingue des cases trouvees : elles s'affichent en mode mineur. */
async function revelerRestantes(ctx: MutationCtx, p: Doc<'parties'>) {
  if (!p.jeuId) return;
  const question = await questionDeLaManche(ctx, p.jeuId, p.manche);
  if (!question) return;

  const deja = await ctx.db.query('revelations')
    .withIndex('par_manche', (q) => q.eq('partieId', p._id).eq('manche', p.manche)).collect();
  const trouvees = new Set(deja.map((r) => r.caseIndex));

  const maintenant = Date.now();
  for (let i = 0; i < question.reponses.length; i++) {
    if (trouvees.has(i)) continue;
    await ctx.db.insert('revelations', {
      partieId: p._id, manche: p.manche, caseIndex: i, cascade: true, a: maintenant
    });
  }
}

/* Le classement final : les joueurs en solo, les equipes en famille. */
export async function classement(ctx: QueryCtx | MutationCtx, p: Doc<'parties'>) {
  if (p.mode === 'famille') {
    const eq = await ctx.db.query('equipes')
      .withIndex('par_partie', (q) => q.eq('partieId', p._id)).collect();
    return eq
      .map((e) => ({ nom: e.nom, points: e.points, couleur: e.couleur }))
      .sort((a, b) => b.points - a.points);
  }
  const j = await ctx.db.query('joueurs')
    .withIndex('par_partie', (q) => q.eq('partieId', p._id)).collect();
  return j
    .map((x) => ({ nom: x.pseudo, points: x.points, couleur: COULEURS_EQUIPES[0] }))
    .sort((a, b) => b.points - a.points || a.nom.localeCompare(b.nom));
}

export const classementFinal = query({
  args: {},
  handler: async (ctx) => {
    const p = await partieActive(ctx);
    return p ? await classement(ctx, p) : [];
  }
});
