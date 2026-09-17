import { demarrerBot } from './index.js';

// Lance le bot seul (sans le site). Utile en local ; en production c'est
// server/index.js qui s'en charge, dans le meme processus que le site.
demarrerBot().catch((e) => {
  console.error(`⚠ ${e.message}`);
  process.exit(1);
});
