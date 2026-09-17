/* Faux chat, pour repeter sans etre en live.
   Ne pilote RIEN : il se contente d'envoyer des votes sur le critere
   qui est ouvert. C'est toi qui menes la sequence depuis /control. */

const A = ['pixie', 'moon', 'choco', 'sakura', 'nova', 'kiwi', 'lulu', 'mochi', 'zephyr', 'plume', 'bubble', 'cosmo', 'yuki', 'praline', 'tofu', 'velvet', 'gaufre', 'nimbus', 'kokoro', 'ambre'];
const B = ['_gaming', 'chan', 'ette', '_ttv', '77', 'boo', '_uwu', 'zinho', '_off', 'ita', 'san', '_x', '2000', 'ky', '_live'];

const BAVARDAGES = [
  'ma semaine a ete horrible mdr', 'jai bien dormi pour une fois', 'coucou tout le monde',
  'jsuis daccord', 'ah non la cest severe', 'mdrrr', 'perso je mets 10 partout',
  'la semaine a ete longue', 'jai fait du sport 3 fois !!', 'meme avis que toi',
  'non mais franchement', 'jsuis en retard dsl', 'trop bien ce segment',
  'moi cest zero direct', 'jai rien fait de la semaine', 'courage a tous'
];

export function demarrerDemo(session, { onLog, onChat, nbViewers = 90 } = {}) {
  const log = onLog || (() => {});
  let seq = 0;
  const dire = (name, texte, vote = null) => {
    if (onChat) onChat({ id: 'demo-' + (seq++), userId: name, name, texte, vote });
  };

  const viewers = [];
  const vus = new Set();
  while (viewers.length < nbViewers) {
    let n = A[(Math.random() * A.length) | 0] + B[(Math.random() * B.length) | 0];
    if (Math.random() < 0.25) n += ((Math.random() * 90) | 0) + 10;
    if (vus.has(n)) continue;
    vus.add(n);
    // Chaque viewer a son temperament : certains notent haut, d'autres bas.
    viewers.push({ id: 'demo-' + viewers.length, name: n, biais: (Math.random() - 0.5) * 3.2 });
  }

  let flux = null;
  let k = 0;

  session.on('etape', ({ activeIndex }) => {
    clearInterval(flux);
    if (activeIndex < 0) return;
    k = 0;
    const base = 4 + Math.random() * 3.4; // tendance propre au critere
    log(`DEMO · votes en cours sur « ${session.criteres[activeIndex].nom} »`);
    flux = setInterval(() => {
      if (session.activeIndex !== activeIndex) { clearInterval(flux); return; }
      const lot = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < lot && k < viewers.length; i++, k++) {
        const v = viewers[k];
        const brut = base + v.biais + (Math.random() - 0.5) * 2.4;
        const note = Math.max(0, Math.min(10, Math.round(brut)));
        session.voter(v.id, v.name, note);
        dire(v.name, String(note), note);
      }
      if (k >= viewers.length) clearInterval(flux);
    }, 170);
  });

  session.on('etat', () => { if (!session.actif) clearInterval(flux); });

  // Bavardage de fond : le chat doit vivre meme quand aucun vote n'est ouvert,
  // sinon on ne voit pas ce que donne l'ecran au repos.
  setInterval(() => {
    const v = viewers[(Math.random() * viewers.length) | 0];
    dire(v.name, BAVARDAGES[(Math.random() * BAVARDAGES.length) | 0]);
  }, 2600);
}
