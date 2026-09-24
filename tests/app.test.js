// Tests de site/js/app.js : chargement de la page et choix de l'exercice par l'adresse, sans DOM.
// Depuis D47, l'exercice vient du serveur (GET /api/exercice) : ici, un faux fetch qui répond ce que
// le vrai serveur de test répond.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assembleExercise, loadApp, loadExerciseVersion, requestedExerciseId } from '../site/js/app.js';
import { serveurDeTest } from './aide-serveur.js';
import { lireFichier } from './aide.js';

const m10 = await lireFichier('exercices/m10-tournage-vc.json');

// Un fetch qui passe par le vrai serveur de test (fausse D1 semée) et note les adresses demandées.
function fauxFetch(serveur, demandes = []) {
  return async (path, options) => {
    demandes.push(path);
    const { status, corps } = await serveur.appel(options.method, path, { corps: options.body === undefined ? undefined : JSON.parse(options.body) });
    return { ok: status < 400, status, json: async () => corps };
  };
}

// --- Choix de l'exercice ---------------------------------------------------------------------

test('requestedExerciseId : ?exercice=<id>, ou null ; jamais de repli (D18)', () => {
  assert.equal(requestedExerciseId('?exercice=essai-percage'), 'essai-percage');
  assert.equal(requestedExerciseId('?autre=1&exercice=essai-percage'), 'essai-percage');
  assert.equal(requestedExerciseId('exercice=essai-percage'), 'essai-percage'); // sans le « ? »
  assert.equal(requestedExerciseId(''), null);
  assert.equal(requestedExerciseId('?exercice='), null);
  assert.equal(requestedExerciseId('?Exercice=essai-percage'), null); // le nom du paramètre est en minuscules
  assert.equal(requestedExerciseId('?exercice=../data/outils'), '../data/outils'); // c'est le serveur qui refuse
});

test('loadApp : charge l’exercice demandé par l’adresse, dans sa dernière version, avec son catalogue assemblé', async () => {
  const demandes = [];
  const app = await loadApp('?exercice=m10-tournage-vc', fauxFetch(serveurDeTest(), demandes));
  assert.deepEqual(demandes, ['/api/exercice?exercice=m10-tournage-vc']);
  assert.deepEqual([app.exercise.id, app.exercise.titre, app.exercise.version, app.version, app.archived, app.unknownId, app.listed], [m10.id, m10.titre, '1', 1, false, null, []]);
  assert.deepEqual(app.exercise.outils, m10.outils);
  assert.equal(app.data.outils.length, 9); // les copies d'outils de l'exercice, pas tout le catalogue
  assert.equal(app.data.materiaux.length, 47);
  assert.equal(app.data.operationByName.get('Chariotage finition').avance_po_rev, 0.005);
  assert.deepEqual(app.data.revisions, { materiaux: 'A2026_r0', operations: 'A2026_r0' });
});

test('loadApp : sans exercice reconnu, l’accueil montrera la liste (D18) — les exercices publiés, non archivés, sans « liste »: false', async () => {
  const serveur = serveurDeTest();
  for (const [adresse, inconnu] of [['', null], ['?exercice=inconnu', 'inconnu'], ['?exercice=../data/outils', '../data/outils']]) {
    const demandes = [];
    const app = await loadApp(adresse, fauxFetch(serveur, demandes));
    assert.equal(app.exercise, null, adresse);
    assert.equal(app.unknownId, inconnu, adresse);
    assert.deepEqual(app.listed.map((e) => e.id), ['m10-tournage-vc', 'm10-tournage-vc-rpm'], adresse);
    assert.equal(demandes.at(-1), '/api/exercices');
  }
});

test('loadExerciseVersion : la version épinglée à une séance, après une publication (D47)', async () => {
  const serveur = serveurDeTest();
  serveur.publierExercice({ ...m10, titre: 'M10 (v2)' });
  const derniere = await loadApp('?exercice=m10-tournage-vc', fauxFetch(serveur));
  assert.deepEqual([derniere.exercise.titre, derniere.exercise.version], ['M10 (v2)', '2']);
  const premiere = await loadExerciseVersion('m10-tournage-vc', '1', fauxFetch(serveur));
  assert.deepEqual([premiere.exercise.titre, premiere.exercise.version, premiere.archived], [m10.titre, '1', false]);
  await assert.rejects(loadExerciseVersion('m10-tournage-vc', '9', fauxFetch(serveur)), /version/);
});

test('assembleExercise : refuse des copies d’outils invalides, comme le serveur', async () => {
  const serveur = serveurDeTest();
  const { corps } = await serveur.appel('GET', '/api/exercice?exercice=m10-tournage-vc');
  corps.exercice.outils[0].fact_vc = 0;
  assert.throws(() => assembleExercise(corps), /fact_vc/);
});

test('loadApp : un serveur injoignable fait échouer le chargement avec un message clair', async () => {
  await assert.rejects(loadApp('?exercice=m10-tournage-vc', async () => { throw new Error('réseau'); }), /Le serveur de correction ne répond pas/);
});
