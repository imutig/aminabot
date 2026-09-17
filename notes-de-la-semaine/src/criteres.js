import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITERES } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FICHIER = path.join(__dirname, '..', 'criteres.json');

export const MAX_CRITERES = 12;
export const MIN_CRITERES = 2;

// Habillage des lignes : nuage bicolore + petite forme blanche par-dessus.
// Les criteres crees depuis la telecommande piochent ici a tour de role,
// pour qu'ils aient tous une identite visuelle sans avoir a la choisir.
const HABILLAGES = [
  { tint: '#DCD1F7', edge: '#C3B2EE', mw: 15, mh: 15, mr: '50%',                 mrot: 0 },
  { tint: '#FFD2E3', edge: '#F9B4CD', mw: 19, mh: 8,  mr: '999px',               mrot: -18 },
  { tint: '#FFDCC2', edge: '#F7C09B', mw: 14, mh: 14, mr: '4px',                 mrot: 45 },
  { tint: '#CFEBDE', edge: '#A9D8C3', mw: 17, mh: 11, mr: '999px 999px 5px 5px', mrot: 0 },
  { tint: '#CFE0FA', edge: '#A9C4EE', mw: 8,  mh: 17, mr: '999px',               mrot: 0 },
  { tint: '#E4D6FA', edge: '#C9B4EE', mw: 13, mh: 13, mr: '4px 12px 4px 12px',   mrot: 0 },
  { tint: '#FFD9E9', edge: '#F9BAD3', mw: 18, mh: 9,  mr: '999px',               mrot: 0 },
  { tint: '#FBE3B9', edge: '#F0CB86', mw: 15, mh: 15, mr: '5px 15px 5px 15px',   mrot: 45 },
  { tint: '#D6EFF7', edge: '#AEDCEB', mw: 16, mh: 10, mr: '999px',               mrot: 12 },
  { tint: '#F7E3D0', edge: '#EBC7A6', mw: 13, mh: 13, mr: '50%',                 mrot: 0 },
  { tint: '#E0E7FB', edge: '#BCC9F0', mw: 17, mh: 9,  mr: '3px',                 mrot: -30 },
  { tint: '#F3D9EC', edge: '#E4B4D6', mw: 14, mh: 14, mr: '4px 14px 4px 14px',   mrot: 20 }
];

// Nettoie et complete une liste venue de la telecommande. On ne fait jamais
// confiance a l'entree : c'est ce qui pilote l'affichage a l'antenne.
export function normaliser(liste) {
  if (!Array.isArray(liste)) return null;
  const propre = liste
    .map((c) => ({
      nom: String(c?.nom ?? '').trim().slice(0, 22),
      coef: Number(c?.coef)
    }))
    .filter((c) => c.nom.length > 0)
    .slice(0, MAX_CRITERES)
    .map((c, i) => ({
      nom: c.nom,
      // Coefficient : 0.5 a 5, arrondi au demi. 1 = poids normal.
      coef: Number.isFinite(c.coef) ? Math.min(5, Math.max(0.5, Math.round(c.coef * 2) / 2)) : 1,
      ...HABILLAGES[i % HABILLAGES.length]
    }));
  return propre.length >= MIN_CRITERES ? propre : null;
}

export function charger() {
  try {
    const brut = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    const ok = normaliser(brut);
    if (ok) return ok;
  } catch { /* pas de fichier, ou fichier casse : on retombe sur les defauts */ }
  return normaliser(CRITERES.map((c) => ({ nom: c.nom, coef: c.coef ?? 1 })));
}

export function sauver(liste) {
  const ok = normaliser(liste);
  if (!ok) return null;
  fs.writeFileSync(FICHIER, JSON.stringify(ok.map((c) => ({ nom: c.nom, coef: c.coef })), null, 2), 'utf8');
  return ok;
}
