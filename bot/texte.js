/* Nettoyage d'un message de tchat Twitch.

   Twitch refuse deux messages identiques d'affilee du meme utilisateur. Pour
   contourner son propre filtre, le client web de Twitch colle un caractere
   INVISIBLE a la fin du message repete : U+E0000, du bloc « Tags ».

   Le message arrive donc bien au bot, mais « 6 » vaut en realite « 6 \u{E0000} ».
   Toute comparaison stricte le rate, sans que rien ne le signale : a l'usage,
   un vote sur deux semble ignore alors que le message s'affiche bien dans le
   tchat. C'est exactement le symptome qu'on a eu sur les votes des notes de la
   semaine et sur le « moi » de Famille en or.

   On retire donc tout ce qui n'occupe aucune place a l'ecran avant d'analyser
   quoi que ce soit : bloc Tags, espaces de largeur nulle, marques de sens de
   lecture, jointeurs, selecteurs de variante, et les quelques caracteres
   « vides » employes pour le meme contournement (remplisseur hangul, braille
   blanc). */
const INVISIBLES =
  /[\u{E0000}-\u{E01EF}​-‏⁠-⁤﻿­͏᠎឴឵ᅟᅠㅤﾠ⠀]/gu;

export function texteChat(message) {
  return String(message ?? '')
    .replace(INVISIBLES, '')
    .replace(/\s+/g, ' ')
    .trim();
}
