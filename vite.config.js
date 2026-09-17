import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const racine = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // `npx convex dev` ecrit .env.local a la racine du projet, alors que le root
  // Vite est web/. On charge le fichier nous-memes et on injecte l'URL dans la
  // page : ni `envDir` ni `define` ne se sont montres fiables ici.
  /* En local l'URL vient de .env.local ; en production (Railway) il n'y a pas
     de fichier, elle arrive par l'environnement. On regarde les deux. */
  const env = loadEnv(mode, racine, '');
  const url = process.env.VITE_CONVEX_URL || env.VITE_CONVEX_URL || '';
  if (!url) {
    console.warn('\n  ⚠ VITE_CONVEX_URL introuvable.');
    console.warn('    En local : lance `npx convex dev` une fois.');
    console.warn('    En production : ajoute la variable au service.\n');
  }

  return {
    root: 'web',
    plugins: [{
      name: 'injecte-url-convex',
      transformIndexHtml: () => [{
        tag: 'script',
        injectTo: 'head-prepend',
        children: `window.__CONVEX_URL__ = ${JSON.stringify(url)};`
      }]
    }],
    server: { port: 5178 },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      // Deux pages : le jeu et le site de preparation.
      rollupOptions: {
        input: {
          jeu: resolve(racine, 'web/index.html'),
          prep: resolve(racine, 'web/prep.html')
        }
      }
    }
  };
});
