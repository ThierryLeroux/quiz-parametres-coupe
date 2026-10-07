// Aucun numéro de décision (« D25 », « D40 »…) dans un texte visible : écrans du quiz, attestation,
// /verifier, espace professeur, Gestion du contenu, et les messages que le serveur renvoie au navigateur. Les
// numéros restent dans les commentaires du code et dans les documents (D52). Plus aucun « éditeur » affiché
// non plus, ni bouton « Ouvrir » dans la Gestion du contenu (D74). Depuis D93 : aucun vocabulaire interne
// (serveur, enregistrement, détenir, recomposer, jeton) ni vouvoiement dans une phrase affichable.
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

// Les textes affichables d'un fichier : ses chaînes, ou, pour une page HTML, tout sauf les scripts.
function textesDe(fichier) {
  const source = sansCommentaires(readFileSync(new URL(fichier, ROOT), 'utf8'));
  return fichier.endsWith('.html') ? [source.replace(/<script[\s\S]*?<\/script>/g, '')] : source.match(CHAINES) ?? [];
}

test('aucun numéro de décision « Dnn » dans une chaîne affichable du site ou du serveur', () => {
  const trouves = [];
  for (const fichier of FICHIERS) {
    for (const texte of textesDe(fichier)) if (NUMERO.test(texte)) trouves.push(`${fichier} : ${texte.trim().slice(0, 80)}`);
  }
  assert.deepEqual(trouves, []);
  assert.ok(FICHIERS.length > 20);
});

// La page /prof/editeur s'appelle « Gestion du contenu » (D74) : plus aucun « éditeur » affiché — titre, en-tête, lien
// de l'espace professeur, accueil, messages. L'adresse, les routes, les fichiers et les identifiants gardent « editeur ».
const EDITEUR = /[Éé]diteur/;

test('aucun « éditeur » dans une chaîne affichable (D74) : la page s’appelle « Gestion du contenu »', () => {
  const trouves = [];
  for (const fichier of FICHIERS) {
    for (const texte of textesDe(fichier)) if (EDITEUR.test(texte)) trouves.push(`${fichier} : ${texte.trim().slice(0, 80)}`);
  }
  assert.deepEqual(trouves, []);
  const page = readFileSync(new URL('site/prof/editeur.html', ROOT), 'utf8');
  assert.match(page, /<title>Gestion du contenu — /);
  assert.match(page, /id="header-title">Gestion du contenu</);
});

// Le bouton qui ouvre un élément d'une liste pour le modifier s'appelle « Modifier » (D74), jamais « Ouvrir ».
test('Gestion du contenu (D74) : aucun bouton « Ouvrir », les listes disent « Modifier »', () => {
  const chaines = sansCommentaires(readFileSync(new URL('site/js/ui/editeur.js', ROOT), 'utf8')).match(CHAINES);
  assert.equal(chaines.filter((texte) => texte.slice(1, -1) === 'Ouvrir').length, 0);
  assert.equal(chaines.filter((texte) => texte.slice(1, -1) === 'Modifier').length, 2); // Exercices et Banque d'outils
});

// --- D93 : aucun vocabulaire interne, aucun vouvoiement ------------------------------------------------------------------
// Les mots que l'étudiant et le professeur n'ont pas à lire : le serveur (de correction), l'enregistrement au sens de
// « ce qui est gardé », détenir, recomposer, le jeton — et « vous ». Seules les PHRASES comptent : une chaîne qui a
// au moins deux mots de lettres séparés par une espace (une clé comme 'jeton', un en-tête comme 'Bearer ${jeton}', un
// nom de colonne SQL, un nom d'action du journal ne sont pas affichés). Les fichiers qui ne parlent qu'à la base ou au
// développeur (base.js : du SQL ; crypto.js : la configuration des secrets) ne sont pas regardés.
const INTERNE = /\b(serveurs?|enregistrements?|détenir|détient|détenue?s?|recompos\w*|jetons?)\b|\b(vous|votre|vos)\b|veuillez/i;
const PAS_REGARDES = ['worker/base.js', 'worker/crypto.js'];
const estUnePhrase = (texte) => /[a-zà-ü]+ [a-zà-ü]+/i.test(texte);

test('D93 : aucun « serveur », « enregistrement », « détenir », « recomposer », « jeton » ni vouvoiement dans une phrase affichable', () => {
  const trouves = [];
  for (const fichier of FICHIERS.filter((f) => !PAS_REGARDES.includes(f))) {
    for (const texte of textesDe(fichier)) if (estUnePhrase(texte) && INTERNE.test(texte)) trouves.push(`${fichier} : ${texte.trim().slice(0, 100)}`);
  }
  assert.deepEqual(trouves, []);
});

// Le test voit bien un numéro : « (D12) » dans une chaîne est attrapé, en commentaire non.
test('le détecteur attrape un numéro dans une chaîne, pas dans un commentaire', () => {
  const code = "// voir D12\nconst a = 'Un échec remet le compteur à zéro (D12).';\nconst b = `x ${y} D40`;";
  const chaines = sansCommentaires(code).match(CHAINES);
  assert.deepEqual(chaines.map((c) => NUMERO.test(c)), [true, true]);
  assert.equal(NUMERO.test(sansCommentaires('// D12 seulement\nconst c = 1;')), false);
  // Et le vocabulaire interne : dans une phrase, oui ; dans une clé ou une colonne, non.
  assert.ok(INTERNE.test('Le serveur de correction ne répond pas.'));
  assert.ok(INTERNE.test("Voici l'enregistrement tel qu'il le détient."));
  assert.ok(INTERNE.test('Veuillez patienter'));
  assert.equal(estUnePhrase('jeton'), false);
  assert.equal(estUnePhrase('Bearer ${jeton}'), false); // un en-tête, pas une phrase
  assert.equal(estUnePhrase('jeton_hache = ?'), false);
  assert.equal(estUnePhrase('WHERE jeton_hache = ?'), true);
  assert.equal(INTERNE.test('WHERE jeton_hache = ?'), false); // le mot soudé à « _hache » n'est pas « jeton »
  assert.equal(INTERNE.test('Enregistrer le brouillon'), false); // le verbe reste
});
