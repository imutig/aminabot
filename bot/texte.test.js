import test from 'node:test';
import assert from 'node:assert/strict';
import { texteChat } from './texte.js';

/* Ce bug a ete diagnostique a tort deux fois : une fois sur le « moi » de
   Famille en or, une fois sur les votes des notes de la semaine. A chaque
   fois on a conclu que Twitch avalait le message. Il arrivait bien : Twitch
   y collait juste un U+E0000 invisible. D'ou ce test. */

const TAG = '\u{E0000}';

test('un message normal est juste rogne', () => {
  assert.equal(texteChat('6'), '6');
  assert.equal(texteChat('  10  '), '10');
  assert.equal(texteChat('jsp  moi je dirais  chocolat'), 'jsp moi je dirais chocolat');
});

test('le caractere anti-doublon de Twitch disparait', () => {
  assert.equal(texteChat(`6 ${TAG}`), '6');
  assert.equal(texteChat(`6${TAG}`), '6');
  assert.equal(texteChat(`moi ${TAG}`), 'moi');
  assert.equal(texteChat(`8\u{E0001}`), '8');
});

test('les autres caracteres invisibles aussi', () => {
  assert.equal(texteChat('​7​'), '7');
  assert.equal(texteChat('﻿9'), '9');
  assert.equal(texteChat('4ㅤ'), '4');
});

test('un chiffre suivi du caractere invisible reste un vote valide', () => {
  const NOMBRE_SEUL = /^(10|[0-9])$/;
  for (const brut of ['0', '10', `7 ${TAG}`, `10${TAG}`]) {
    assert.ok(NOMBRE_SEUL.test(texteChat(brut)), `refuse a tort : ${JSON.stringify(brut)}`);
  }
});

test('ce qui n est pas un nombre le reste', () => {
  const NOMBRE_SEUL = /^(10|[0-9])$/;
  for (const brut of ['11', 'coucou', '7 sur 10', '']) {
    assert.ok(!NOMBRE_SEUL.test(texteChat(brut)), `accepte a tort : ${JSON.stringify(brut)}`);
  }
});
