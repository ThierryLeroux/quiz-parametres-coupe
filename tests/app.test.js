// Tests de site/js/app.js : chargement de la page et choix de l'exercice par l'adresse, sans DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, requestedExercise } from '../site/js/app.js';
import { lireFichier } from './aide.js';

const INDEX = [{ id: 'm10-tournage-vc', titre: 'M10' }, { id: 'essai-percage', titre: 'Essai' }];

// --- Choix de l'exercice ---------------------------------------------------------------------

test('requestedExercise : ?exercice=<id> choisit un exercice de l’index', () => {
  const essai = { exercise: { id: 'essai-percage', titre: 'Essai' }, unknownId: null };
  assert.deepEqual(requestedExercise('?exercice=essai-percage', INDEX), essai);
  assert.deepEqual(requestedExercise('?autre=1&exercice=essai-percage', INDEX), essai);
  assert.deepEqual(requestedExercise('exercice=essai-percage', INDEX), essai); // sans le « ? »
});

test('requestedExercise : absent → aucun exercice ; inconnu → aucun exercice et l’id fautif ; jamais de repli (D18)', () => {
  assert.deepEqual(requestedExercise('', INDEX), { exercise: null, unknownId: null });
  assert.deepEqual(requestedExercise('?exercice=', INDEX), { exercise: null, unknownId: null });
  assert.deepEqual(requestedExercise('?Exercice=essai-percage', INDEX), { exercise: null, unknownId: null }); // le nom du paramètre est en minuscules
  assert.deepEqual(requestedExercise('?exercice=inconnu', INDEX), { exercise: null, unknownId: 'inconnu' });
  assert.deepEqual(requestedExercise('?exercice=../data/outils', INDEX), { exercise: null, unknownId: '../data/outils' }); // jamais un chemin
  assert.deepEqual(requestedExercise('?exercice=M10-tournage-vc', INDEX), { exercise: null, unknownId: 'M10-tournage-vc' }); // l'id est en minuscules
});

test('loadApp : charge le catalogue, l’index et l’exercice demandé par l’adresse', async () => {
  const demandes = [];
  const lecteur = (url) => { demandes.push(url); return lireFichier(url); };
  const app = await loadApp('?exercice=m10-tournage-vc', lecteur);
  assert.equal(app.data.outils.length, 29);
  assert.deepEqual(app.index.map((e) => e.id), ['m10-tournage-vc', 'm10-tournage-vc-rpm', 'test-complet']);
  assert.equal(app.exercise.id, 'm10-tournage-vc');
  assert.equal(app.unknownId, null);
  assert.deepEqual(app.listed, []); // la liste n'est composée que lorsqu'elle sera montrée
  assert.deepEqual(demandes.sort(), ['data/materiaux.json', 'data/operations.json', 'data/outils.json', 'exercices/index.json', 'exercices/m10-tournage-vc.json']);
});

test('loadApp : sans exercice reconnu, l’accueil montrera la liste (D18) — sans les exercices d’essai marqués « liste »: false (D30)', async () => {
  for (const [adresse, inconnu] of [['', null], ['?exercice=inconnu', 'inconnu'], ['?exercice=../data/outils', '../data/outils']]) {
    const demandes = [];
    const lecteur = (url) => { demandes.push(url); return lireFichier(url); };
    const app = await loadApp(adresse, lecteur);
    assert.equal(app.exercise, null, adresse);
    assert.equal(app.unknownId, inconnu, adresse);
    assert.deepEqual(app.index.map((e) => e.id), ['m10-tournage-vc', 'm10-tournage-vc-rpm', 'test-complet']);
    assert.deepEqual(app.listed.map((e) => e.id), ['m10-tournage-vc', 'm10-tournage-vc-rpm']);
    assert.deepEqual(demandes.sort(), ['data/materiaux.json', 'data/operations.json', 'data/outils.json', 'exercices/index.json', 'exercices/m10-tournage-vc-rpm.json', 'exercices/m10-tournage-vc.json', 'exercices/test-complet.json'], adresse);
  }
});

test('loadApp : un fichier manquant fait échouer le chargement avec un message clair', async () => {
  const lecteur = async (url) => { if (url.includes('index')) throw new Error(`Impossible de charger ${url} (HTTP 404)`); return lireFichier(url); };
  await assert.rejects(loadApp('', lecteur), /Impossible de charger exercices\/index\.json/);
});
