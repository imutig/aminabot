/* Reconnaissance des reponses du tchat.

   Regle validee avec la streameuse : accents et pluriel ignores, mais le mot
   doit etre exact - pas de tolerance aux fautes de frappe (ca demanderait un
   modele de langue, donc un cout par message).

   Vit ici plutot que dans le bot : la regle doit etre la meme quelle que soit
   la source du message, et le bot doit rester bete. */

// « GÂTEAUX » -> « gateaux »
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // retire les accents
    .replace(/['’`]/g, ' ')            // « l'eau » -> « l eau »
    .replace(/[^a-z0-9 ]/g, ' ')       // ponctuation, emojis
    .replace(/\s+/g, ' ')
    .trim();
}

/* Egalite au pluriel pres. On ne coupe pas le « s » final betement - « jus »
   deviendrait « ju » - on compare les deux formes entre elles. */
function memeMot(a: string, b: string): boolean {
  if (a === b) return true;
  for (const suffixe of ['s', 'x']) {
    if (a === b + suffixe || b === a + suffixe) return true;
  }
  return false;
}

/* Le libelle est-il present dans le message ?

   Un libelle d'un seul mot doit correspondre a un mot entier du message :
   « nappe » accepte « la nappe ! » mais pas « nappement ».
   Un libelle de plusieurs mots doit apparaitre comme une suite de mots :
   « bonne ambiance » accepte « une bonne ambiance ». */
export function contientLibelle(message: string, libelle: string): boolean {
  const mots = normaliser(message).split(' ').filter(Boolean);
  const cible = normaliser(libelle).split(' ').filter(Boolean);
  if (!cible.length || !mots.length) return false;

  for (let i = 0; i + cible.length <= mots.length; i++) {
    let ok = true;
    for (let k = 0; k < cible.length; k++) {
      if (!memeMot(mots[i + k], cible[k])) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/* Renvoie l'index de la case trouvee, ou -1. `dejaTrouvees` evite qu'une case
   deja levee soit re-attribuee a quelqu'un d'autre. */
export function chercherReponse(
  message: string,
  reponses: { labels: string[] }[],
  dejaTrouvees: Set<number>
): number {
  for (let i = 0; i < reponses.length; i++) {
    if (dejaTrouvees.has(i)) continue;
    for (const libelle of reponses[i].labels) {
      if (contientLibelle(message, libelle)) return i;
    }
  }
  return -1;
}

// « DESSERT/GÂTEAU » -> ['DESSERT', 'GÂTEAU'] (saisie de la streameuse)
export function decouperLibelles(saisie: string): string[] {
  return saisie.split('/').map((s) => s.trim()).filter(Boolean);
}
