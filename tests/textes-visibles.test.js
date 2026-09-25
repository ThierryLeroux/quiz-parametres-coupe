// Aucun numéro de décision (« D25 », « D40 »…) dans un texte visible : écrans du quiz, attestation,
// /verifier, espace professeur, éditeur, et les messages que le serveur renvoie au navigateur. Les
// numéros restent dans les commentaires du code et dans les documents (D52).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const listFiles = (dir, ext) => readdirSync(new URL(dir, ROOT)).filter((name) => name.endsWith(ext)).map((name) => `${dir}${name}`);
const FICHIERS = [
  ...listFiles('site/js/', '.js'),
  ...listFiles('site/js/ui/', '.js'),
  ...listFiles('worker/', '.js'),
  ...listFiles('site/', '.html'),
  ...listFiles('site/prof/', '.html'),
];

// Retire les commentaires (//, /* */, <!-- -->) : ce qui reste et se trouve entre guillemets est du texte affichable.
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

// Les chaînes du code : 'simples', "doubles" et `gabarits` (sans regarder dans leurs expressions).
const CHAINES = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;
const NUMERO = /\bD\d{1,3}\b/;

test('aucun numéro de décision « Dnn » dans une chaîne affichable du site ou du serveur', () => {
  const trouves = [];
  for (const fichier of FICHIERS) {
    const source = sansCommentaires(readFileSync(new URL(fichier, ROOT), 'utf8'));
    const textes = fichier.endsWith('.html') ? [source.replace(/<script[\s\S]*?<\/script>/g, '')] : source.match(CHAINES) ?? [];
    for (const texte of textes) if (NUMERO.test(texte)) trouves.push(`${fichier} : ${texte.trim().slice(0, 80)}`);
  }
  assert.deepEqual(trouves, []);
  assert.ok(FICHIERS.length > 20);
});

// Le test voit bien un numéro : « (D12) » dans une chaîne est attrapé, en commentaire non.
test('le détecteur attrape un numéro dans une chaîne, pas dans un commentaire', () => {
  const code = "// voir D12\nconst a = 'Un échec remet le compteur à zéro (D12).';\nconst b = `x ${y} D40`;";
  const chaines = sansCommentaires(code).match(CHAINES);
  assert.deepEqual(chaines.map((c) => NUMERO.test(c)), [true, true]);
  assert.equal(NUMERO.test(sansCommentaires('// D12 seulement\nconst c = 1;')), false);
});
