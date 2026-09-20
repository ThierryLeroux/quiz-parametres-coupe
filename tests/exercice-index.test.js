// Tests de l'index des exercices offerts : site/exercices/index.json (SPEC §10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { loadExercise, loadExerciseIndex, validateExercise, validateExerciseIndex } from '../site/js/exercice.js';
import { data, lireFichier } from './aide.js';

const indexValide = () => ({
  _description: 'les clés qui commencent par _ sont ignorées',
  exercices: [
    { id: 'm10-tournage-vc', titre: 'M10 — Tournage : vitesse de coupe' },
    { id: 'essai-percage', titre: 'Essai — perçage' },
  ],
});

test('validateExerciseIndex : l’index d’essai est valide', () => {
  assert.deepEqual(validateExerciseIndex(indexValide()), []);
});

// Une anomalie à la fois → exactement une erreur.
const anomalies = [
  ['liste vide', (i) => { i.exercices = []; }, /« exercices » doit être une liste non vide/],
  ['liste absente', (i) => { delete i.exercices; }, /« exercices » doit être une liste non vide/],
  ['clé inconnue à la racine', (i) => { i.exercice = []; }, /clé inconnue « exercice »/],
  ['clé inconnue sur une entrée', (i) => { i.exercices[0].title = 'M10'; }, /« m10-tournage-vc » : clé inconnue « title »/],
  ['id qui n’a pas la forme d’un identifiant', (i) => { i.exercices[1].id = 'Essai Perçage'; }, /exercices\[1\] « Essai Perçage » : « id » n'a pas la forme/],
  ['id « index », réservé', (i) => { i.exercices[1].id = 'index'; }, /« index » : « id » n'a pas la forme/],
  ['id absent', (i) => { delete i.exercices[1].id; }, /exercices\[1\].*« id » n'a pas la forme/],
  ['exercice en double', (i) => { i.exercices[1].id = 'm10-tournage-vc'; }, /exercices\[1\] « m10-tournage-vc » : exercice en double/],
  ['titre vide', (i) => { i.exercices[0].titre = ''; }, /« m10-tournage-vc » : « titre » est vide/],
  ['entrée qui n’est pas un objet', (i) => { i.exercices[1] = 'essai-percage'; }, /exercices\[1\] n'est pas un objet/],
];

for (const [nom, abimer, attendu] of anomalies) {
  test(`validateExerciseIndex : ${nom}`, () => {
    const index = indexValide();
    abimer(index);
    const erreurs = validateExerciseIndex(index);
    assert.equal(erreurs.length, 1, `une seule erreur attendue, reçu :\n${erreurs.join('\n')}`);
    assert.match(erreurs[0], attendu);
  });
}

test('validateExerciseIndex : ne lève jamais d’exception', () => {
  assert.equal(validateExerciseIndex(null).length, 1);
  assert.equal(validateExerciseIndex([]).length, 1);
  assert.ok(validateExerciseIndex({}).length >= 1);
});

test('« index » est un identifiant réservé, pour l’exercice comme pour son chargement', async () => {
  const exercice = { id: 'index', titre: 'Piège', version: 'r0', champs_evalues: ['vc'], outils: [{ id: 'mvlnr', reussites_requises: 1 }] };
  assert.match(validateExercise(exercice, data)[0], /« id » doit être fait de minuscules/);
  await assert.rejects(loadExercise('index', data, 'exercices/', lireFichier), /Identifiant d'exercice invalide : « index »/);
});

test('loadExerciseIndex : lit <baseUrl>index.json et retourne la liste, sans les commentaires', async () => {
  const demandes = [];
  const liste = await loadExerciseIndex('ailleurs/', async (url) => { demandes.push(url); return indexValide(); });
  assert.deepEqual(demandes, ['ailleurs/index.json']);
  assert.deepEqual(liste, [
    { id: 'm10-tournage-vc', titre: 'M10 — Tournage : vitesse de coupe' },
    { id: 'essai-percage', titre: 'Essai — perçage' },
  ]);
});

test('loadExerciseIndex : index invalide → erreur qui énumère les problèmes', async () => {
  const index = indexValide();
  index.exercices[0].titre = '';
  index.exercices[1].id = 'm10-tournage-vc';
  await assert.rejects(loadExerciseIndex('exercices/', async () => index), (erreur) => {
    assert.match(erreur.message, /^Index des exercices invalide \(index\.json\) :/);
    assert.match(erreur.message, /« titre » est vide/);
    assert.match(erreur.message, /exercice en double/);
    return true;
  });
});

test('l’index réel : chaque exercice listé existe, est valide et porte le même titre', async () => {
  const liste = await loadExerciseIndex('exercices/', lireFichier);
  assert.ok(liste.length >= 1);
  assert.equal(liste[0].id, 'm10-tournage-vc'); // exercice par défaut
  for (const { id, titre } of liste) {
    const exercice = await loadExercise(id, data, 'exercices/', lireFichier);
    assert.equal(exercice.titre, titre, `${id} : le titre de l'index diffère de celui du fichier`);
  }
});

test('chaque fichier de site/exercices/ est un exercice valide (même s’il n’est pas offert dans l’index)', async () => {
  const fichiers = (await readdir(new URL('../site/exercices/', import.meta.url))).filter((f) => f.endsWith('.json') && f !== 'index.json');
  assert.ok(fichiers.length >= 1);
  for (const fichier of fichiers) await loadExercise(fichier.replace('.json', ''), data, 'exercices/', lireFichier);
});
