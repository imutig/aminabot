/* Test des regles de reconnaissance. Lancer avec : node convex/lib/reponses.test.ts */
import { contientLibelle, chercherReponse, decouperLibelles } from './reponses.ts';

const cas: [string, string, boolean, string][] = [
  ['sandwichs', 'SANDWICH', true, 'pluriel ignore'],
  ['sandwich', 'SANDWICHS', true, 'pluriel inverse'],
  ['GATEAU', 'gâteau', true, 'accent ignore'],
  ['des gâteaux !!', 'GATEAU', true, 'accent + pluriel + ponctuation'],
  ['une bonne ambiance', 'BONNE AMBIANCE', true, 'libelle multi-mots'],
  ['nappement', 'NAPPE', false, 'pas de correspondance partielle'],
  ['le jus', 'JUS', true, 'mot en -s non mutile'],
  ['sandwich', 'NAPPE', false, 'mot different'],
  ['sandwixh', 'SANDWICH', false, 'faute de frappe refusee (attendu)'],
  ['la nappe.', 'NAPPE', true, 'ponctuation collee'],
  ['jsp moi je dirais chocolat', 'CHOCOLAT', true, 'noye dans une phrase'],
  ["l'eau", 'EAU', true, 'apostrophe'],
  ['🍰 gateau 🍰', 'GATEAU', true, 'emojis autour']
];

let ko = 0;
for (const [msg, lib, attendu, quoi] of cas) {
  const r = contientLibelle(msg, lib);
  if (r !== attendu) ko++;
  console.log(`${r === attendu ? ' ok ' : ' KO '} ${JSON.stringify(msg).padEnd(30)} vs ${lib.padEnd(16)} -> ${String(r).padEnd(5)} ${quoi}`);
}

const reps = [{ labels: ['sandwich'] }, { labels: ['dessert', 'gateau'] }];
console.log('');
const a = chercherReponse('des gateaux', reps, new Set());
const b = chercherReponse('des gateaux', reps, new Set([1]));
const c = decouperLibelles('DESSERT/GÂTEAU');
console.log(` ${a === 1 ? 'ok ' : 'KO '} chercherReponse -> ${a} (attendu 1)`);
console.log(` ${b === -1 ? 'ok ' : 'KO '} case deja trouvee -> ${b} (attendu -1)`);
console.log(` ${c.length === 2 ? 'ok ' : 'KO '} decouperLibelles -> ${JSON.stringify(c)}`);
if (a !== 1 || b !== -1 || c.length !== 2) ko++;

console.log(ko ? `\n${ko} ECHEC(S)` : '\nTous les cas passent');
